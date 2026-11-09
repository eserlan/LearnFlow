import MarkdownIt from 'markdown-it';

// Raw HTML is disabled, so the output only contains tags markdown-it itself generates, and
// markdown-it refuses javascript:, vbscript: and most data: URLs. No extra sanitiser is needed.
const md = new MarkdownIt({ html: false, linkify: false, breaks: false, typographer: false });

const defaultLink = md.renderer.rules.link_open ??
  ((tokens, idx, options, _env, self) => self.renderToken(tokens, idx, options));
md.renderer.rules.link_open = (tokens, idx, options, env, self) => {
  tokens[idx].attrSet('target', '_blank');
  tokens[idx].attrSet('rel', 'noopener noreferrer');
  return defaultLink(tokens, idx, options, env, self);
};

/** One sentence of lesson text as safe inline HTML: **bold**, *italic*, `code`, [links](https://…). */
export function renderInline(text: string): string {
  return md.renderInline(text);
}

/** The same text without markdown marks, for narration and other plain-text uses. */
export function stripMarkdown(text: string): string {
  const tokens = md.parseInline(text, {})[0]?.children ?? [];
  return tokens
    .map((token) => (token.type === 'text' || token.type === 'code_inline' ? token.content
      : token.type === 'softbreak' || token.type === 'hardbreak' ? ' ' : ''))
    .join('');
}

/** Whole source text as safe block HTML (headings, lists, emphasis, rules). Same engine, raw HTML off. */
export function renderMarkdown(text: string): string {
  return md.render(text);
}

/** A readable one-line title from the first line of a pasted text: no #, >, list marks or emphasis marks. */
export function plainTitle(line: string): string {
  const bare = line.trim().replace(/^(?:#{1,6}|>|[-*+]|\d+[.)])\s+/, '');
  return stripMarkdown(bare).trim();
}
