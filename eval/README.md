# LearnFlow evaluation: the golden data set

A small, hand-checked set of real school texts. We use it to choose the simplification model and effort
level, and later to catch regressions in paste clean-up (spec 001) and faithful simplification (spec 002).
The production choice in ADR-0001 is Gemini 3.8 Flash at low thinking (`gemini-flash-low`) with the prompt
`simplify-v3`. The harness also runs Claude (Haiku, Sonnet, Opus), GPT and Muse models for comparison, and
Claude Opus 5.5 is the judge.

The set answers one question per item: **did the simplified text keep the main points, get everything it
kept right, and add nothing?** (Constitution Principle I). At level "lettere" the text is meant to be shorter:
leaving out examples and detail is wanted, so only the main points must survive. Reading level is measured
separately and automatically; the annotations here are about faithfulness.

## Commands

Run from `eval/` (needs [bun](https://bun.sh)):

```sh
bun install
bun run import:ndla 38810 --lang nb --subject naturfag [--grade vg] [--split dev|test] [--force]
bun run validate        # schema, quotes found verbatim, ATTRIBUTION.md up to date; non-zero exit on errors
bun run coverage        # validate, then composition against the targets in src/targets.ts
bun run attribution     # regenerate golden/ATTRIBUTION.md after adding or changing items
bun run typecheck
bun run run --configs haiku-low,sonnet-medium,seeded [--items id,id] [--judge opus-medium|none] [--yes]
bun run report <run-name>
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
| `keyFacts` | The claims a pupil should be able to learn from the text. `statement` is the fact in plain words; `sourceQuote` is the shortest exact quote that supports it. Mark the main points `core: true`: what every pupil must take away even from the shortest version. Only core facts must survive at "lettere"; at "naermere" all must. | 3–12, by importance; 2–6 core |
| `keyTerms` | Subject words the simplified text must keep (and may explain), not replace. `sourceDefinition` is an exact quote where the source defines it, if it does. | 3–10 |
| `mustPreserve` | Exact strings that must appear unchanged: numbers, dates, names, units, formulas, terms. Kind is `number`, `date`, `name`, `unit`, `formula` or `term`. | all that matter |
| `qualifiers` | Hedges, limits and analogies that change the meaning if dropped ("direkte eller indirekte", "I våre områder", "nesten som"). `note` says what goes wrong without it. | all you find |
| `expectations` | Anything else, as one plain sentence each, e.g. "Exercise 3 is explained, not answered". These are read by the model check and by people. | as needed |

Guidelines:

- **Key facts are what a teacher would test.** Leave out side remarks and examples unless the example
  *is* the point. If you'd be unhappy to see it missing from the simplified text, it's a key fact. If
  you'd be unhappy to see it missing from a version a third as long, it's core.
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

## Running models

`bun run run` simplifies each annotated item with each config, checks the output and has a judge model
grade it, then `bun run report <run>` writes `runs/<run>/report.md`. Runs are gitignored.

**Configs** (`src/configs.ts`): a model plus an effort level, e.g. `haiku-low`, `sonnet-medium`,
`gemini-flash-low`, `gpt-luna-low`, `muse-wonder-low`. Three pseudo-configs make no simplification call
and test the harness itself:

- `identity` returns the source unchanged: it must keep every fact and value, and fail LIX.
- `empty` returns nothing: it must fail everything.
- `seeded` is identity with three planted errors (a changed number, a dropped qualifier, an invented
  conclusion). The report shows whether the checks or the judge caught each one. This is the start of
  the seeded-error set for SC-005.

Run these with `--judge none` for a free check of the plumbing, and with a judge to check the judge.

**What is measured**, per config, against the 002 success criteria:

| Measure | How | Target |
| --- | --- | --- |
| Sentences supported | judge, per sentence against the source | ≥ 99%, at most 1 bad sentence per lesson (SC-001) |
| Added numbers | checks: numbers in the output that are not in the source, so also changed ones | 0 (SC-002, FR-003) |
| Values kept | checks: every `mustPreserve` value appears exactly | 100% at "naermere" (SC-002); shown only at "lettere" |
| Main points | judge: core key facts present, partial, missing or distorted; with a 95% interval | ≥ 95% present at "lettere" (SC-003) |
| All key facts | judge, as above, over every key fact | ≥ 95% at "naermere" (SC-003); shown only at "lettere" |
| Misleading omissions | judge: something left out makes the rest wrong (one side of a contrast, an exception) | never (FR-017) |
| Qualifiers, expectations | judge, per annotation | as high as possible |
| Tasks answered or dropped | judge | never (FR-011, FR-017) |
| LIX | checks, level `lettere`: output ≤ max(source − 10, 35) | pass (SC-004) |
| Written standard | checks: Bokmål-only words in Nynorsk output and the reverse | none (FR-008) |
| Length, bite size | checks: output words / source words; words per sentence; most sentences under one heading | shorter is better at "lettere"; prompt asks ≤ 4 per section |
| Latency | wall clock per call; p90 for 300–500-word texts | ≤ 10 s (SC-008) |
| Cost | tokens × prices in `src/configs.ts` | lowest that passes |

An item passes when it meets every hard gate. The judge (`--judge`, default Opus 5.5 at medium effort)
sees the source, the output and the annotations, not which config wrote it. When the judge and the
candidate are the same model the report says so, since its scores may be optimistic.

**Before spending money**, the runner prints its plan and stops unless you add `--yes`. Pilot on one
item first (`--items ndla-38810-nb`) to measure real tokens, time and cost per case before a full run.
`--split test` needs `--confirm-test`: use the test split only to confirm a final choice.

**Results** go to `runs/<name>/`: `results.jsonl` (one row per item × config, written as each finishes,
so a re-run with the same `--run` resumes), `errors.jsonl` (failed calls, never scored as zero), `traces/`
(prompts, raw output, the rendered text and every judge verdict) and `run.json`. Every row records the
inference region the API reports; `--geo` requests one.

**Backends** (`src/llm.ts`). Nothing needs an API key by default; every call runs a CLI on your own login:

| Models | CLI | Notes |
| --- | --- | --- |
| Claude | `claude -p` (default), or `--backend api` | Our system prompt replaces Claude Code's; no tools, settings or MCP servers. About 600 tokens of wrapper. Cost is reported at list price. `--backend api` calls the Anthropic API as the app will, and needs `ANTHROPIC_API_KEY`. |
| Gemini | `agy -p` (Antigravity) | Effort is part of the model id. About 8k tokens of agent context. |
| GPT | `codex exec` | Read-only sandbox, user config ignored. About 14k tokens of agent context. |
| Muse | `muse exec` | `empty` preset. About 16k tokens of agent context. |

The non-Claude CLIs have no system-prompt option, so the instructions go at the top of the prompt, and
each is a coding agent with its own base instructions. That favours Claude slightly; it is fine for a
first comparison, not for a final verdict on another provider. They report tokens but no price.
Latency through any CLI includes its start-up time, so it is higher than a direct API call; use
`--backend api` to measure SC-008 properly.

Every run uses your plans' usage. The texts are openly licensed school material, not pupil data, but
private publisher items are sent too when present, so check those providers' terms before adding any.

The prompt lives in `src/simplify.ts`. Bump `PROMPT_VERSION` (or `JUDGE_VERSION` in `src/judge.ts`)
whenever you change it, so results from different prompts are never mixed. Don't put examples taken
from golden items into the prompt; that would leak the test into the thing being tested.

## Next

1. Annotate the remaining imported items, then review them, starting with the worked example.
2. Fill the coverage gaps: grades 5–7 and 8–10, teacher-written and publisher texts, tables, literary
   texts and near-limit texts.
3. Grow the seeded-error set beyond the three planted errors per item: swapped cause and effect,
   belief stated as fact, merged facts, an answered task. Real model mistakes from runs are the best source.
4. Check the judge against people: have a teacher grade a sample of outputs and compare.
