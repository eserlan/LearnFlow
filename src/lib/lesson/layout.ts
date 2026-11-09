/** Groups a lesson's flat sentence list into blocks the page can lay out: lists and worksheet tasks stay together. */
export type LessonSentence = { text: string; kind: string };
export type LessonBlock =
  | { type: 'heading' | 'paragraph' | 'quote'; text: string }
  | { type: 'tasks' | 'list'; items: string[] };

const NUMBERING = /^\s*\d+[.)]\s+/;

export function groupSentences(sentences: readonly LessonSentence[]): LessonBlock[] {
  const blocks: LessonBlock[] = [];
  for (const sentence of sentences) {
    const last = blocks[blocks.length - 1];
    if (sentence.kind === 'task') {
      const text = sentence.text.replace(NUMBERING, '');
      if (last?.type === 'tasks') last.items.push(text); else blocks.push({ type: 'tasks', items: [text] });
    } else if (sentence.kind === 'list-item') {
      if (last?.type === 'list') last.items.push(sentence.text); else blocks.push({ type: 'list', items: [sentence.text] });
    } else if (sentence.kind === 'heading') blocks.push({ type: 'heading', text: sentence.text });
    else if (sentence.kind === 'quote') blocks.push({ type: 'quote', text: sentence.text });
    else blocks.push({ type: 'paragraph', text: sentence.text });
  }
  return blocks;
}

export function wordCount(sentences: readonly LessonSentence[]): number {
  return sentences.reduce((n, s) => n + (s.text.match(/[\p{L}\p{N}]+/gu)?.length ?? 0), 0);
}
