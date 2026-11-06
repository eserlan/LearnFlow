import { describe, expect, it } from 'vitest';
import { prepareSource } from '../prepare';

describe('paste preparation', () => {
	it('preserves plain text and rich HTML unchanged for Flash', () => {
		const plainText = 'First\r\nPage 4\r\nphoto-syn-\nthesis H2O';
		const html = '<h1>First</h1><p>Page 4</p><p>photo-syn-<br>thesis H<sub>2</sub>O</p>';
		const result = prepareSource({ plainText, html });

		expect(result.plainText).toBe(plainText);
		expect(result.html).toBe(html);
		expect(result.blocks).toHaveLength(1);
		expect(result.blocks[0].text).toBe(plainText);
		expect(result.blocks[0].spans).toEqual([{ representation: 'text/plain', start: 0, end: plainText.length }]);
		expect(result.language).toBe('uncertain');
	});

	it('counts without truncating and warns only for short text', () => {
		const text = Array.from({ length: 2001 }, () => 'word').join(' ');
		const result = prepareSource({ plainText: text });
		expect(result.wordCount).toBe(2001);
		expect(result.needsSectionChoice).toBe(true);
		expect(result.blocks[0].text).toBe(text);
		expect(prepareSource({ plainText: 'One two three' }).warnings.length).toBeGreaterThan(0);
		expect(() => prepareSource({ plainText: '  ' })).toThrow(/No text/);
	});
});
