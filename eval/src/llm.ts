/**
 * One structured model call, through one of two backends:
 *
 *   claude-code (default)  `claude -p` headless, on the user's own Claude Code login. No API key.
 *                          Claude Code wraps the call in about 600 tokens of its own context and returns
 *                          structured output through a tool, so tokens and latency run slightly higher
 *                          than a direct API call. Fine for comparing models; not a production path.
 *   api                    The Anthropic API through the official SDK, as the app will call it.
 *                          Needs ANTHROPIC_API_KEY.
 *
 * Models from other providers run through their own CLIs on the user's login: `codex exec` (OpenAI),
 * `agy -p` (Google Antigravity) and `muse exec` (Meta). None of them has a system-prompt flag, so the
 * instructions go at the top of the prompt, and each adds its own agent context (8k–16k tokens). Their
 * token counts are reported but have no price; compare them on quality and latency.
 */
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { mkdtemp, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { z } from "zod/v4";
import { costUsd, type ModelConfig } from "./configs.ts";

export type Backend = "claude-code" | "api";

export interface Usage {
  input_tokens: number;
  output_tokens: number;
  cache_creation_input_tokens: number;
  cache_read_input_tokens: number;
  thinking_tokens: number | null;
}

export interface CallResult<T> {
  output: T | null;
  servedModel: string;
  usage: Usage;
  costUsd: number | null;
  /** "end_turn" on success; "max_tokens" / "refusal" are graded outcomes, not errors. */
  stopReason: string | null;
  inferenceGeo: string | null;
  latencyMs: number;
}

export interface CallOptions {
  backend: Backend;
  timeoutMs: number;
  geo?: string;
}

export class CallError extends Error {
  constructor(
    message: string,
    readonly errorClass: string,
  ) {
    super(message);
  }
}

/** JSON Schema without the `$schema` header, which some CLIs' validators reject. */
function jsonSchema(schema: z.ZodType): object {
  const { $schema: _, ...rest } = z.toJSONSchema(schema) as Record<string, unknown>;
  return rest;
}

let apiClient: Anthropic | null = null;
let sandbox: Promise<string> | null = null;

export async function structuredCall<S extends z.ZodType>(
  cfg: ModelConfig,
  system: string,
  user: string,
  schema: S,
  maxTokens: number,
  opts: CallOptions,
): Promise<CallResult<z.infer<S>>> {
  if (cfg.provider === "anthropic") {
    return opts.backend === "api" ? viaApi(cfg, system, user, schema, maxTokens, opts) : viaClaudeCode(cfg, system, user, schema, opts);
  }
  if (cfg.provider === "codex") return viaCodex(cfg, system, user, schema, opts);
  if (cfg.provider === "agy") return viaAgy(cfg, system, user, schema, opts);
  return viaMuse(cfg, system, user, schema, opts);
}

/** An empty working directory for CLI agents, so no project files, instructions or memory are in reach. */
function workDir(): Promise<string> {
  sandbox ??= mkdtemp(join(tmpdir(), "learnflow-eval-"));
  return sandbox;
}

let fileCounter = 0;
async function tempFile(name: string, content: string): Promise<string> {
  const path = join(await workDir(), `${process.pid}-${++fileCounter}-${name}`);
  await writeFile(path, content);
  return path;
}

/** Instructions and input as one prompt, for CLIs without a system-prompt option. */
const combined = (system: string, user: string) => `<instructions>\n${system}\n</instructions>\n\n${user}`;

async function spawnCli(cmd: string[], opts: CallOptions, stdin?: string) {
  const started = performance.now();
  const proc = Bun.spawn(cmd, { cwd: await workDir(), stdin: stdin === undefined ? "ignore" : new Blob([stdin]), stdout: "pipe", stderr: "pipe" });
  const timer = setTimeout(() => proc.kill(), opts.timeoutMs);
  const [stdout, stderr, code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);
  clearTimeout(timer);
  if (proc.signalCode) throw new CallError(`${cmd[0]} killed after ${opts.timeoutMs} ms`, "timeout");
  return { stdout, stderr, code, latencyMs: Math.round(performance.now() - started) };
}

function parseJsonText<S extends z.ZodType>(schema: S, text: string | undefined): z.infer<S> | null {
  if (!text) return null;
  try {
    const parsed = schema.safeParse(JSON.parse(text.trim().replace(/^```(?:json)?\s*|\s*```$/g, "")));
    return parsed.success ? (parsed.data as z.infer<S>) : null;
  } catch {
    return null;
  }
}

const jsonLines = (stdout: string) =>
  stdout
    .split("\n")
    .filter((l) => l.startsWith("{"))
    .flatMap((l) => {
      try {
        return [JSON.parse(l)];
      } catch {
        return [];
      }
    });

async function viaCodex<S extends z.ZodType>(cfg: ModelConfig, system: string, user: string, schema: S, opts: CallOptions): Promise<CallResult<z.infer<S>>> {
  const schemaPath = await tempFile("schema.json", JSON.stringify(jsonSchema(schema)));
  const r = await spawnCli(
    [
      "codex", "exec",
      "--skip-git-repo-check", "--ephemeral", "--ignore-user-config", "--ignore-rules",
      "-s", "read-only",
      "-m", cfg.model,
      "-c", `model_reasoning_effort="${cfg.effort}"`,
      "--output-schema", schemaPath,
      "--json", "-",
    ],
    opts,
    combined(system, user),
  );
  const events = jsonLines(r.stdout);
  const failed = events.find((e) => e.type === "turn.failed" || e.type === "error");
  if (failed || r.code !== 0) throw new CallError(`codex exec failed: ${JSON.stringify(failed ?? r.stderr.slice(-300))}`, "harness");
  const message = events.filter((e) => e.type === "item.completed" && e.item?.type === "agent_message").at(-1)?.item?.text;
  const u = events.find((e) => e.type === "turn.completed")?.usage ?? {};
  return {
    output: parseJsonText(schema, message),
    servedModel: cfg.model,
    usage: {
      input_tokens: u.input_tokens ?? 0,
      output_tokens: u.output_tokens ?? 0,
      cache_creation_input_tokens: u.cache_write_input_tokens ?? 0,
      cache_read_input_tokens: u.cached_input_tokens ?? 0,
      thinking_tokens: u.reasoning_output_tokens ?? null,
    },
    costUsd: null,
    stopReason: "end_turn",
    inferenceGeo: null,
    latencyMs: r.latencyMs,
  };
}

async function viaAgy<S extends z.ZodType>(cfg: ModelConfig, system: string, user: string, schema: S, opts: CallOptions): Promise<CallResult<z.infer<S>>> {
  const schemaPath = await tempFile("schema.json", JSON.stringify(jsonSchema(schema)));
  const r = await spawnCli(
    ["agy", "-p", combined(system, user), "--model", cfg.model, "--json-schema", schemaPath, "--output-format", "json", "--disable-slash-commands", "--sandbox"],
    opts,
  );
  let res: { status?: string; response?: string; structured_output?: unknown; usage?: Record<string, number>; error?: unknown };
  try {
    res = JSON.parse(r.stdout.slice(r.stdout.indexOf("{")));
  } catch {
    throw new CallError(`agy exited ${r.code} without JSON: ${(r.stderr || r.stdout).slice(0, 300)}`, "harness");
  }
  if (res.status !== "SUCCESS") throw new CallError(`agy: ${res.status} ${JSON.stringify(res.error ?? "").slice(0, 300)}`, "harness");
  const parsed = schema.safeParse(res.structured_output);
  const u = res.usage ?? {};
  return {
    output: parsed.success ? (parsed.data as z.infer<S>) : parseJsonText(schema, res.response),
    servedModel: cfg.model,
    usage: {
      input_tokens: u.input_tokens ?? 0,
      output_tokens: u.output_tokens ?? 0,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: u.cache_read_tokens ?? 0,
      thinking_tokens: u.thinking_tokens ?? null,
    },
    costUsd: null,
    stopReason: "end_turn",
    inferenceGeo: null,
    latencyMs: r.latencyMs,
  };
}

async function viaMuse<S extends z.ZodType>(cfg: ModelConfig, system: string, user: string, schema: S, opts: CallOptions): Promise<CallResult<z.infer<S>>> {
  const schemaPath = await tempFile("schema.json", JSON.stringify(jsonSchema(schema)));
  const promptPath = await tempFile("prompt.txt", combined(system, user));
  const r = await spawnCli(
    [
      "muse", "exec",
      "--preset", "empty",
      "--model", cfg.model,
      "--reasoning-effort", cfg.effort,
      "--output-schema", schemaPath,
      "--prompt-file", promptPath,
      "--no-session-log", "--disable-web-tools", "--disable-reminders", "--disable-request-user-input", "--no-foreign-personal-context",
      "--json",
    ],
    opts,
  );
  const events = jsonLines(r.stdout);
  const terminal = events.find((e) => e.payload_type === "run.terminal.completed")?.payload;
  if (!terminal || terminal.terminal !== "completed") {
    throw new CallError(`muse exec did not complete: ${JSON.stringify(terminal ?? r.stderr.slice(-300)).slice(0, 300)}`, "harness");
  }
  const m = events.find((e) => e.payload_type === "run.usage")?.payload?.models?.[0] ?? {};
  return {
    output: parseJsonText(schema, terminal.text),
    servedModel: m.model ?? cfg.model,
    usage: {
      input_tokens: m.input_tokens ?? 0,
      output_tokens: m.output_tokens ?? 0,
      cache_creation_input_tokens: 0,
      cache_read_input_tokens: m.cached_tokens ?? 0,
      thinking_tokens: m.reasoning_tokens ?? null,
    },
    costUsd: null,
    stopReason: "end_turn",
    inferenceGeo: null,
    latencyMs: r.latencyMs,
  };
}

async function viaApi<S extends z.ZodType>(cfg: ModelConfig, system: string, user: string, schema: S, maxTokens: number, opts: CallOptions) {
  apiClient ??= new Anthropic();
  const started = performance.now();
  try {
    const res = await apiClient.messages.parse(
      {
        model: cfg.model,
        max_tokens: maxTokens,
        system: [{ type: "text", text: system, cache_control: { type: "ephemeral" } }],
        messages: [{ role: "user", content: user }],
        output_config: { effort: cfg.effort, format: zodOutputFormat(schema) },
        ...(opts.geo ? { inference_geo: opts.geo } : {}),
      },
      { timeout: opts.timeoutMs, maxRetries: 4 },
    );
    const u = res.usage;
    return {
      output: (res.parsed_output ?? null) as z.infer<S> | null,
      servedModel: res.model,
      usage: {
        input_tokens: u.input_tokens,
        output_tokens: u.output_tokens,
        cache_creation_input_tokens: u.cache_creation_input_tokens ?? 0,
        cache_read_input_tokens: u.cache_read_input_tokens ?? 0,
        thinking_tokens: u.output_tokens_details?.thinking_tokens ?? null,
      },
      costUsd: costUsd(cfg.model, u),
      stopReason: res.stop_reason,
      inferenceGeo: u.inference_geo ?? null,
      latencyMs: Math.round(performance.now() - started),
    };
  } catch (e) {
    if (e instanceof Anthropic.APIConnectionTimeoutError) throw new CallError(e.message, "timeout");
    if (e instanceof Anthropic.RateLimitError) throw new CallError(e.message, "rate-limit");
    if (e instanceof Anthropic.AuthenticationError) throw new CallError(e.message, "auth");
    if (e instanceof Anthropic.APIError) throw new CallError(e.message, `api-${e.status ?? "?"}`);
    throw e;
  }
}

/** Shape of `claude -p --output-format json`, as far as we use it. */
interface ClaudeCodeResult {
  is_error: boolean;
  subtype: string;
  result?: string;
  structured_output?: unknown;
  stop_reason: string | null;
  total_cost_usd?: number;
  api_error_status?: number | null;
  usage?: {
    input_tokens: number;
    output_tokens: number;
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
    output_tokens_details?: { thinking_tokens?: number };
    inference_geo?: string;
  };
  modelUsage?: Record<string, unknown>;
}

async function viaClaudeCode<S extends z.ZodType>(cfg: ModelConfig, system: string, user: string, schema: S, opts: CallOptions) {
  // An empty working directory, and no settings, hooks, plugins, MCP servers or tools: the model sees
  // our system prompt and the source, plus Claude Code's own minimal wrapper.
  const cwd = await workDir();
  const args = [
    "-p",
    "--model", cfg.model,
    "--effort", cfg.effort,
    "--system-prompt", system,
    "--json-schema", JSON.stringify(jsonSchema(schema)),
    "--tools", "",
    "--strict-mcp-config",
    "--setting-sources", "",
    "--no-session-persistence",
    "--output-format", "json",
  ];
  const started = performance.now();
  const proc = Bun.spawn(["claude", ...args], { cwd, stdin: new Blob([user]), stdout: "pipe", stderr: "pipe" });
  const timer = setTimeout(() => proc.kill(), opts.timeoutMs);
  const [stdout, stderr, code] = await Promise.all([new Response(proc.stdout).text(), new Response(proc.stderr).text(), proc.exited]);
  clearTimeout(timer);
  const latencyMs = Math.round(performance.now() - started);
  if (proc.signalCode) throw new CallError(`claude -p killed after ${opts.timeoutMs} ms`, "timeout");

  let res: ClaudeCodeResult;
  try {
    res = JSON.parse(stdout);
  } catch {
    throw new CallError(`claude -p exited ${code} without JSON: ${(stderr || stdout).slice(0, 300)}`, "harness");
  }
  if (res.is_error) {
    const status = res.api_error_status;
    throw new CallError(`claude -p: ${res.subtype} ${res.result ?? ""}`.trim(), status === 429 ? "rate-limit" : status ? `api-${status}` : "harness");
  }
  const parsed = schema.safeParse(res.structured_output);
  const u = res.usage;
  const models = Object.keys(res.modelUsage ?? {});
  return {
    output: parsed.success ? (parsed.data as z.infer<S>) : null,
    servedModel: models.find((m) => m === cfg.model) ?? models.join(",") ?? cfg.model,
    usage: {
      input_tokens: u?.input_tokens ?? 0,
      output_tokens: u?.output_tokens ?? 0,
      cache_creation_input_tokens: u?.cache_creation_input_tokens ?? 0,
      cache_read_input_tokens: u?.cache_read_input_tokens ?? 0,
      thinking_tokens: u?.output_tokens_details?.thinking_tokens ?? null,
    },
    // Claude Code reports list-price cost, the same basis as the API price table.
    costUsd: res.total_cost_usd ?? null,
    // Structured output arrives through a tool call, so a successful run ends in "tool_use".
    stopReason: res.stop_reason === "tool_use" ? "end_turn" : res.stop_reason,
    inferenceGeo: u?.inference_geo ?? null,
    latencyMs,
  };
}
