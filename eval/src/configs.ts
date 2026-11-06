/**
 * Candidate configurations for simplification, and the judge configurations.
 *
 * A config is a model plus an effort level. The pseudo-configs (identity, empty, seeded) make no
 * generation call; they exist to check the harness itself: identity must keep every fact, empty must
 * keep none, and seeded plants known errors that the checks and the judge must catch.
 */
import type Anthropic from "@anthropic-ai/sdk";

export type Effort = "low" | "medium" | "high" | "xhigh" | "max";

/**
 * Who serves the model. Anthropic models go through Claude Code or the API (run.ts --backend); the others
 * through their own CLI on the user's login: Codex (OpenAI), Antigravity (`agy`, Google) and Muse (Meta).
 */
export type Provider = "anthropic" | "codex" | "agy" | "muse";

export interface ModelConfig {
  kind: "model";
  id: string;
  provider: Provider;
  model: Anthropic.Model;
  effort: Effort;
}

export interface PseudoConfig {
  kind: "pseudo";
  id: "identity" | "empty" | "seeded";
  description: string;
}

export type Config = ModelConfig | PseudoConfig;

const model = (id: string, m: Anthropic.Model, effort: Effort, provider: Provider = "anthropic"): ModelConfig => ({
  kind: "model",
  id,
  provider,
  model: m,
  effort,
});

export const CONFIGS: Config[] = [
  model("haiku-low", "claude-haiku-5-5", "low"),
  model("haiku-medium", "claude-haiku-5-5", "medium"),
  model("haiku-high", "claude-haiku-5-5", "high"),
  model("sonnet-low", "claude-sonnet-5-5", "low"),
  model("sonnet-medium", "claude-sonnet-5-5", "medium"),
  model("sonnet-high", "claude-sonnet-5-5", "high"),
  model("opus-low", "claude-opus-5-5", "low"),
  model("opus-medium", "claude-opus-5-5", "medium"),
  // Other providers, through their CLIs. Antigravity encodes the effort in the model id.
  model("gemini-flash-low", "gemini-3.8-flash-low", "low", "agy"),
  model("gemini-flash-medium", "gemini-3.8-flash-medium", "medium", "agy"),
  model("gemini-flash-high", "gemini-3.8-flash-high", "high", "agy"),
  model("gemini-argon-low", "gemini-4-argon-low", "low", "agy"),
  model("gpt-luna-low", "gpt-6-luna", "low", "codex"),
  model("gpt-luna-medium", "gpt-6-luna", "medium", "codex"),
  model("muse-wonder-low", "muse-wonder-1.0", "low", "muse"),
  model("muse-wonder-medium", "muse-wonder-1.0", "medium", "muse"),
  { kind: "pseudo", id: "identity", description: "The source blocks, unchanged, one sentence per block." },
  { kind: "pseudo", id: "empty", description: "No output at all." },
  {
    kind: "pseudo",
    id: "seeded",
    description: "Identity plus three planted errors: a changed number, a dropped qualifier, an invented sentence.",
  },
];

/** Judges: who checks the outputs. A judge should not be the candidate it grades; the report flags it. */
export const JUDGES: ModelConfig[] = [
  model("opus-medium", "claude-opus-5-5", "medium"),
  model("opus-high", "claude-opus-5-5", "high"),
  model("sonnet-high", "claude-sonnet-5-5", "high"),
];

export function findConfig(id: string): Config {
  const c = CONFIGS.find((x) => x.id === id);
  if (!c) throw new Error(`unknown config '${id}'. Known: ${CONFIGS.map((x) => x.id).join(", ")}`);
  return c;
}

export function findJudge(id: string): ModelConfig {
  const j = JUDGES.find((x) => x.id === id);
  if (!j) throw new Error(`unknown judge '${id}'. Known: ${JUDGES.map((x) => x.id).join(", ")}, none`);
  return j;
}

/**
 * USD per million tokens, first-party Claude API, standard (non-batch) rates. From the Claude API
 * model catalogue as of 2026-11; check https://platform.claude.com/docs/en/about-claude/pricing before
 * relying on the cost column. Cache writes (5-minute TTL) cost 1.25 × input.
 * Haiku 5.5 is priced higher above 100K prompt tokens; our prompts are far below that.
 */
export const PRICES: Record<string, { input: number; output: number; cacheRead: number }> = {
  "claude-haiku-5-5": { input: 0.1, output: 0.5, cacheRead: 0.01 },
  "claude-sonnet-5-5": { input: 2, output: 10, cacheRead: 0.2 },
  "claude-opus-5-5": { input: 4, output: 20, cacheRead: 0.2 },
};

export function costUsd(modelId: string, usage: Anthropic.Usage): number | null {
  const p = PRICES[modelId];
  if (!p) return null;
  const write = usage.cache_creation_input_tokens ?? 0;
  const read = usage.cache_read_input_tokens ?? 0;
  return (usage.input_tokens * p.input + write * p.input * 1.25 + read * p.cacheRead + usage.output_tokens * p.output) / 1e6;
}
