/**
 * Per-output metrics, mapped to the 002 success criteria:
 *   SC-001 sentences supported (≥ 99%, and at most one bad sentence per lesson)
 *   SC-002 values in the output exact (no numbers that are not in the source); at "naermere" also every
 *          must-preserve value kept
 *   SC-003 key facts present (≥ 95%): core facts (main points) at "lettere", all facts at "naermere"
 *   SC-004 LIX at level "lettere" ≤ max(source − 10, 30), not counting protected terms as long words
 *   FR-011 tasks never answered, and never dropped
 *   FR-017 nothing left out in a way that makes the rest misleading
 * At "lettere", leaving out detail is the point, so missing detail facts and values are reported, not failed.
 */
import type { CheckResult } from "./checks.ts";
import type { JudgeOutput } from "./judge.ts";
import type { GoldenItem } from "./schema.ts";
import type { Level, SimplifyResult } from "./simplify.ts";

export interface Metrics {
  sentences: number;
  /** Sentences the judge gave no verdict for; left out of the supported share, and flagged in the report. */
  unjudged: number;
  /** Judge verdicts; null when no judge ran. */
  supported: number | null;
  distorted: number | null;
  unsupported: number | null;
  facts: { total: number; present: number; partial: number; missing: number; distorted: number } | null;
  /** Main points (core key facts): the ones that must survive at level "lettere". */
  coreFacts: { total: number; present: number } | null;
  qualifiers: { applicable: number; kept: number } | null;
  expectations: { applicable: number; met: number } | null;
  tasksAnswered: boolean | null;
  tasksDropped: boolean | null;
  misleadingOmission: boolean | null;
  values: { total: number; kept: number };
  addedNumbers: number;
  lixPass: boolean | null;
  wrongVariant: boolean;
  /** Seeded config only: which planted errors were caught, by the checks or by the judge. */
  planted?: { type: string; detail: string; caught: boolean; by: ("checks" | "judge")[] }[];
  /** All hard gates for one lesson. Null without a judge, since most gates need it. */
  pass: boolean | null;
  failures: string[];
}

const n = <T extends { verdict: string }>(xs: T[], v: string) => xs.filter((x) => x.verdict === v).length;

export function score(
  checks: CheckResult,
  item: GoldenItem,
  level: Level,
  judgeOut: JudgeOutput | null,
  sim: Pick<SimplifyResult, "output" | "planted">,
): Metrics {
  const j = judgeOut;
  const totalValues = item.annotations.mustPreserve.length;
  const coreIds = new Set(item.annotations.keyFacts.filter((f) => f.core).map((f) => f.id));
  const coreVerdicts = j ? j.keyFacts.filter((f) => coreIds.has(f.id)) : [];
  const m: Metrics = {
    sentences: checks.sentences,
    unjudged: j ? Math.max(0, checks.sentences - j.sentences.length) : 0,
    supported: j ? n(j.sentences, "supported") + n(j.sentences, "added-help-ok") : null,
    distorted: j ? n(j.sentences, "distorted") : null,
    unsupported: j ? n(j.sentences, "unsupported") + n(j.sentences, "added-help-problem") : null,
    facts: j
      ? {
          total: j.keyFacts.length,
          present: n(j.keyFacts, "present"),
          partial: n(j.keyFacts, "partial"),
          missing: n(j.keyFacts, "missing"),
          distorted: n(j.keyFacts, "distorted"),
        }
      : null,
    coreFacts: j ? { total: coreIds.size, present: n(coreVerdicts, "present") } : null,
    qualifiers: j ? { applicable: j.qualifiers.length - n(j.qualifiers, "not-applicable"), kept: n(j.qualifiers, "kept") } : null,
    expectations: j ? { applicable: j.expectations.length - n(j.expectations, "not-applicable"), met: n(j.expectations, "met") } : null,
    tasksAnswered: j ? j.tasks.verdict === "answered" : null,
    tasksDropped: j ? j.tasks.kept === "some-dropped" : null,
    misleadingOmission: j ? j.omissions.verdict === "misleading" : null,
    values: { total: totalValues, kept: totalValues - checks.missingValues.length },
    addedNumbers: checks.addedNumbers.length,
    lixPass: checks.lixPass,
    wrongVariant: checks.wrongVariantWords.length > 0,
    pass: null,
    failures: [],
  };

  if (sim.planted) {
    const idx = (text: string) => sim.output.sentences.findIndex((s) => s.text === text);
    const newNumbers = (text: string) => (text.match(/\d+/g) ?? []).some((d) => checks.addedNumbers.some((a) => a.includes(d)));
    m.planted = sim.planted.map((p) => {
      const by: ("checks" | "judge")[] = [];
      if (p.type === "changed-number") {
        const [original, changed] = p.detail.split(" → ") as [string, string];
        if (checks.missingValues.includes(original) || newNumbers(changed)) by.push("checks");
        if (j?.sentences.some((s) => s.verdict === "distorted" || s.verdict === "unsupported")) by.push("judge");
      } else if (p.type === "dropped-qualifier") {
        if (j?.qualifiers.some((q) => q.verdict === "dropped" || q.verdict === "weakened")) by.push("judge");
      } else {
        if (newNumbers(p.detail)) by.push("checks");
        const i = idx(p.detail);
        if (i >= 0 && j?.sentences.find((s) => s.id === `s${i + 1}`)?.verdict === "unsupported") by.push("judge");
      }
      return { ...p, caught: by.length > 0, by };
    });
  }

  const f = m.failures;
  const fail = (cond: boolean, why: string) => {
    if (cond) f.push(why);
    return !cond;
  };
  const gates = [
    fail(level === "naermere" && checks.missingValues.length > 0, `values missing: ${checks.missingValues.join(", ")}`),
    fail(checks.addedNumbers.length > 0, `numbers not in source: ${checks.addedNumbers.join(", ")}`),
    fail(checks.lixPass === false, `LIX without terms ${checks.lixAdjusted.output} (source ${checks.lixAdjusted.source})`),
    fail(checks.wrongVariantWords.length > 0, `wrong written standard: ${checks.wrongVariantWords.join(", ")}`),
  ];
  if (checks.unlinkedSentences) f.push(`${checks.unlinkedSentences} sentence(s) without a valid source link`);
  if (j) {
    const bad = (m.distorted ?? 0) + (m.unsupported ?? 0);
    const facts = level === "lettere" ? m.coreFacts! : m.facts!;
    const label = level === "lettere" ? "main points" : "key facts";
    gates.push(
      fail(bad > 1, `${bad} distorted or unsupported sentences (max 1)`),
      fail((m.facts?.distorted ?? 0) > 0, `${m.facts?.distorted} key fact(s) distorted`),
      fail(facts.total > 0 && facts.present / facts.total < 0.95, `${label} ${facts.present}/${facts.total}`),
      fail(!!m.tasksAnswered, `answers a task: ${j.tasks.note}`),
      fail(!!m.tasksDropped, `drops a task: ${j.tasks.note}`),
      fail(!!m.misleadingOmission, `misleading omission: ${j.omissions.note}`),
    );
    m.pass = gates.every(Boolean);
  }
  return m;
}
