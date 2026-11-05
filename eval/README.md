# LearnFlow evaluation: the golden data set

A small, hand-checked set of real school texts. We use it to choose the simplification model and effort
level (ADR-0001 leaves Gemini Flash 3.8 vs Flash Lite 3.5 open), and later to catch regressions in
paste clean-up (spec 001) and faithful simplification (spec 002).

The set answers one question per item: **did the simplified text keep everything that matters, and add
nothing?** (Constitution Principle I). Reading level is measured separately and automatically; the
annotations here are about faithfulness.

## Commands

Run from `eval/` (needs [bun](https://bun.sh)):

```sh
bun install
bun run import:ndla 38810 --lang nb --subject naturfag [--grade vg] [--split dev|test] [--force]
bun run validate        # schema, quotes found verbatim, ATTRIBUTION.md up to date; non-zero exit on errors
bun run coverage        # validate, then composition against the targets in src/targets.ts
bun run attribution     # regenerate golden/ATTRIBUTION.md after adding or changing items
bun run typecheck
```

## Layout

```text
eval/
  golden/
    items/<id>/              committed, openly licensed
      source.html            what the browser puts on the clipboard as text/html
      source.txt             what it puts on the clipboard as text/plain (CO2, x2)
      expected-clean.md      what 001 should hand to 002: structure kept, CO₂ and x² as Unicode
      item.yaml              metadata and annotations (schema: src/schema.ts)
    private/items/<id>/      gitignored; publisher texts we may test on but not publish
    ATTRIBUTION.md           generated; credits every committed item
  scripts/                   import-ndla.ts, validate.ts
  src/                       schema, HTML conversion, targets, attribution
```

Item ids are `<source>-<ref>-<lang>`, e.g. `ndla-38810-nb`. The same article in Bokmål and Nynorsk is two
items; that is deliberate, since the model may handle them differently.

### What `expected-clean.md` contains

It is the text after 001's clean-up, which is the input to 002 and the text that all annotation quotes are
checked against. The importer produces it; check it by eye before annotating. Rules:

- Headings, paragraphs, lists and tables keep their structure (Markdown).
- Simple notation becomes Unicode: CO₂, m², 25 °C (including `<sup>o</sup>` written as a degree sign).
  If a sub/superscript has no Unicode form it is kept as `_(x)` or `^(x)`, so it stays visible. Fix it
  by hand or leave it as a known hard case.
- Images, video, interactive tasks (H5P) and footnotes are gone. Headings whose section is now empty are
  dropped.
- Reference lists ("Kilder", "Kjelder", "Sources" …) are page furniture (001 FR-010) and are dropped.
  They stay in `source.html` and `source.txt`, because a real paste includes them.

## Annotating an item

Read `golden/items/ndla-38810-nb/item.yaml` first. It is the worked example (still a draft, waiting for
review).

Everything in `annotations` is written against `expected-clean.md`. Every quote must be copied exactly,
character for character, so the validator can find it. Line breaks, list dashes and `#` don't matter.

| Field | What it is | How many |
| --- | --- | --- |
| `keyFacts` | The claims a pupil must still be able to learn from the simplified text. `statement` is the fact in plain words; `sourceQuote` is the shortest exact quote that supports it. | 3–12, by importance |
| `keyTerms` | Subject words the simplified text must keep (and may explain), not replace. `sourceDefinition` is an exact quote where the source defines it, if it does. | 3–10 |
| `mustPreserve` | Exact strings that must appear unchanged: numbers, dates, names, units, formulas, terms. Kind is `number`, `date`, `name`, `unit`, `formula` or `term`. | all that matter |
| `qualifiers` | Hedges, limits and analogies that change the meaning if dropped ("direkte eller indirekte", "I våre områder", "nesten som"). `note` says what goes wrong without it. | all you find |
| `expectations` | Anything else, as one plain sentence each, e.g. "Exercise 3 is explained, not answered". These are read by the model check and by people. | as needed |

Guidelines:

- **Key facts are what a teacher would test.** Leave out side remarks and examples unless the example
  *is* the point. If you'd be unhappy to see it missing from the simplified text, it's a key fact.
- **Write statements at the simplified level**, in the item's language. They're the reference for "is
  this fact still there?", not a model answer.
- **Pick the shortest quote that proves the fact.** It only has to show where the fact comes from.
- **Qualifiers are the main thing to look for.** Simplification usually fails by dropping a hedge, so a
  partial claim becomes a universal one. Mark the item with the `qualifiers` feature when it has two or
  more that matter.
- **Exercises are instructions.** For exercise items, add expectations that each task is explained and
  never answered (Principle VI, 001 FR-015).
- **Don't annotate what the source doesn't say.** If you know a fact the text leaves out, write it as an
  expectation that it must *not* be added.

### Review status

`imported` → `draft` → `reviewed`

- `imported`: only the source files and metadata; the importer's guesses for `contentType` and
  `features` aren't checked yet.
- `draft`: annotated, with at least 3 key facts. Set `annotatedBy`. Drafts made with AI help use
  `annotatedBy: claude-draft` (or the model name) and must never skip review.
- `reviewed`: a second person who knows the subject has checked every annotation against the text. Set
  `reviewedBy` and `reviewedAt`. Only reviewed items are used for the model decision. The coverage
  report counts every item, and its "Review" line shows how many are reviewed.

## Composition

The targets are minimums, defined in `src/targets.ts`; `bun run coverage` reports progress against them.
Roughly 48 items:

- **Language**: about half Bokmål, then Nynorsk and English.
- **Grade band**: mostly 5–7 and 8–10, the app's main users. NDLA is mostly upper secondary (vg), so the
  younger grades need teacher-written and publisher texts.
- **Subjects**: all main school subjects, mostly expository text, plus some narrative, literary,
  exercise and mixed items.
- **Features**: hard cases on purpose: notation, tables, dates in sequence, qualifiers, lists,
  exercises, literary quotes, very short texts (under 30 words) and near-limit texts (about 1,600–2,000
  words).
- **Split**: at least 12 items are `test`. Tune prompts on `dev` only; use `test` to confirm the final
  choice, and don't look at test outputs while tuning.

## Licences and sources

- **Committed items must be openly licensed.** The NDLA importer accepts CC BY 4.0 and CC BY-SA 4.0
  only. Most NDLA articles are CC BY-SA 4.0, so each item's annotations are shared under its source's
  licence too. Attribution is in `golden/ATTRIBUTION.md`.
- **Teacher-written** texts need the author's written consent to share under CC BY 4.0, recorded in
  `source.notes`.
- **Publisher texts** go in `golden/private/items/` unless the publisher has agreed in writing to
  publication. Private items are validated and used in runs but never committed, and neither are their
  model outputs.
- No item may contain anything about a real pupil (Principle II). Test texts are school material, not
  pupil work.

## Next

1. Annotate the remaining imported items, then review them, starting with the worked example.
2. Fill the coverage gaps: grades 5–7 and 8–10, teacher-written and publisher texts, tables, literary
   texts and near-limit texts.
3. A seeded-error set: simplified versions of reviewed items with known, labelled mistakes (dropped
   qualifier, changed number, added fact). We use it to measure the faithfulness checker itself.
4. The model test harness: run each candidate model and effort level over `dev`, score with the
   deterministic checks plus the model check, and record cost and latency. Outputs go to `runs/`
   (gitignored).
