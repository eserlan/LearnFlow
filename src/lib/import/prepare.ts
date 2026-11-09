import type { ClipboardInput, Language, SourceBlock } from './types';
import { plainTitle } from '../markdown';

export interface PreparedSource {
	blocks: SourceBlock[];
	plainText: string;
	html?: string;
	wordCount: number;
	language: Language;
	title: string;
	needsSectionChoice: boolean;
	warnings: string[];
}

function countWords(text: string): number {
	return (text.match(/[\p{L}\p{N}]+(?:['’][\p{L}\p{N}]+)*/gu) ?? []).length;
}

/** Validate and retain clipboard input; cleanup, segmentation, and language decisions belong to Flash. */
export function prepareSource(input: ClipboardInput): PreparedSource {
	if (!input.plainText.trim()) throw new Error('No text found. Copy some text, then try again.');

	const block: SourceBlock = {
		id: crypto.randomUUID(),
		type: 'paragraph',
		text: input.plainText,
		language: 'uncertain',
		spans: [{ representation: 'text/plain', start: 0, end: input.plainText.length }],
		included: true
	};
	const words = countWords(input.plainText);

	return {
		blocks: [block],
		plainText: input.plainText,
		...(input.html ? { html: input.html } : {}),
		wordCount: words,
		language: 'uncertain',
		title: plainTitle(input.plainText.split(/\r\n|\r|\n/).find((line) => line.trim()) ?? '') || 'Untitled lesson',
		needsSectionChoice: words > 2000,
		warnings: words < 30 ? ['This is a short text. There may not be much to simplify.'] : []
	};
}
