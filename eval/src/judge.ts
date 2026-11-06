/**
 * The model check (ADR-0001 decision 5, second layer), here used as the eval's judge: one call per
 * output, blind to which config produced it. It reads the source, the annotations and the simplified
 * sentences, and returns a verdict per sentence, key fact, qualifier and expectation.
 */
import { z } from "zod/v4";
import { renderBlocks, type SourceBlock } from "./blocks.ts";
import type { ModelConfig } from "./configs.ts";
import { structuredCall, type CallOptions, type Usage } from "./llm.ts";
import type { GoldenItem } from "./schema.ts";
import type { Level, SimplifiedOutput } from "./simplify.ts";

export const JUDGE_VERSION = "judge-v4";

const note = z.string().describe("One short sentence saying what is wrong. Empty when the verdict is the good one.");

export const JudgeOutput = z.object({
  sentences: z.array(
    z.object({
      id: z.string(),
      verdict: z.enum(["supported", "distorted", "unsupported", "added-help-ok", "added-help-problem"]),
      note,
    }),
  ),
  keyFacts: z.array(z.object({ id: z.string(), verdict: z.enum(["present", "partial", "missing", "distorted"]), note })),
  qualifiers: z.array(z.object({ id: z.string(), verdict: z.enum(["kept", "weakened", "dropped", "not-applicable"]), note })),
  expectations: z.array(z.object({ id: z.string(), verdict: z.enum(["met", "violated", "not-applicable"]), note })),
  tasks: z.object({
    verdict: z.enum(["no-tasks", "not-answered", "answered"]),
    kept: z.enum(["no-tasks", "all", "some-dropped"]),
    note,
  }),
  omissions: z.object({ verdict: z.enum(["ok", "misleading"]), note }),
});
export type JudgeOutput = z.infer<typeof JudgeOutput>;

export const JUDGE_SYSTEM = `You check simplified school texts for faithfulness. A pupil aged 10 to 16 will read and listen to the simplified text instead of the source, with no teacher nearby, so any change of meaning teaches them something wrong. Be strict about meaning and relaxed about wording: shorter sentences, simpler words, splitting, merging, reordering within a section and new short headings that only name a part are all fine. Leaving content out is allowed too: the simplified text is meant to be shorter, so a missing detail is not a fault in itself.

You get the source as numbered blocks, the simplified text as numbered sentences (each with the ids of the source blocks it claims to come from, and a kind), and annotations written by a teacher. Give one verdict for every sentence, key fact, qualifier and expectation, using exactly the ids given.

Sentences:
- supported: everything it says is stated in the source or follows directly from it.
- distorted: based on the source but the meaning changed, e.g. a different number, name or date, a dropped hedge that makes a claim stronger, a belief stated as fact, a reversed or invented cause, a merged pair of facts that are now wrong together.
- unsupported: says something the source does not say. Explanations of terms that are not of kind "added-help" count here.
- added-help-ok: kind "added-help", correct, short, suitable for a child, and does not answer a task.
- added-help-problem: kind "added-help" but wrong, unsuitable, or it answers a task.
Judge each sentence against the whole source, not only its linked blocks.

Key facts: present (a pupil reading only the simplified text learns this fact correctly), partial (part of it is missing), missing, or distorted (it is there but wrong). Record what you see; whether a missing fact matters is decided elsewhere.
At level "lettere" the text is meant to leave out detail, and some key facts are marked as a main point with a short gist. Grade those against the gist: present if a pupil learns the gist correctly, even when details in the full statement (names, dates, lengths, examples) are missing; partial only if part of the gist is missing. A wrong detail that is kept is still distorted.

Qualifiers: kept (the hedge or limit is there, in any wording), weakened, dropped, or not-applicable (the whole claim it limits was left out; count that under key facts instead).

Expectations: met, violated, or not-applicable.

Tasks: verdict "answered" if the simplified text answers, hints at the answer to, or explains a term asked about in any task or question addressed to the pupil, when the source itself does not give that answer. A question the source answers itself (a rhetorical question followed by its answer, such as "Do these words sound familiar?" and then the explanation) is part of the text, not a task: keeping the source's answer is fine. "not-answered" if it has tasks and answers none; "no-tasks" if the source has none. Kept: "all" if every task and question for the pupil in the source is still there (shortened or reworded is fine), "some-dropped" if any is gone, "no-tasks" if the source has none. A question the source answers itself, and "Did you know…?" or "Have you ever…?" openers in fact boxes, are not tasks: dropping them is fine. A question that frames the whole text for the pupil to think about ("Which is more democratic?") is a task.

Omissions: "misleading" if something left out makes what remains wrong or misleading, e.g. one side of a contrast or comparison is gone, an exception that limits a rule is gone, or the framing of a sensitive topic is lost; otherwise "ok".`;

export function judgeMessage(item: GoldenItem, blocks: SourceBlock[], out: SimplifiedOutput, level: Level): string {
  const a = item.annotations;
  const sentences = out.sentences.length
    ? out.sentences.map((s, i) => `<sentence id="s${i + 1}" kind="${s.kind}" sources="${s.sources.join(",")}">${s.text}</sentence>`).join("\n")
    : "(the simplified text is empty)";
  const list = (xs: string[]) => (xs.length ? xs.join("\n") : "(none)");
  return [
    `Content type: ${item.contentType}. Language: ${item.language}. Level: ${level}.`,
    `<source>\n${renderBlocks(blocks)}\n</source>`,
    `<simplified>\n${sentences}\n</simplified>`,
    `<key_facts>\n${list(
      a.keyFacts.map((f) => `${f.id}: ${f.statement}${level === "lettere" && f.core && f.gist ? ` [main point; gist: ${f.gist}]` : ""} (source: "${f.sourceQuote}")`),
    )}\n</key_facts>`,
    `<qualifiers>\n${list(a.qualifiers.map((q, i) => `q${i + 1}: "${q.quote}"${q.note ? ` (${q.note})` : ""}`))}\n</qualifiers>`,
    `<expectations>\n${list(a.expectations.map((e, i) => `e${i + 1}: ${e}`))}\n</expectations>`,
  ].join("\n\n");
}

export interface JudgeResult {
  output: JudgeOutput | null;
  /** Ids the judge should have covered but did not. A non-empty list makes the grade incomplete. */
  missingIds: string[];
  call: {
    requestedModel: string;
    servedModel: string;
    effort: string;
    usage: Usage;
    costUsd: number | null;
    stopReason: string | null;
    latencyMs: number;
    user: string;
  };
}

export async function judge(
  cfg: ModelConfig,
  item: GoldenItem,
  blocks: SourceBlock[],
  out: SimplifiedOutput,
  level: Level,
  opts: CallOptions,
): Promise<JudgeResult> {
  const user = judgeMessage(item, blocks, out, level);
  const res = await structuredCall(cfg, JUDGE_SYSTEM, user, JudgeOutput, 32000, opts);
  const output = res.output;
  const want = [
    ...out.sentences.map((_, i) => `s${i + 1}`),
    ...item.annotations.keyFacts.map((f) => f.id),
    ...item.annotations.qualifiers.map((_, i) => `q${i + 1}`),
    ...item.annotations.expectations.map((_, i) => `e${i + 1}`),
  ];
  const got = new Set(output ? [...output.sentences, ...output.keyFacts, ...output.qualifiers, ...output.expectations].map((x) => x.id) : []);
  return {
    output,
    missingIds: want.filter((id) => !got.has(id)),
    call: {
      requestedModel: cfg.model,
      servedModel: res.servedModel,
      effort: cfg.effort,
      usage: res.usage,
      costUsd: res.costUsd,
      stopReason: res.stopReason,
      latencyMs: res.latencyMs,
      user,
    },
  };
}
