import { describe, expect, it } from 'vitest';
import { groupSentences, wordCount } from './layout';

describe('groupSentences', () => {
  it('keeps consecutive tasks together and drops their own numbering', () => {
    const blocks = groupSentences([
      { text: 'Oppgaver', kind: 'heading' },
      { text: '1. Hva er et storyboard?', kind: 'task' },
      { text: '2) Nevn tre bildeutsnitt.', kind: 'task' }
    ]);
    expect(blocks).toEqual([
      { type: 'heading', text: 'Oppgaver' },
      { type: 'tasks', items: ['Hva er et storyboard?', 'Nevn tre bildeutsnitt.'] }
    ]);
  });
  it('groups list items and separates lists broken by other sentences', () => {
    const blocks = groupSentences([
      { text: 'a', kind: 'list-item' }, { text: 'b', kind: 'list-item' },
      { text: 'Vanlig', kind: 'statement' }, { text: 'c', kind: 'list-item' }
    ]);
    expect(blocks.map((b) => b.type)).toEqual(['list', 'paragraph', 'list']);
    expect(blocks[0]).toEqual({ type: 'list', items: ['a', 'b'] });
  });
  it('counts words', () => { expect(wordCount([{ text: 'Én to tre.', kind: 'statement' }])).toBe(3); });
});
