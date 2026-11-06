/**
 * Simplification (spec 002) as the app would do it: source blocks in, linked simplified sentences out.
 * This is the prototype of the app's /api/simplify call; keep it free of eval-only logic so it can move.
 */
import { z } from "zod/v4";
import { renderBlocks, type SourceBlock } from "./blocks.ts";
import type { Config, ModelConfig } from "./configs.ts";
import { structuredCall, type CallOptions, type Usage } from "./llm.ts";
import type { GoldenItem, Language } from "./schema.ts";

/** Bump when the prompt or schema changes, so results from different prompts are never mixed. */
export const PROMPT_VERSION = "simplify-v4";

export type Level = "lettere" | "naermere";

export const SentenceKind = z.enum(["heading", "statement", "list-item", "task", "quote", "added-help"]);

export const SimplifiedOutput = z.object({
  sentences: z.array(
    z.object({
      text: z.string(),
      kind: SentenceKind,
      /** Ids of the source blocks this sentence comes from (002 FR-002). */
      sources: z.array(z.string()),
    }),
  ),
});
export type SimplifiedOutput = z.infer<typeof SimplifiedOutput>;
export type Sentence = SimplifiedOutput["sentences"][number];

const PROMPT_BASE = `You simplify school texts for LearnFlow, an app for pupils aged 10 to 16 who find long or difficult texts hard to read: for example pupils with dyslexia or a language disorder, or pupils still learning Norwegian. The pupil has pasted a text from their own school material. They will read your version and hear it read aloud, often with no teacher nearby, so they cannot check it against the original.

Your job is to make the text easy to take in, in small pieces. You may leave things out; you may not change what the source says. A shorter text that leaves out a detail is fine. A text that states something wrong teaches the pupil something wrong.

Rules:
1. Say only what the source says. Do not add facts, numbers, names, dates, causes, examples or conclusions, even true ones. If a passage is unclear or incomplete, keep it so rather than guessing.
2. Whatever you keep stays correct: numbers, units, dates, names, formulas and subject terms exactly as written (CO₂ stays CO₂, 20–25 °C stays 20–25 °C). Never make a number vague: if you keep a claim with a number ("rose by fifty percent"), keep the number; otherwise leave the claim out, rather than writing "a lot" or "sharply". Do not correct names or spellings you think are wrong.
3. Keep the hedge or limit on every claim you keep. Look for words like "most", "often", "usually", "relatively", "probably", "about", "can", "some", "in our region", "directly or indirectly", "not … in any of the cases", and their Norwegian forms ("de fleste", "ofte", "som regel", "relativt", "trolig", "omtrent", "kan", "noen/nokre", "i våre områder"). Dropping one turns a partial claim into a universal one: "relativt kort tid" must not become "kort tid". Keep analogies marked as analogies.
4. Keep beliefs, opinions and disputed claims attributed to whoever holds them ("the author thinks…", "in Hindu belief…", "some researchers claim…", "Luther meant…", "historikere mener…", "ifølge kyrkja…"). If you keep the claim, keep who holds it, in every sentence that states it, even when you split a long sentence. Never state a belief as a fact.
5. Do not leave something out if that makes what remains misleading: keep both sides of a contrast or comparison, an exception that limits a rule, and the source's framing of sensitive topics.
6. Never merge two facts or two list items into one sentence if that mixes them up. Each fact you keep keeps its own content.
7. Subject terms (the words the pupil is learning, like "fotosyntese", "demokrati", "brøk") stay in the parts you keep. Explain them where that helps, preferring the source's own definition. An explanation that is not in the source is added help: give it its own sentence with kind "added-help", right after the sentence where the term first appears, short, correct and suitable for children.
8. Tasks and questions (exercises, "Tenk etter", discussion questions) are instructions for the pupil, not things for you to answer. Keep every task, in order, and make the instruction short and easy to understand; you may shorten the text a task builds on. Never answer a task, hint at the answer, or explain a term that the task asks the pupil to explain. Use kind "task".
9. Copy quotations, poems and other literary text exactly, with kind "quote". You may explain around them.
10. Write in the same language and written standard as the source: Bokmål stays Bokmål, Nynorsk stays Nynorsk with no Bokmål forms, English stays English.
11. References to things that are not in the text, such as a video, a link or an image, may be left out, unless a task depends on them: then keep the instruction ("Se videoen", "Watch the video"), shortened, so the task still makes sense. Never describe what they contain.
12. Follow the source's order. Headings are sentences of kind "heading"; list items are kind "list-item"; everything else is "statement".

Every sentence lists the ids of the source blocks it comes from, usually one. Added help links to the block where the term appears.

Before you answer, compare each sentence you wrote with the source sentence it comes from: the same hedge, the same negation, the same numbers, the same subject, and the same "who thinks so". Fix any that differ.`;

const LEVEL_PROMPT: Record<Level, string> = {
  lettere: `Level: much easier ("lettere"). Give the main points in bite-sized pieces.

- Keep what a teacher would expect every pupil to take away. Leave out examples, side remarks, repetition and secondary detail.
- Length: for a text of several paragraphs, aim for about a third of the source's words, and never more than half. Short texts shrink less.
- Sections: at most 4 sentences each, each under a short heading that only names what the part is about. You may split a long section into several. Start each section with its main point.
- Sentences: one idea each, no sentence over 12 words. Split until it fits. Active voice.
- Words: use common everyday words. Replace hard words that are not subject terms with everyday ones, or leave them out (e.g. "benytte" becomes "bruke", "betydelig" becomes "stor"). Subject terms stay, as rule 7 says.

A short example, invented for illustration (kinds in brackets):

Source:
## Bienes arbeid
Honningbier lever i store samfunn der hver bie har sin oppgave. De fleste biene i et bol er arbeidere, og de samler nektar og pollen fra blomster. Når biene flyr fra blomst til blomst, fører de med seg pollen, og dette er nødvendig for at mange planter skal kunne danne frø og frukt. Forskere anslår at omtrent en tredjedel av maten vi spiser, er avhengig av slik pollinering. I mange land har antallet bier gått ned de siste tiårene, men årsakene er fortsatt omdiskutert.

Simplified:
[heading] Bier lever sammen
[statement] Honningbier lever i store samfunn.
[statement] De fleste biene er arbeidere.
[statement] De samler nektar og pollen fra blomster.
[heading] Bier hjelper plantene
[statement] Biene bærer pollen fra blomst til blomst.
[added-help] Pollen er et fint støv som blomstene lager.
[statement] Mange planter trenger det for å lage frø og frukt.
[statement] Forskere regner med at omtrent en tredjedel av maten vår trenger pollinering.
[heading] Færre bier
[statement] I mange land er det blitt færre bier.
[statement] Det er fortsatt uenighet om hvorfor.

Left out: "hver bie har sin oppgave", "i et bol", "de siste tiårene". Kept: the hedges "de fleste", "mange planter", "anslår … omtrent" (as "regner med … omtrent"), and "omdiskutert" (as "uenighet").`,
  naermere: `Level: closer to the original ("naermere"). Keep every detail and most of the original wording. Use shorter sentences and simpler words where that helps, and keep the source's sections.`,
};

/** The system prompt for one level: shared rules, then only that level's instructions. */
export function systemPrompt(level: Level): string {
  return `${PROMPT_BASE}\n\n${LEVEL_PROMPT[level]}`;
}

const LANGUAGE_NAME: Record<Language, string> = { nb: "Norwegian Bokmål", nn: "Norwegian Nynorsk", en: "English" };

export function userMessage(blocks: SourceBlock[], language: Language, level: Level): string {
  return `Level: ${level}\nSource language: ${LANGUAGE_NAME[language]}\n\n<source>\n${renderBlocks(blocks)}\n</source>`;
}

export interface SimplifyResult {
  output: SimplifiedOutput;
  /** For model configs: what the call reported. */
  call?: {
    requestedModel: string;
    servedModel: string;
    effort: string;
    usage: Usage;
    costUsd: number | null;
    stopReason: string | null;
    inferenceGeo: string | null;
    latencyMs: number;
    system: string;
    user: string;
  };
  /** For the seeded config: the errors that were planted, so the report can check they were caught. */
  planted?: { type: "changed-number" | "dropped-qualifier" | "invented-sentence"; detail: string }[];
}

export type { CallOptions };

async function callModel(cfg: ModelConfig, blocks: SourceBlock[], language: Language, level: Level, opts: CallOptions) {
  const user = userMessage(blocks, language, level);
  const system = systemPrompt(level);
  const res = await structuredCall(cfg, system, user, SimplifiedOutput, 16000, opts);
  return {
    output: res.output ?? { sentences: [] },
    parsed: res.output !== null,
    call: {
      requestedModel: cfg.model,
      servedModel: res.servedModel,
      effort: cfg.effort,
      usage: res.usage,
      costUsd: res.costUsd,
      stopReason: res.stopReason,
      inferenceGeo: res.inferenceGeo,
      latencyMs: res.latencyMs,
      system,
      user,
    },
  };
}

const stripMarkers = (s: string) => s.replace(/^#{1,6} /, "").replace(/^[->] /, "");

function identity(blocks: SourceBlock[]): SimplifiedOutput {
  const kind = { heading: "heading", "list-item": "list-item", quote: "quote", table: "statement", paragraph: "statement" } as const;
  return { sentences: blocks.map((b) => ({ text: stripMarkers(b.text), kind: kind[b.kind], sources: [b.id] })) };
}

/** An invented conclusion with no numbers in it, so only the judge can catch it (002 FR-003). */
const INVENTED: Record<Language, string> = {
  nb: "Forskere er derfor enige om at dette er den viktigste årsaken.",
  nn: "Forskarar er difor samde om at dette er den viktigaste årsaka.",
  en: "Scientists therefore agree that this is the most important cause.",
};

/** Identity with three planted errors. Each is recorded so the report can check it was caught. */
function seeded(blocks: SourceBlock[], item: GoldenItem): Required<Pick<SimplifyResult, "output" | "planted">> {
  const out = identity(blocks);
  const planted: NonNullable<SimplifyResult["planted"]> = [];
  const s = out.sentences;

  const num = item.annotations.mustPreserve.find((m) => (m.kind === "number" || m.kind === "date") && /\d/.test(m.value));
  const target = num && s.find((x) => x.text.includes(num.value));
  if (num && target) {
    const changed = num.value.replace(/\d+/, (d) => String(Number(d) + 1));
    target.text = target.text.replace(num.value, changed);
    planted.push({ type: "changed-number", detail: `${num.value} → ${changed}` });
  }
  // Only a hedge that appears once and is a small part of its sentence: removing a whole sentence, or one
  // of two copies, plants nothing the judge could see.
  const count = (quote: string) => s.reduce((n, y) => n + y.text.split(quote).length - 1, 0);
  const q = item.annotations.qualifiers.find((x) => {
    const t = s.find((y) => y.text.includes(x.quote));
    const sentence = t?.text.split(/(?<=[.!?])\s+/).find((z) => z.includes(x.quote));
    return sentence && count(x.quote) === 1 && x.quote.length <= sentence.length / 2;
  });
  if (q) {
    const t = s.find((y) => y.text.includes(q.quote))!;
    t.text = t.text.replace(q.quote, "").replace(/\s{2,}/g, " ").trim();
    planted.push({ type: "dropped-qualifier", detail: q.quote });
  }
  const at = s.findIndex((x) => x.kind === "statement");
  if (at >= 0) {
    s.splice(at + 1, 0, { text: INVENTED[item.language], kind: "statement", sources: s[at]!.sources });
    planted.push({ type: "invented-sentence", detail: INVENTED[item.language] });
  }
  return { output: out, planted };
}

export async function simplify(
  cfg: Config,
  item: GoldenItem,
  blocks: SourceBlock[],
  level: Level,
  opts: CallOptions,
): Promise<SimplifyResult & { parsed: boolean }> {
  if (cfg.kind === "pseudo") {
    if (cfg.id === "identity") return { output: identity(blocks), parsed: true };
    if (cfg.id === "empty") return { output: { sentences: [] }, parsed: true };
    return { ...seeded(blocks, item), parsed: true };
  }
  return callModel(cfg, blocks, item.language, level, opts);
}

/** The simplified text as the pupil would read it, as Markdown. */
export function renderOutput(out: SimplifiedOutput): string {
  const lines: string[] = [];
  let prev: Sentence["kind"] | null = null;
  for (const s of out.sentences) {
    if (s.kind === "heading") lines.push(`\n## ${s.text}\n`);
    else if (s.kind === "list-item") lines.push(`- ${s.text}`);
    else if (s.kind === "added-help") lines.push(`  *[Forklaring] ${s.text}*`);
    else if (s.kind === "quote") lines.push(`> ${s.text}`);
    else lines.push(prev === "list-item" ? `\n${s.text}` : s.text);
    prev = s.kind;
  }
  return lines.join("\n").replace(/\n{3,}/g, "\n\n").trim() + "\n";
}
