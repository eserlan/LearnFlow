/**
 * Summarise a run as Markdown: one row per config against the 002 success criteria, then every
 * failure per item so the outputs behind the numbers are easy to find.
 *
 *   bun scripts/report.ts <run-name>      (writes runs/<run-name>/report.md and prints it)
 */
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { CONFIGS, JUDGES } from "../src/configs.ts";
import type { CheckResult } from "../src/checks.ts";
import type { Metrics } from "../src/score.ts";

const runName = process.argv[2];
if (!runName) {
  console.error("usage: bun scripts/report.ts <run-name>");
  process.exit(2);
}
const runDir = join(import.meta.dir, "..", "runs", runName);
const lines = (p: string) => readFile(p, "utf8").catch(() => "").then((s) => s.split("\n").filter(Boolean).map((l) => JSON.parse(l)));

interface Row {
  key: string;
  itemId: string;
  sourceWords: number;
  configId: string;
  status: string;
  judgeId: string | null;
  simplify: { requestedModel: string; latencyMs: number; firstPartMs?: number; parts?: number; costUsd: number | null; inferenceGeo: string | null; servedModel: string } | null;
  judge: { costUsd: number | null; missingIds: string[] } | null;
  metrics: Metrics;
  checks: CheckResult;
}
const rows: Row[] = await lines(join(runDir, "results.jsonl"));
// An error is superseded once a later attempt at the same case produced a result.
const done = new Set(rows.map((r) => r.key));
const errors: { key: string; stage: string; class: string; message?: string }[] = (await lines(join(runDir, "errors.jsonl"))).filter(
  (e: { key: string }) => !done.has(e.key),
);
const run = JSON.parse(await readFile(join(runDir, "run.json"), "utf8"));

const pct = (a: number, b: number) => (b ? `${((100 * a) / b).toFixed(1)}%` : "–");
const sum = <T>(xs: T[], f: (x: T) => number) => xs.reduce((s, x) => s + f(x), 0);
const quantile = (xs: number[], q: number) => {
  if (!xs.length) return null;
  const s = [...xs].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.ceil(q * s.length) - 1)]!;
};
/** Wilson 95% interval for a proportion: with this few cases, the spread matters as much as the mean. */
const wilson = (k: number, n: number) => {
  if (!n) return "";
  const z = 1.96, p = k / n, d = 1 + (z * z) / n;
  const c = (p + (z * z) / (2 * n)) / d, h = (z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n))) / d;
  return ` (${Math.round(100 * Math.max(0, c - h))}–${Math.round(100 * Math.min(1, c + h))})`;
};
const secs = (ms: number | null) => (ms === null ? "–" : `${(ms / 1000).toFixed(1)} s`);
const usd = (x: number) => (x < 0.01 ? `$${x.toFixed(4)}` : `$${x.toFixed(3)}`);

const out: string[] = [];
out.push(`# Run ${run.name}`, "");
out.push(
  `Prompt \`${run.promptVersion}\`, judge ${run.judge ? `\`${run.judge}\` (\`${run.judgeVersion}\`)` : "none"}, level \`${run.level}\`, ${run.reps} rep(s), commit \`${run.gitCommit}\`.`,
  "",
);

const order = CONFIGS.map((c) => c.id);
const configIds = [...new Set(rows.map((r) => r.configId))].sort((a, b) => order.indexOf(a) - order.indexOf(b));
const judged = rows.some((r) => r.judgeId);

const lettere = run.level === "lettere";
out.push("## Faithfulness", "");
out.push(
  `Targets from spec 002: sentences supported ≥ 99% (SC-001), no numbers that are not in the source (SC-002), ${
    lettere ? "main points" : "key facts"
  } ≥ 95% (SC-003), no task answered or dropped (FR-011), nothing left out in a way that misleads (FR-017).${
    lettere ? " At this level leaving out detail is wanted, so detail facts and values are shown, not gated." : ""
  }`,
  "",
);
out.push(
  "| Config | Items | Pass | Sentences supported | Lessons > 1 bad sentence | Added numbers | Main points (95% CI) | All key facts | Distorted facts | Qualifiers kept | Expectations met | Tasks answered / dropped | Misleading omissions | Values kept | Wrong standard | Errors |",
  "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
);
for (const id of configIds) {
  const rs = rows.filter((r) => r.configId === id && r.status === "ok");
  const ms = rs.map((r) => r.metrics);
  const sentences = sum(ms, (m) => m.sentences - (m.unjudged ?? 0));
  const facts = sum(ms, (m) => m.facts?.total ?? 0), present = sum(ms, (m) => m.facts?.present ?? 0);
  const core = sum(ms, (m) => m.coreFacts?.total ?? 0), corePresent = sum(ms, (m) => m.coreFacts?.present ?? 0);
  const errs = errors.filter((e) => e.key.split("|")[1] === id).length;
  const other = rows.filter((r) => r.configId === id && r.status !== "ok").length;
  const J = (x: string) => (judged ? x : "–");
  out.push(
    `| ${id} | ${rs.length}${other ? ` (+${other} truncated/refused)` : ""} | ${J(`${ms.filter((m) => m.pass).length}/${ms.length}`)} | ${J(
      pct(sum(ms, (m) => m.supported ?? 0), sentences),
    )} | ${J(String(ms.filter((m) => (m.distorted ?? 0) + (m.unsupported ?? 0) > 1).length))} | ${sum(ms, (m) => m.addedNumbers)} | ${J(
      `${pct(corePresent, core)}${wilson(corePresent, core)}`,
    )} | ${J(pct(present, facts))} | ${J(String(sum(ms, (m) => m.facts?.distorted ?? 0)))} | ${J(
      pct(sum(ms, (m) => m.qualifiers?.kept ?? 0), sum(ms, (m) => m.qualifiers?.applicable ?? 0)),
    )} | ${J(pct(sum(ms, (m) => m.expectations?.met ?? 0), sum(ms, (m) => m.expectations?.applicable ?? 0)))} | ${J(
      `${ms.filter((m) => m.tasksAnswered).length} / ${ms.filter((m) => m.tasksDropped).length}`,
    )} | ${J(String(ms.filter((m) => m.misleadingOmission).length))} | ${pct(sum(ms, (m) => m.values.kept), sum(ms, (m) => m.values.total))} | ${ms.filter((m) => m.wrongVariant).length} | ${errs} |`,
  );
}

out.push("", "## Simplification, speed and cost", "");
out.push(
  "Length is output words (without headings and added help) as a share of the source. LIX target at `lettere`: ≤ max(source − 10, 30), counted without the item's subject terms and must-preserve values as long words (SC-004); plain LIX is shown for reference. Latency target: ≤ 10 s at p90 for 300–500 words (SC-008).",
  "",
);
out.push(
  "| Config | Length (median) | Words / sentence | Longest section (sentences) | LIX source → output (mean) | LIX without terms | LIX pass | Parts per text | First part p50 / p90 | Whole text p50 / p90 | p90 at 300–500 words | Cost / item |",
  "| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |",
);
for (const id of configIds) {
  const rs = rows.filter((r) => r.configId === id && r.status === "ok");
  const cs = rs.map((r) => r.checks);
  const ms = rs.map((r) => r.metrics);
  const mean = (xs: (number | null | undefined)[]) => {
    const v = xs.filter((x): x is number => typeof x === "number");
    return v.length ? (sum(v, (x) => x) / v.length).toFixed(1) : "–";
  };
  const lixRows = ms.filter((m) => m.lixPass !== null);
  const lat = rs.map((r) => r.simplify?.latencyMs).filter((x): x is number => x !== undefined);
  const first = rs.map((r) => r.simplify?.firstPartMs ?? r.simplify?.latencyMs).filter((x): x is number => x !== undefined);
  const parts = rs.map((r) => r.simplify?.parts ?? 1);
  const latPage = rs.filter((r) => r.sourceWords >= 300 && r.sourceWords <= 500).map((r) => r.simplify?.latencyMs).filter((x): x is number => x !== undefined);
  const cost = rs.map((r) => r.simplify?.costUsd).filter((x): x is number => typeof x === "number");
  const ratio = quantile(cs.map((c) => c.lengthRatio).filter((x) => typeof x === "number"), 0.5);
  out.push(
    `| ${id} | ${ratio === null ? "–" : `${Math.round(100 * ratio)}%`} | ${mean(cs.map((c) => c.wordsPerSentence))} | ${
      cs.length ? Math.max(...cs.map((c) => c.maxSectionSentences ?? 0)) : "–"
    } | ${mean(cs.map((c) => c.lixSource))} → ${mean(cs.map((c) => c.lixOutput))} | ${mean(cs.map((c) => c.lixAdjusted?.source))} → ${mean(
      cs.map((c) => c.lixAdjusted?.output),
    )} | ${
      lixRows.length ? `${lixRows.filter((m) => m.lixPass).length}/${lixRows.length}` : "–"
    } | ${rs.some((r) => r.simplify) ? `${Math.min(...parts)}–${Math.max(...parts)}` : "–"} | ${
      first.length ? `${secs(quantile(first, 0.5))} / ${secs(quantile(first, 0.9))}` : "–"
    } | ${lat.length ? `${secs(quantile(lat, 0.5))} / ${secs(quantile(lat, 0.9))}` : "–"} | ${latPage.length ? secs(quantile(latPage, 0.9)) : "–"} | ${
      cost.length ? usd(sum(cost, (x) => x) / cost.length) : "–"
    } |`,
  );
}

const judgeCost = sum(rows, (r) => r.judge?.costUsd ?? 0);
const genCost = sum(rows, (r) => r.simplify?.costUsd ?? 0);
out.push("", `Spend in this run: ${usd(genCost)} simplification + ${usd(judgeCost)} judge = **${usd(genCost + judgeCost)}**.`);
const geos = [...new Set(rows.map((r) => r.simplify?.inferenceGeo).filter(Boolean))];
if (geos.length) out.push(`Inference region reported by the API: ${geos.join(", ")}.`);
const selfJudged = rows.filter((r) => r.simplify && r.simplify.requestedModel === JUDGES.find((j) => j.id === r.judgeId)?.model);
if (selfJudged.length) out.push("Note: some outputs were judged by the same model that wrote them; their scores may be optimistic.");
const incomplete = rows.filter((r) => r.judge?.missingIds.length);
if (incomplete.length) out.push(`Warning: the judge skipped ids in ${incomplete.length} row(s): ${incomplete.map((r) => r.key).join(", ")}.`);

const seeded = rows.filter((r) => r.metrics.planted);
if (seeded.length) {
  out.push("", "## Planted errors (seeded config)", "", "The checks and judge must catch every planted error (SC-005 asks for ≥ 95%).", "");
  const all = seeded.flatMap((r) => r.metrics.planted!.map((p) => ({ ...p, item: r.itemId })));
  for (const t of ["changed-number", "dropped-qualifier", "invented-sentence"]) {
    const xs = all.filter((p) => p.type === t);
    const by = (w: string) => xs.filter((p) => p.by.includes(w as never)).length;
    out.push(
      `- ${t}: caught ${xs.filter((p) => p.caught).length}/${xs.length} (checks ${by("checks")}, judge ${by("judge")})${xs.some((p) => !p.caught) ? `; missed: ${xs.filter((p) => !p.caught).map((p) => p.item).join(", ")}` : ""}`,
    );
  }
}

out.push("", "## Failures by item", "");
const failing = rows.filter((r) => r.metrics.failures.length || r.status !== "ok");
if (!failing.length) out.push("None.");
for (const r of failing.sort((a, b) => a.itemId.localeCompare(b.itemId) || order.indexOf(a.configId) - order.indexOf(b.configId))) {
  const why = r.status !== "ok" ? r.status : r.metrics.failures.join("; ");
  out.push(`- **${r.itemId}** · ${r.configId}: ${why} — \`traces/${r.key.replace(/\|/g, "__")}.json\``);
}
if (errors.length) {
  out.push("", "## Errors (not scored)", "");
  for (const e of errors) out.push(`- ${e.key} (${e.stage}): ${e.class}${e.message ? ` — ${e.message.slice(0, 160)}` : ""}`);
}

const md = out.join("\n") + "\n";
await writeFile(join(runDir, "report.md"), md);
console.log(md);
