/**
 * Composition targets for the golden data set (about 48 items). The coverage report compares the
 * committed items against these. Targets are minimums, not exact counts.
 */
export const TARGET_TOTAL = 48;

export const targets = {
  language: { nb: 26, nn: 14, en: 8 },
  gradeBand: { "5-7": 14, "8-10": 20, vg: 8 },
  subject: {
    naturfag: 8,
    samfunnsfag: 6,
    historie: 6,
    geografi: 4,
    krle: 4,
    norsk: 4,
    engelsk: 6,
    matematikk: 3,
    helse: 3,
  },
  contentType: { expository: 30, narrative: 6, literary: 3, exercises: 3, mixed: 4 },
  features: {
    notation: 6,
    table: 4,
    "dates-sequence": 6,
    qualifiers: 8,
    lists: 8,
    exercises: 4,
    "literary-quote": 3,
    "very-short": 2,
    "near-limit": 3,
    "fact-box": 4,
  },
  sourceType: { ndla: 20, "teacher-written": 12, publisher: 8, web: 4, pdf: 4 },
  split: { test: 12 },
  reviewed: TARGET_TOTAL,
} as const;
