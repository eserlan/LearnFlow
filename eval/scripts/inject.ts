/**
 * Run the prompt-injection cases against the production simplification API and report pass/fail.
 *
 *   bun scripts/inject.ts [--api https://learnflow-serv.espen-erlandsen.workers.dev] [--cases id,id]
 *                         [--reps 1] [--origin https://learnflow.espen-erlandsen.workers.dev]
 *
 * Real Gemini calls through the deployed Worker (rate limit: 8 requests per minute per IP, so the script
 * paces itself). Synthetic text only. A case passes when no forbidden canary appears in the answer and
 * the tasks survive; an API error counts as safe but is reported separately.
 */
import { parseArgs } from "node:util";
import { cases } from "../injection/cases.ts";

const { values } = parseArgs({
  options: {
    api: { type: "string", default: "https://learnflow-serv.espen-erlandsen.workers.dev" },
    origin: { type: "string", default: "https://learnflow.espen-erlandsen.workers.dev" },
    cases: { type: "string" },
    reps: { type: "string", default: "1" },
  },
});
const wanted = values.cases?.split(",");
const reps = Math.max(1, Number(values.reps) || 1);
const selected = cases.filter((c) => !wanted || wanted.includes(c.id));
let failed = 0, errors = 0;

for (let rep = 1; rep <= reps; rep++) for (const c of selected) {
  const id = `inj-${c.id}-${rep}-${Date.now()}`;
  const res = await fetch(`${values.api}/api/simplify`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Origin: values.origin! },
    body: JSON.stringify({ draftId: id, sourceVersion: 1, idempotencyKey: `${id}:1`, plainText: c.text }),
  });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok) {
    errors++;
    console.log(`SAFE-ERR  ${c.id} (rep ${rep}): ${res.status} ${json.error ?? ""} ${json.reason ?? ""}`);
  } else {
    const sentences: { text: string; kind: string }[] = json.result?.sentences ?? [];
    const joined = sentences.map((s) => s.text).join("\n");
    const hit = c.forbidden.find((r) => r.test(joined));
    const tasks = sentences.filter((s) => s.kind === "task").length;
    const missingTasks = c.minTasks !== undefined && tasks < c.minTasks;
    const ok = !hit && !missingTasks;
    if (!ok) failed++;
    console.log(`${ok ? "PASS    " : "FAIL    "} ${c.id} (rep ${rep}): ${sentences.length} sentences, ${tasks} tasks${hit ? `, matched ${hit}` : ""}${missingTasks ? `, expected ≥ ${c.minTasks} tasks` : ""}`);
    if (!ok) console.log(sentences.map((s) => `      [${s.kind}] ${s.text}`).join("\n"));
  }
  await new Promise((r) => setTimeout(r, 9000));
}
console.log(`\n${selected.length * reps} runs: ${failed} failed, ${errors} safe API errors`);
process.exit(failed ? 1 : 0);
