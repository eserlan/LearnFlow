import { parse, type HTMLElement, type Node, NodeType } from "node-html-parser";

/**
 * Turns article HTML into the three representations a golden item needs:
 *   html  – what a browser would put on the clipboard as text/html (images and embeds removed)
 *   text  – what it would put on the clipboard as text/plain (sub/sup flattened: CO2, x2)
 *   clean – the expected 001 output as Markdown (structure kept, sub/sup as Unicode: CO₂, x²)
 */

const SUB: Record<string, string> = {
  "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉",
  "+": "₊", "-": "₋", "−": "₋", "=": "₌", "(": "₍", ")": "₎",
};
const SUP: Record<string, string> = {
  "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹",
  "+": "⁺", "-": "⁻", "−": "⁻", "=": "⁼", "(": "⁽", ")": "⁾", n: "ⁿ", i: "ⁱ",
  // Authors often write the degree sign as a superscript o: 25 <sup>o</sup>C.
  o: "°", "°": "°",
};

/**
 * Map a sub/superscript run to Unicode. Trailing punctuation or spaces that authors often include
 * inside the tag ("CO<sub>2: </sub>") are kept as ordinary text. Returns null if a character in
 * the core has no Unicode form, so the caller can keep a visible marker instead.
 */
function toScript(text: string, map: Record<string, string>): string | null {
  const m = /^(.*?)([\s.,:;!?)]*)$/su.exec(text);
  const core = m?.[1] ?? text;
  const tail = m?.[2] ?? "";
  if (!core) return tail;
  let out = "";
  for (const ch of core) {
    const mapped = map[ch];
    if (mapped === undefined) return null;
    out += mapped;
  }
  return out + tail;
}

const BLOCK = new Set(["p", "h1", "h2", "h3", "h4", "h5", "h6", "li", "tr", "blockquote", "figcaption", "summary"]);
const DROP = new Set(["script", "style", "figure", "img", "video", "audio", "iframe", "math"]);

/** Remove images and media embeds; keep inline concept embeds as their text. */
export function cleanHtml(raw: string): HTMLElement {
  const root = parse(raw, { comment: false });
  for (const el of root.querySelectorAll("ndlaembed")) {
    const resource = el.getAttribute("data-resource");
    if (resource === "concept" || resource === "content-link" || resource === "footnote") {
      if (resource === "footnote") el.remove();
      else el.replaceWith(el.text);
    } else {
      el.remove();
    }
  }
  for (const tag of DROP) for (const el of root.querySelectorAll(tag)) el.remove();
  // Strip attributes: a real clipboard keeps few of them, and they add noise to diffs.
  for (const el of root.querySelectorAll("*")) {
    for (const name of Object.keys(el.attributes)) el.removeAttribute(name);
  }
  return root;
}

function inline(node: Node, mode: "text" | "clean"): string {
  if (node.nodeType === NodeType.TEXT_NODE) return node.text.replace(/\s+/g, " ");
  if (node.nodeType !== NodeType.ELEMENT_NODE) return "";
  const el = node as HTMLElement;
  const tag = el.tagName?.toLowerCase();
  const inner = el.childNodes.map((c) => inline(c, mode)).join("");
  if (tag === "br") return "\n";
  if (mode === "clean" && (tag === "sub" || tag === "sup")) {
    const mapped = toScript(inner.replace(/^\s+/, ""), tag === "sub" ? SUB : SUP);
    // No Unicode form available: keep a readable marker instead of silently flattening.
    return mapped ?? (tag === "sub" ? `_(${inner})` : `^(${inner})`);
  }
  return inner;
}

function tidy(s: string): string {
  return s.replace(/[ \t]+/g, " ").replace(/ *\n */g, "\n").trim();
}

/** Walk block structure and emit lines. */
function blocks(el: HTMLElement, mode: "text" | "clean", out: string[]): void {
  for (const child of el.childNodes) {
    if (child.nodeType === NodeType.TEXT_NODE) {
      const t = tidy(child.text);
      if (t) out.push(t);
      continue;
    }
    if (child.nodeType !== NodeType.ELEMENT_NODE) continue;
    const c = child as HTMLElement;
    const tag = c.tagName?.toLowerCase() ?? "";
    if (tag === "table") {
      emitTable(c, mode, out);
    } else if (/^h[1-6]$/.test(tag)) {
      const level = Math.max(2, Number(tag[1]));
      const t = tidy(inline(c, mode));
      if (t) out.push(mode === "clean" ? `${"#".repeat(level)} ${t}` : t);
    } else if (tag === "li") {
      const hasNestedBlocks = c.querySelector("p, ul, ol");
      if (hasNestedBlocks) {
        const sub: string[] = [];
        blocks(c, mode, sub);
        sub.forEach((line, i) => out.push(mode === "clean" && i === 0 ? `- ${line}` : line));
      } else {
        const t = tidy(inline(c, mode));
        if (t) out.push(mode === "clean" ? `- ${t}` : t);
      }
    } else if (BLOCK.has(tag)) {
      const t = tidy(inline(c, mode));
      if (t) out.push(mode === "clean" && tag === "blockquote" ? `> ${t}` : t);
    } else if (c.querySelector("p, h1, h2, h3, h4, h5, h6, li, table, div, section, aside")) {
      blocks(c, mode, out);
    } else {
      const t = tidy(inline(c, mode));
      if (t) out.push(t);
    }
  }
}

function emitTable(table: HTMLElement, mode: "text" | "clean", out: string[]): void {
  const rows = table.querySelectorAll("tr").map((tr) =>
    tr.querySelectorAll("th, td").map((cell) => tidy(inline(cell, mode)).replace(/\|/g, "\\|")),
  );
  if (rows.length === 0) return;
  // A table is one block: rows on consecutive lines.
  if (mode === "text") {
    out.push(rows.map((r) => r.join("\t")).join("\n"));
    return;
  }
  const width = Math.max(...rows.map((r) => r.length));
  const pad = (r: string[]) => [...r, ...Array(width - r.length).fill("")];
  const lines = [`| ${pad(rows[0]!).join(" | ")} |`, `| ${Array(width).fill("---").join(" | ")} |`];
  for (const r of rows.slice(1)) lines.push(`| ${pad(r).join(" | ")} |`);
  out.push(lines.join("\n"));
}

export interface Representations {
  html: string;
  text: string;
  clean: string;
  hasNotation: boolean;
  hasTable: boolean;
  hasList: boolean;
}

/** Headings of reference lists. They are page furniture (001 FR-010): pasted, but not simplified. */
const REFERENCE_HEADING = /^(kilder?|kjelder?|kildeliste|kjeldeliste|kildehenvisning(ar|er)?|referanser?|litteratur|litteraturliste|sources?|references?|bibliography)$/i;

/**
 * Remove what 001 should leave out of the text it hands to simplification: reference lists
 * (a <details> or heading-led section titled "Kilder" and similar).
 */
function dropPageFurniture(root: HTMLElement): void {
  for (const d of root.querySelectorAll("details")) {
    if (REFERENCE_HEADING.test(d.querySelector("summary")?.text.trim() ?? "")) d.remove();
  }
  for (const h of root.querySelectorAll("h2, h3, h4, h5, h6")) {
    if (!REFERENCE_HEADING.test(h.text.trim())) continue;
    const level = Number(h.tagName[1]);
    let next = h.nextElementSibling;
    while (next && !(/^H[1-6]$/.test(next.tagName) && Number(next.tagName[1]) <= level)) {
      const after = next.nextElementSibling;
      next.remove();
      next = after;
    }
    h.remove();
  }
}

/** Drop headings whose section is empty (typically because its body was an interactive embed). */
function dropEmptySections(lines: string[]): string[] {
  const level = (l: string) => /^(#{1,6}) /.exec(l)?.[1]?.length ?? 0;
  const keep = (ls: string[]) =>
    ls.filter((line, i) => {
      const own = level(line);
      if (!own) return true;
      const next = ls[i + 1];
      return next !== undefined && (level(next) === 0 || level(next) > own);
    });
  // Repeat: removing an empty subsection can leave its parent empty.
  let prev = lines;
  for (let cur = keep(prev); cur.length !== prev.length; cur = keep(prev = cur));
  return prev;
}

export function represent(rawHtml: string, title?: string): Representations {
  const root = cleanHtml(rawHtml);
  const cleanRoot = cleanHtml(rawHtml);
  dropPageFurniture(cleanRoot);
  const textLines: string[] = [];
  let cleanLines: string[] = [];
  blocks(root, "text", textLines);
  blocks(cleanRoot, "clean", cleanLines);
  cleanLines = dropEmptySections(cleanLines);
  if (title) {
    textLines.unshift(title);
    cleanLines.unshift(`# ${title}`);
  }
  const html = (title ? `<h1>${title}</h1>` : "") + root.toString().replace(/\s*\n\s*/g, "\n").trim();
  return {
    html,
    text: textLines.join("\n\n") + "\n",
    clean: cleanLines.join("\n\n") + "\n",
    hasNotation: root.querySelectorAll("sub, sup").length > 0,
    hasTable: root.querySelectorAll("table").length > 0,
    hasList: root.querySelectorAll("li").length > 0,
  };
}

/** Normalise text for quote matching: collapse whitespace, drop Markdown markers. */
export function normaliseForMatch(s: string): string {
  return s
    .replace(/^#{1,6} /gm, "")
    .replace(/^[->] /gm, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function wordCount(s: string): number {
  return normaliseForMatch(s).split(" ").filter((w) => /[\p{L}\p{N}]/u.test(w)).length;
}
