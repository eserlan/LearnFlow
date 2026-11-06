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
