import { describe, expect, it } from 'vitest';
import { renderInline, stripMarkdown } from './markdown';

describe('renderInline', () => {
  it('renders emphasis and code', () => {
    expect(renderInline('Et **storyboard** er *en plan* med `CO2`.'))
      .toBe('Et <strong>storyboard</strong> er <em>en plan</em> med <code>CO2</code>.');
  });
  it('escapes raw HTML instead of passing it through', () => {
    const html = renderInline('<img src=x onerror=alert(1)> og <script>x()</script>');
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<script');
  });
  it('opens links safely and blocks javascript: URLs', () => {
    expect(renderInline('[NDLA](https://ndla.no)')).toContain('rel="noopener noreferrer"');
    expect(renderInline('[x](javascript:alert(1))')).not.toContain('<a');
  });
  it('leaves plain text, and text with stray symbols, alone', () => {
    expect(renderInline('Vann koker ved 100 °C.')).toBe('Vann koker ved 100 °C.');
  });
});

describe('stripMarkdown', () => {
  it('removes marks but keeps the words', () => {
    expect(stripMarkdown('Et **storyboard** er [en plan](https://x.no).')).toBe('Et storyboard er en plan.');
  });
});

import { plainTitle, renderMarkdown } from './markdown';
describe('plainTitle', () => {
  it('drops heading, emphasis and list marks', () => {
    expect(plainTitle('**Grunnleggende videoproduksjon**')).toBe('Grunnleggende videoproduksjon');
    expect(plainTitle('### 1. De tre fasene')).toBe('1. De tre fasene');
    expect(plainTitle('* Fotosyntese')).toBe('Fotosyntese');
  });
});
describe('renderMarkdown', () => {
  it('renders headings and lists, and never raw HTML', () => {
    const html = renderMarkdown('### Tittel\n\n* **a**\n* b\n\n<script>x()</script>');
    expect(html).toContain('<h3>Tittel</h3>');
    expect(html).toContain('<li><strong>a</strong></li>');
    expect(html).not.toContain('<script');
  });
});
