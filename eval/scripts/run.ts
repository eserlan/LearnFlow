/**
 * Run simplification configs over golden items, check and judge every output, and write results.
 *
 *   bun scripts/run.ts --configs haiku-low,sonnet-medium [--split dev|test|all] [--items id,id]
 *                      [--level lettere|naermere] [--reps 1] [--judge opus-medium|none]
 *                      [--run <name>] [--concurrency 3] [--timeout-s 300] [--backend claude-code|api]
 *                      [--geo <region>] [--yes]
 *
 * The default backend runs `claude -p` on your Claude Code login (no API key). `--backend api` calls
 * the Anthropic API directly and needs ANTHROPIC_API_KEY.
 *
 * Without --yes, a run that would call the API only prints its plan. Results go to runs/<name>/:
 *   results.jsonl   one row per item × config × level × rep, written as each finishes
 *   errors.jsonl    failed attempts (API errors, timeouts, unparsable output); never scored
 *   traces/         prompts, raw output, rendered text and judge verdicts per row
 *   run.json        what was run, with prompt and judge versions and the git commit
 * Re-running with the same --run resumes: rows already in results.jsonl are skipped.
 */
import { appendFile, mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import { toBlocks } from "../src/blocks.ts";
import { runChecks } from "../src/checks.ts";
import { findConfig, findJudge, type Config, type ModelConfig } from "../src/configs.ts";
import { CallError, type Backend } from "../src/llm.ts";
import { loadItems, type LoadedItem } from "../src/items.ts";
import { judge, JUDGE_VERSION, type JudgeResult } from "../src/judge.ts";
import { score } from "../src/score.ts";
import { PROMPT_VERSION, renderOutput, simplify, type Level } from "../src/simplify.ts";

const { values } = parseArgs({
  options: {
    configs: { type: "string" },
    split: { type: "string", default: "dev" },
    items: { type: "string" },
    level: { type: "string", default: "lettere" },
    reps: { type: "string", default: "1" },
    judge: { type: "string", default: "opus-medium" },
    run: { type: "string" },
    concurrency: { type: "string", default: "3" },
    backend: { type: "string", default: "claude-code" },
    "timeout-s": { type: "string", default: "300" },
    geo: { type: "string" },
    yes: { type: "boolean", default: false },
    "confirm-test": { type: "boolean", default: false },
  },
});

if (!values.configs) {
  console.error("usage: bun scripts/run.ts --configs <id,id> [--split dev] [--items id,id] [--judge opus-medium|none] [--yes]");
  process.exit(2);
}
const configs: Config[] = values.configs.split(",").map((c) => findConfig(c.trim()));
const judgeCfg: ModelConfig | null = values.judge === "none" ? null : findJudge(values.judge!);
const level = values.level as Level;
if (level !== "lettere" && level !== "naermere") throw new Error("--level must be lettere or naermere");
const reps = Number(values.reps);
const timeoutMs = Number(values["timeout-s"]) * 1000;
const backend = values.backend as Backend;
if (backend !== "claude-code" && backend !== "api") throw new Error("--backend must be claude-code or api");
const callOpts = { backend, timeoutMs, geo: values.geo };

if (values.split === "test" || values.split === "all") {
  if (!values["confirm-test"]) {
    console.error("The test split is for confirming a final choice, not for tuning. Add --confirm-test if that is what this run is.");
    process.exit(2);
  }
}

let items: LoadedItem[] = await loadItems();
if (values.items) {
  const want = new Set(values.items.split(",").map((s) => s.trim()));
  items = items.filter((i) => want.has(i.item.id));
  const found = new Set(items.map((i) => i.item.id));
  const unknown = [...want].filter((id) => !found.has(id));
  if (unknown.length) throw new Error(`unknown item(s): ${unknown.join(", ")}`);
} else if (values.split !== "all") {
  items = items.filter((i) => i.item.split === values.split);
}
const unannotated = items.filter((i) => i.item.review.status === "imported").map((i) => i.item.id);
if (unannotated.length) console.warn(`! skipping unannotated items: ${unannotated.join(", ")}`);
items = items.filter((i) => i.item.review.status !== "imported");

const runName = values.run ?? `${new Date().toISOString().slice(0, 16).replace(/[:T]/g, "-")}_${configs.map((c) => c.id).join("+")}`;
const runDir = join(import.meta.dir, "..", "runs", runName);

const modelConfigs = configs.filter((c) => c.kind === "model");
const cases = items.flatMap((i) => configs.flatMap((c) => Array.from({ length: reps }, (_, rep) => ({ loaded: i, cfg: c, rep }))));
const genCalls = items.length * modelConfigs.length * reps;
const judgeCalls = judgeCfg ? cases.length : 0;
const words = items.reduce((s, i) => s + (i.clean.match(/[\p{L}\p{N}]+/gu) ?? []).length, 0);

console.log(`Run ${runName}`);
console.log(`  ${items.length} item(s) (${words} source words), configs [${configs.map((c) => c.id).join(", ")}], level ${level}, ${reps} rep(s)`);
console.log(`  ${genCalls} simplification call(s), ${judgeCalls} judge call(s)${judgeCfg ? ` on ${judgeCfg.model} (${judgeCfg.effort})` : ""}, backend ${backend}`);
if ((genCalls || judgeCalls) && !values.yes) {
  console.log(
    backend === "api"
      ? "\nThis calls the Claude API and costs money. Re-run with --yes to start."
      : "\nThis uses your Claude Code plan's usage. Re-run with --yes to start.",
  );
  console.log("Tip: pilot on one item first (--items <id>) to measure tokens and time per case.");
  process.exit(0);
}

await mkdir(join(runDir, "traces"), { recursive: true });
const resultsPath = join(runDir, "results.jsonl");
const errorsPath = join(runDir, "errors.jsonl");
const done = new Set(
  (await readFile(resultsPath, "utf8").catch(() => ""))
    .split("\n")
    .filter(Boolean)
    .map((l) => (JSON.parse(l) as { key: string }).key),
);
const gitCommit = (await Bun.$`git rev-parse --short HEAD`.quiet().nothrow()).stdout.toString().trim();
await writeFile(
  join(runDir, "run.json"),
  JSON.stringify(
    { name: runName, updated: new Date().toISOString(), configs: configs.map((c) => c.id), judge: judgeCfg?.id ?? null, level, reps, backend, promptVersion: PROMPT_VERSION, judgeVersion: JUDGE_VERSION, gitCommit, geo: values.geo ?? null, items: items.map((i) => i.item.id) },
    null,
    2,
  ),
);

function errorClass(e: unknown): string {
  return e instanceof CallError ? e.errorClass : "harness";
}

let finished = 0;
let failed = 0;
const todo = cases.filter((c) => !done.has(key(c)));
function key(c: (typeof cases)[number]) {
  return `${c.loaded.item.id}|${c.cfg.id}|${level}|rep${c.rep}`;
}

async function runCase(c: (typeof cases)[number]) {
  const { item, clean } = c.loaded;
  const k = key(c);
  const blocks = toBlocks(clean);
  const fail = async (stage: string, e: unknown, extra: object = {}) => {
    failed++;
    const message = e instanceof Error ? e.message : String(e);
    await appendFile(errorsPath, JSON.stringify({ key: k, stage, class: errorClass(e), message, at: new Date().toISOString(), ...extra }) + "\n");
    console.error(`✗ ${k} (${stage}): ${message.slice(0, 200)}`);
  };

  let sim;
  try {
    sim = await simplify(c.cfg, item, blocks, level, callOpts);
  } catch (e) {
    return fail("simplify", e);
  }
  const stop = sim.call?.stopReason;
  const status = stop === "max_tokens" ? "truncated" : stop === "refusal" ? "refusal" : "ok";
  if (status === "ok" && !sim.parsed) return fail("simplify", new Error("output did not match the schema"), { usage: sim.call?.usage });

  const checks = runChecks(item, clean, blocks, sim.output, level);
  let jr: JudgeResult | null = null;
  if (judgeCfg && status === "ok") {
    try {
      jr = await judge(judgeCfg, item, blocks, sim.output, level, callOpts);
      if (!jr.output) return fail("judge", new Error(`judge output did not match the schema (stop: ${jr.call.stopReason})`), { usage: jr.call.usage });
    } catch (e) {
      return fail("judge", e);
    }
  }
  const metrics = score(checks, item, level, jr?.output ?? null, sim);
  const call = sim.call;
  const row = {
    key: k,
    itemId: item.id,
    split: item.split,
    language: item.language,
    contentType: item.contentType,
    sourceWords: checks.words.source,
    configId: c.cfg.id,
    level,
    rep: c.rep,
    promptVersion: PROMPT_VERSION,
    judgeVersion: jr ? JUDGE_VERSION : null,
    judgeId: jr ? judgeCfg!.id : null,
    status,
    simplify: call
      ? {
          requestedModel: call.requestedModel,
          servedModel: call.servedModel,
          effort: call.effort,
          latencyMs: call.latencyMs,
          usage: call.usage,
          costUsd: call.costUsd,
          inferenceGeo: call.inferenceGeo,
          stopReason: call.stopReason,
        }
      : null,
    judge: jr
      ? {
          servedModel: jr.call.servedModel,
          latencyMs: jr.call.latencyMs,
          usage: jr.call.usage,
          costUsd: jr.call.costUsd,
          missingIds: jr.missingIds,
        }
      : null,
    checks,
    metrics,
  };
  await writeFile(
    join(runDir, "traces", `${k.replace(/\|/g, "__")}.json`),
    JSON.stringify(
      { key: k, system: call?.system, user: call?.user, output: sim.output, rendered: renderOutput(sim.output), planted: sim.planted, judgeUser: jr?.call.user, judge: jr?.output, checks, metrics },
      null,
      2,
    ),
  );
  await appendFile(resultsPath, JSON.stringify(row) + "\n");
  finished++;
  const verdict = metrics.pass === null ? "checked" : metrics.pass ? "pass" : `fail: ${metrics.failures.join("; ")}`;
  console.log(`✓ ${k} ${call ? `${(call.latencyMs / 1000).toFixed(1)}s ` : ""}${verdict}`);
}

// Bounded concurrency: a fixed number of workers pull from the queue.
const queue = [...todo];
const workers = Array.from({ length: Math.max(1, Number(values.concurrency)) }, async () => {
  for (let c = queue.shift(); c; c = queue.shift()) await runCase(c);
});
await Promise.all(workers);

console.log(`\n${finished} done, ${failed} failed, ${cases.length - todo.length} already done. Report: bun scripts/report.ts ${runName}`);
process.exit(failed ? 1 : 0);
