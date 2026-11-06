/**
 * Deterministic checks (ADR-0001 decision 5, first layer). Free, fast and exact; the judge covers
 * what needs reading comprehension.
 */
import type { SourceBlock } from "./blocks.ts";
import type { GoldenItem, Language } from "./schema.ts";
import type { SimplifiedOutput } from "./simplify.ts";

const squash = (s: string) => s.replace(/\s+/g, " ").trim();

/**
 * LIX = words per sentence + percentage of words longer than six letters.
 *
 * With `protectedTerms`, a long word that is one of the item's subject terms or must-preserve values (or an
 * inflection or compound starting with one) does not count as long. The simplified text must keep those
 * words, so counting them would penalise faithfulness: shorter texts are left with mostly terms. This
 * adjusted LIX is the SC-004 gate; the plain one is reported next to it.
 */
export function lix(text: string, protectedTerms: string[] = []): number | null {
  const body = text.replace(/^#{1,6} .*$/gm, "").replace(/^[->] /gm, "");
  const words = body.match(/[\p{L}\p{N}]+(?:[-'’][\p{L}\p{N}]+)*/gu) ?? [];
  if (words.length === 0) return null;
  // A sentence ends at . ! ? : or a line break (list items and headings count as sentences).
  const sentences = Math.max(1, body.split(/[.!?:]+(?=\s|$)|\n+/).filter((s) => /[\p{L}\p{N}]/u.test(s)).length);
  const stems = termStems(protectedTerms);
  const isLong = (w: string) => [...w.replace(/[-'’]/g, "")].length > 6;
  const isProtected = (w: string) => {
    const l = w.toLowerCase();
    return stems.some((st) => l.startsWith(st));
  };
  const long = words.filter((w) => isLong(w) && !isProtected(w)).length;
  return Math.round((words.length / sentences + (100 * long) / words.length) * 10) / 10;
}

/** Stems of the long words in a list of terms: lower case, without a common Norwegian or English ending. */
function termStems(terms: string[]): string[] {
  const words = terms.flatMap((t) => t.toLowerCase().match(/\p{L}+/gu) ?? []).filter((w) => [...w].length > 6);
  return [...new Set(words.map((w) => w.replace(/(ene|ane|ar|er|en|et|a|ne|n|s|e)$/u, "")).filter((w) => [...w].length >= 6))];
}

/**
 * SC-004 floor for the adjusted LIX. The spec's 35 was set for plain LIX; leaving out the protected terms
 * lowers scores by 3–15 points. Set to 30 by the product owner (2026-11-06). Sources that already score
 * under 30 without terms (three dev items) pass with no simplification; the judge and length measures
 * still show whether they were simplified. Provisional: tune with teachers.
 */
export const LIX_FLOOR = 30;

/** Numbers as written, normalised so "40,000", "40 000" and "40000" compare equal. */
function numbers(text: string): string[] {
  return (text.match(/\d+(?:[ ,.]\d{3})*(?:[.,]\d+)?/g) ?? []).map((n) => n.replace(/(?<=\d)[ ,.](?=\d{3}\b)/g, ""));
}

/**
 * Words that exist in one written standard but not the other. A handful is enough to catch an output
 * that slides into the wrong one (002 FR-008); it is a signal, not a full grammar check.
 */
const ONLY_NB = ["ikke", "hva", "hvordan", "hvorfor", "hvilke", "hvilken", "hvem", "noe", "noen", "mye", "fra", "bare", "hvert", "dere", "meget"];
const ONLY_NN = ["ikkje", "kva", "korleis", "kvifor", "kven", "eit", "berre", "frå", "mykje", "nokon", "noko", "dykk", "kvart"];

function wrongVariantWords(text: string, language: Language): string[] {
  const wrong = language === "nn" ? ONLY_NB : language === "nb" ? ONLY_NN : [];
  const words = text.toLowerCase().match(/\p{L}+/gu) ?? [];
  return [...new Set(words.filter((w) => wrong.includes(w)))];
}

/** A term counts as present if it, or its stem without a definite/plural ending, appears. */
function hasTerm(haystackLower: string, term: string): boolean {
  const t = term.toLowerCase();
  if (haystackLower.includes(t)) return true;
  const stem = t.replace(/(ene|ane|ar|er|en|et|a|ne|n)$/u, "");
  return stem.length >= 5 && stem !== t && haystackLower.includes(stem);
}

export interface CheckResult {
  sentences: number;
  /** must-preserve values missing from the output (002 FR-004, SC-002). */
  missingValues: string[];
  /** Numbers in the output that are not in the source (002 FR-003). */
  addedNumbers: string[];
  /** Key terms not found in the output. */
  missingTerms: string[];
  /** Sentences without a valid source link (002 FR-002). */
  unlinkedSentences: number;
  lixSource: number | null;
  lixOutput: number | null;
  /** SC-004 at level "lettere": adjusted LIX ≤ max(adjusted source − 10, LIX_FLOOR). Null if not applicable. */
  lixPass: boolean | null;
  /** LIX without the item's protected terms counted as long words; this is what lixPass uses. */
  lixAdjusted: { source: number | null; output: number | null };
  wrongVariantWords: string[];
  /** Words in the output count added help, but not headings (that are new or copied). */
  words: { source: number; output: number };
  /** Bite size: output words (without headings and added help) / source words. */
  lengthRatio: number;
  /** Mean words per sentence, without headings and added help. */
  wordsPerSentence: number | null;
  /** The most sentences under one heading, without added help. */
  maxSectionSentences: number;
}

function sectionSizes(out: SimplifiedOutput): number[] {
  const sizes = [0];
  for (const x of out.sentences) {
    if (x.kind === "heading") sizes.push(0);
    else if (x.kind !== "added-help") sizes[sizes.length - 1]!++;
  }
  return sizes;
}

export function runChecks(
  item: GoldenItem,
  clean: string,
  blocks: SourceBlock[],
  out: SimplifiedOutput,
  level: "lettere" | "naermere",
): CheckResult {
  const text = squash(out.sentences.map((s) => s.text).join("\n"));
  // Lowercase only the first character of each sentence, so "Lava" at a sentence start matches "lava".
  const textCaseFolded = squash(out.sentences.map((s) => s.text.charAt(0).toLowerCase() + s.text.slice(1)).join(" "));
  const sourceNums = new Set(numbers(clean));
  const ids = new Set(blocks.map((b) => b.id));
  const lixSource = lix(clean);
  const outputText = out.sentences.filter((s) => s.kind !== "heading").map((s) => s.text).join("\n");
  const lixOutput = lix(outputText);
  const protectedTerms = [...item.annotations.keyTerms.map((t) => t.term), ...item.annotations.mustPreserve.map((m) => m.value)];
  const adj = { source: lix(clean, protectedTerms), output: lix(outputText, protectedTerms) };
  const count = (s: string) => (s.match(/[\p{L}\p{N}]+/gu) ?? []).length;

  const content = out.sentences.filter((x) => x.kind !== "heading" && x.kind !== "added-help");
  const sum = <T>(xs: T[], f: (x: T) => number) => xs.reduce((a, x) => a + f(x), 0);

  const present = (v: string) => text.includes(v) || textCaseFolded.includes(v.charAt(0).toLowerCase() + v.slice(1));

  return {
    sentences: out.sentences.length,
    missingValues: item.annotations.mustPreserve.map((m) => m.value).filter((v) => !present(v)),
    addedNumbers: [...new Set(numbers(text).filter((n) => !sourceNums.has(n)))],
    missingTerms: item.annotations.keyTerms.map((t) => t.term).filter((t) => !hasTerm(text.toLowerCase(), t)),
    unlinkedSentences: out.sentences.filter((s) => s.sources.length === 0 || s.sources.some((id) => !ids.has(id))).length,
    lixSource,
    lixOutput,
    // Not gated on exercise pages: most of their text is tasks, which must stay in full (002 FR-011, SC-004).
    lixPass:
      level === "lettere" && item.contentType !== "exercises" && adj.source !== null && adj.output !== null
        ? adj.output <= Math.max(adj.source - 10, LIX_FLOOR)
        : null,
    lixAdjusted: adj,
    wrongVariantWords: wrongVariantWords(text, item.language),
    words: { source: count(clean), output: count(text) },
    lengthRatio: count(content.map((x) => x.text).join(" ")) / Math.max(1, count(clean)),
    wordsPerSentence: content.length ? Math.round((10 * sum(content, (x) => count(x.text))) / content.length) / 10 : null,
    maxSectionSentences: Math.max(0, ...sectionSizes(out)),
  };
}
