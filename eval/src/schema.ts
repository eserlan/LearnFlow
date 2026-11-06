import { z } from "zod";

/**
 * One golden item = one source text a pupil might paste, plus human annotations of what any
 * faithful simplification must keep. Lives in golden/items/<id>/item.yaml next to:
 *   - source.html        what the clipboard's text/html would hold (cleaned of images and embeds)
 *   - source.txt         what the clipboard's text/plain would hold (notation flattened, e.g. CO2)
 *   - expected-clean.md  the source document 001 should hand to 002 (structure kept, plain text preserved)
 * Annotation quotes are checked against expected-clean.md.
 */

export const Subject = z.enum([
  "naturfag",
  "samfunnsfag",
  "historie",
  "geografi",
  "krle",
  "norsk",
  "engelsk",
  "matematikk",
  "helse",
  "annet",
]);

export const GradeBand = z.enum(["5-7", "8-10", "vg"]);
export const Language = z.enum(["nb", "nn", "en"]);
export const ContentType = z.enum(["expository", "narrative", "literary", "exercises", "mixed"]);

/** Properties that exercise specific requirements in specs 001–003. */
export const Feature = z.enum([
  "notation", // CO₂, x², km/t (001 FR-016, 003 pronunciation)
  "table", // tables must keep every value (002 edge cases)
  "dates-sequence", // dated events, timeline candidates
  "qualifiers", // caveats that must survive (002 FR-004)
  "lists",
  "exercises", // must be explained, never answered (Principle VI)
  "literary-quote", // must not be rewritten (002 FR-011)
  "very-short", // < 30 words (001 FR-008)
  "near-limit", // close to the 2,000-word limit (001 FR-008)
  "fact-box",
]);

export const PreserveKind = z.enum(["number", "date", "name", "unit", "formula", "term"]);

export const KeyFact = z.object({
  id: z.string().regex(/^f\d+$/, "key fact ids are f1, f2, …"),
  /** The fact in plain words, as a reviewer would check for it in the simplified text. */
  statement: z.string().min(5),
  /** Exact quote from expected-clean.md that states the fact. */
  sourceQuote: z.string().min(3),
  /**
   * A main point: what the pupil must take away even from the shortest simplified version. At level
   * "lettere" only core facts must be kept; the rest is detail the model may leave out.
   */
  core: z.boolean().default(false),
  /**
   * For core facts: the main point in one short sentence, without the details "lettere" may leave out.
   * At "lettere" the judge grades core facts against this, at "naermere" against the full statement.
   */
  gist: z.string().min(5).optional(),
});

export const KeyTerm = z.object({
  term: z.string().min(2),
  /** Exact quote of the source's own definition, if the source defines the term. */
  sourceDefinition: z.string().optional(),
});

export const MustPreserve = z.object({
  value: z.string().min(1),
  kind: PreserveKind,
});

export const Qualifier = z.object({
  /** Exact quote of the hedge or caveat ("Litt forenklet", "direkte eller indirekte"). */
  quote: z.string().min(2),
  note: z.string().optional(),
});

export const Review = z.object({
  status: z.enum(["imported", "draft", "reviewed"]),
  annotatedBy: z.string().optional(),
  reviewedBy: z.string().optional(),
  reviewedAt: z.string().optional(),
  notes: z.string().optional(),
});

export const GoldenItem = z
  .object({
    id: z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/),
    title: z.string().min(1),
    /** dev = free to tune against; test = held out, only for final comparisons. */
    split: z.enum(["dev", "test"]),
    subject: Subject,
    gradeBand: GradeBand,
    language: Language,
    contentType: ContentType,
    features: z.array(Feature).default([]),
    source: z.object({
      type: z.enum(["ndla", "publisher", "web", "pdf", "teacher-written"]),
      url: z.url().optional(),
      retrieved: z.string(),
      licence: z.object({ id: z.string(), url: z.url() }),
      creators: z.array(z.string()),
      notes: z.string().optional(),
    }),
    annotations: z.object({
      keyFacts: z.array(KeyFact).default([]),
      keyTerms: z.array(KeyTerm).default([]),
      mustPreserve: z.array(MustPreserve).default([]),
      qualifiers: z.array(Qualifier).default([]),
      /** Behaviour expectations in plain words, e.g. "Exercise 3 is explained, not answered". */
      expectations: z.array(z.string()).default([]),
    }),
    review: Review,
  })
  .superRefine((item, ctx) => {
    if (item.review.status !== "imported" && item.annotations.keyFacts.length < 3) {
      ctx.addIssue({ code: "custom", message: "annotated items need at least 3 key facts" });
    }
    if (item.review.status !== "imported" && !item.annotations.keyFacts.some((f) => f.core)) {
      ctx.addIssue({ code: "custom", message: "annotated items need at least one core key fact (core: true)" });
    }
    for (const f of item.annotations.keyFacts) {
      if (f.core && !f.gist) ctx.addIssue({ code: "custom", message: `core key fact ${f.id} needs a gist` });
    }
    if (item.review.status === "reviewed" && !item.review.reviewedBy) {
      ctx.addIssue({ code: "custom", message: "reviewed items need review.reviewedBy" });
    }
    const ids = item.annotations.keyFacts.map((f) => f.id);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ code: "custom", message: "duplicate key fact ids" });
    }
  });

export type GoldenItem = z.infer<typeof GoldenItem>;
export type Feature = z.infer<typeof Feature>;
export type Language = z.infer<typeof Language>;
