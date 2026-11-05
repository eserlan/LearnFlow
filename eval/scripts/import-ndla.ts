/**
 * Import an NDLA article as a new golden item (status "imported", no annotations yet).
 *
 *   bun scripts/import-ndla.ts <articleId> --lang nb|nn|en --subject <subject> [--grade 5-7|8-10|vg]
 *                              [--split dev|test] [--force]
 *
 * Only openly licensed articles (CC BY / CC BY-SA) are accepted, because the data set is committed.
 */
import { mkdir, writeFile, readFile, access } from "node:fs/promises";
import { join } from "node:path";
import { parseArgs } from "node:util";
import YAML from "yaml";
import { represent, wordCount } from "../src/html.ts";
import { GoldenItem, Subject, GradeBand, Language, type Feature } from "../src/schema.ts";

const OPEN_LICENCES: Record<string, string> = {
  "CC-BY-4.0": "https://creativecommons.org/licenses/by/4.0/",
  "CC-BY-SA-4.0": "https://creativecommons.org/licenses/by-sa/4.0/",
};

const { values, positionals } = parseArgs({
  allowPositionals: true,
  options: {
    lang: { type: "string", default: "nb" },
    subject: { type: "string" },
    grade: { type: "string", default: "vg" },
    split: { type: "string", default: "dev" },
    force: { type: "boolean", default: false },
  },
});

const articleId = positionals[0];
if (!articleId || !/^\d+$/.test(articleId) || !values.subject) {
  console.error("usage: bun scripts/import-ndla.ts <articleId> --subject <subject> [--lang nb|nn|en] [--grade vg] [--split dev|test]");
  process.exit(2);
}
const lang = Language.parse(values.lang);
const subject = Subject.parse(values.subject);
const gradeBand = GradeBand.parse(values.grade);

const url = `https://api.ndla.no/article-api/v2/articles/${articleId}?language=${lang}`;
const res = await fetch(url, { headers: { "User-Agent": "learnflow-eval/0.1 (golden data set import)" } });
if (!res.ok) throw new Error(`NDLA returned ${res.status} for ${url}`);
const a = (await res.json()) as any;

if (a.content?.language !== lang) {
  throw new Error(`article ${articleId} has no '${lang}' version (supported: ${a.supportedLanguages?.join(", ")})`);
}
const licenceId: string = a.copyright?.license?.license;
if (!(licenceId in OPEN_LICENCES)) {
  throw new Error(`article ${articleId} is licensed '${licenceId}', not an open licence accepted for the committed data set`);
}

const title: string = a.title.title;
const intro: string = a.introduction?.htmlIntroduction ?? a.introduction?.introduction ?? "";
const rep = represent(`${intro ? `<p>${intro}</p>` : ""}${a.content.content}`, title);
const words = wordCount(rep.clean);

const features: Feature[] = [];
if (rep.hasNotation) features.push("notation");
if (rep.hasTable) features.push("table");
if (rep.hasList) features.push("lists");
if ((rep.clean.match(/\b1\d{3}\b|\b20\d{2}\b/g) ?? []).length >= 3) features.push("dates-sequence");
if (words < 30) features.push("very-short");
if (words > 1600) features.push("near-limit");

const id = `ndla-${articleId}-${lang}`;
const creators: string[] = [
  ...(a.copyright?.creators ?? []),
  ...(a.copyright?.rightsholders ?? []),
].map((c: { name: string; type: string }) => `${c.name} (${c.type})`);

const dir = join(import.meta.dir, "..", "golden", "items", id);
const exists = await access(dir).then(() => true, () => false);
if (exists && !values.force) throw new Error(`${dir} already exists (use --force to refresh the source files)`);
// On --force, refresh the source files and source metadata but keep human work: annotations, review,
// and the hand-checked classification.
const previous = exists ? GoldenItem.parse(YAML.parse(await readFile(join(dir, "item.yaml"), "utf8"))) : undefined;
const previousClean = exists ? await readFile(join(dir, "expected-clean.md"), "utf8").catch(() => "") : undefined;

const item = GoldenItem.parse({
  id,
  title,
  split: values.split,
  subject,
  gradeBand,
  language: lang,
  contentType: "expository",
  features,
  source: {
    type: "ndla",
    url: `https://ndla.no/article/${articleId}`,
    retrieved: new Date().toISOString().slice(0, 10),
    licence: { id: licenceId, url: OPEN_LICENCES[licenceId] },
    creators,
    notes: `NDLA article ${articleId}, revision ${a.revision}. Images and media embeds removed.`,
  },
  annotations: {},
  review: { status: "imported" },
  ...(previous && {
    split: previous.split,
    gradeBand: previous.gradeBand,
    contentType: previous.contentType,
    features: previous.features,
    annotations: previous.annotations,
    review: previous.review,
  }),
});

await mkdir(dir, { recursive: true });
await writeFile(join(dir, "source.html"), rep.html + "\n");
await writeFile(join(dir, "source.txt"), rep.text);
await writeFile(join(dir, "expected-clean.md"), rep.clean);
await writeFile(join(dir, "item.yaml"), YAML.stringify(item, { lineWidth: 110 }));

if (previousClean !== undefined && previousClean !== rep.clean) {
  console.warn(`! ${id}: expected-clean.md changed; run validate and re-check the annotations`);
}
console.log(`${previous ? "refreshed" : "imported"} ${id}: "${title}", ${words} words, licence ${licenceId}, features [${features.join(", ")}]`);
