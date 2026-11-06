/**
 * Source blocks: the units 001 hands to 002 (FR-010/FR-011). Every simplified sentence must link to
 * at least one block (002 FR-002). Here a block is one Markdown block of expected-clean.md.
 */
export interface SourceBlock {
  id: string;
  kind: "heading" | "paragraph" | "list-item" | "table" | "quote";
  text: string;
}

export function toBlocks(clean: string): SourceBlock[] {
  return clean
    .split(/\n\s*\n/)
    .map((b) => b.trim())
    .filter(Boolean)
    .map((text, i) => ({
      id: `b${i + 1}`,
      kind: /^#{1,6} /.test(text)
        ? "heading"
        : /^- /.test(text)
          ? "list-item"
          : /^\|/.test(text)
            ? "table"
            : /^> /.test(text)
              ? "quote"
              : "paragraph",
      text,
    }));
}

/** The blocks as the model sees them: one per line group, tagged with its id. */
export function renderBlocks(blocks: SourceBlock[]): string {
  return blocks.map((b) => `<block id="${b.id}" kind="${b.kind}">\n${b.text}\n</block>`).join("\n");
}

const wordCount = (s: string) => (s.match(/[\p{L}\p{N}]+/gu) ?? []).length;

/**
 * Split a long text into parts of about `maxWords` words, at headings, so the parts can be simplified in
 * parallel and the first one shown early. A section (a heading and the blocks up to the next heading) is
 * never split; a heading with no text of its own stays with the section after it. A text of up to
 * 1.5 × maxWords stays whole, so short texts get one call.
 */
export function toParts(blocks: SourceBlock[], maxWords: number): SourceBlock[][] {
  const total = blocks.reduce((n, b) => n + wordCount(b.text), 0);
  if (maxWords <= 0 || total <= maxWords * 1.5) return [blocks];
  const sections: SourceBlock[][] = [];
  for (const b of blocks) {
    const last = sections.at(-1);
    const lastHasBody = last?.some((x) => x.kind !== "heading");
    if (b.kind === "heading" && (!last || lastHasBody)) sections.push([b]);
    else if (last) last.push(b);
    else sections.push([b]);
  }
  const parts: SourceBlock[][] = [];
  let words = 0;
  for (const s of sections) {
    const w = s.reduce((n, b) => n + wordCount(b.text), 0);
    if (parts.length && words + w <= maxWords) {
      parts.at(-1)!.push(...s);
      words += w;
    } else {
      parts.push([...s]);
      words = w;
    }
  }
  return parts;
}
