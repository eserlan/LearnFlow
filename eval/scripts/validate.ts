/**
 * Validate every golden item and (with --coverage) report composition against the targets.
 *
 *   bun scripts/validate.ts [--coverage] [--write-attribution]
 *
 * Checks per item:
 *   - item.yaml matches the schema; folder name equals the id; all three source files exist
 *   - every annotation quote (key fact quotes, term definitions, must-preserve values, qualifiers)
 *     appears verbatim in expected-clean.md (after whitespace and Markdown markers are normalised)
 *   - key terms appear in expected-clean.md
 * Also checks that golden/ATTRIBUTION.md is up to date (--write-attribution regenerates it).
 * Exits non-zero on any error, so it can gate CI.
 */
import { readdir, readFile, writeFile, access } from "node:fs/promises";
import { join } from "node:path";
import YAML from "yaml";
import { GoldenItem } from "../src/schema.ts";
import { normaliseForMatch, wordCount } from "../src/html.ts";
import { targets, TARGET_TOTAL } from "../src/targets.ts";
import { attributionMarkdown } from "../src/attribution.ts";

const showCoverage = process.argv.includes("--coverage");
const writeAttribution = process.argv.includes("--write-attribution");
const goldenDir = join(import.meta.dir, "..", "golden");
// golden/private/items holds texts we may use but not publish (publisher material). It is gitignored,
// validated like the rest, and left out of ATTRIBUTION.md.
const listItems = async (dir: string, isPrivate: boolean) =>
  (await readdir(dir, { withFileTypes: true }).catch(() => []))
    .filter((d) => d.isDirectory())
    .map((d) => ({ name: d.name, base: join(dir, d.name), isPrivate }));
const dirs = [
  ...(await listItems(join(goldenDir, "items"), false)),
  ...(await listItems(join(goldenDir, "private", "items"), true)),
].sort((a, b) => a.name.localeCompare(b.name));

let errors = 0;
const fail = (id: string, msg: string) => {
  errors++;
  console.error(`✗ ${id}: ${msg}`);
};

const items: (GoldenItem & { words: number; isPrivate: boolean })[] = [];
for (const { name: dir, base, isPrivate } of dirs) {
  const missing = [];
  for (const f of ["item.yaml", "source.html", "source.txt", "expected-clean.md"]) {
    if (!(await access(join(base, f)).then(() => true, () => false))) missing.push(f);
  }
  if (missing.length) {
    fail(dir, `missing ${missing.join(", ")}`);
    continue;
  }
  const parsed = GoldenItem.safeParse(YAML.parse(await readFile(join(base, "item.yaml"), "utf8")));
  if (!parsed.success) {
    for (const issue of parsed.error.issues) fail(dir, `${issue.path.join(".") || "item"}: ${issue.message}`);
    continue;
  }
  const item = parsed.data;
  if (item.id !== dir) fail(dir, `id '${item.id}' does not match folder name`);

  const clean = await readFile(join(base, "expected-clean.md"), "utf8");
  const haystack = normaliseForMatch(clean);
  const mustContain = (what: string, quote: string) => {
    if (!haystack.includes(normaliseForMatch(quote))) fail(dir, `${what} not found verbatim in expected-clean.md: "${quote}"`);
  };
  const a = item.annotations;
  for (const f of a.keyFacts) mustContain(`key fact ${f.id} quote`, f.sourceQuote);
  for (const t of a.keyTerms) {
    if (!haystack.toLowerCase().includes(t.term.toLowerCase())) fail(dir, `key term not found: "${t.term}"`);
    if (t.sourceDefinition) mustContain(`definition of "${t.term}"`, t.sourceDefinition);
  }
  for (const m of a.mustPreserve) mustContain(`must-preserve ${m.kind}`, m.value);
  for (const q of a.qualifiers) mustContain("qualifier", q.quote);

  if (isPrivate && item.source.type === "ndla") fail(dir, "openly licensed NDLA items belong in golden/items, not private");
  items.push({ ...item, words: wordCount(clean), isPrivate });
}

const attributionPath = join(goldenDir, "ATTRIBUTION.md");
const attribution = attributionMarkdown(items.filter((i) => !i.isPrivate));
if (writeAttribution) {
  await writeFile(attributionPath, attribution);
  console.log(`wrote ${attributionPath}`);
} else if ((await readFile(attributionPath, "utf8").catch(() => "")) !== attribution) {
  fail("ATTRIBUTION.md", "out of date; run `bun run attribution`");
}

const byStatus = (s: string) => items.filter((i) => i.review.status === s).length;
const nPrivate = items.filter((i) => i.isPrivate).length;
console.log(
  `${items.length} items checked${nPrivate ? `, ${nPrivate} private` : ""} (${byStatus("reviewed")} reviewed, ${byStatus("draft")} draft, ${byStatus("imported")} imported), ${errors} error(s)`,
);

if (showCoverage) {
  const count = <K extends string>(pick: (i: (typeof items)[number]) => K | K[]) => {
    const m = new Map<string, number>();
    for (const i of items) for (const k of [pick(i)].flat()) m.set(k, (m.get(k) ?? 0) + 1);
    return m;
  };
  const section = (name: string, want: Record<string, number>, have: Map<string, number>) => {
    console.log(`\n${name}`);
    for (const [k, target] of Object.entries(want)) {
      const n = have.get(k) ?? 0;
      console.log(`  ${n >= target ? "✓" : "·"} ${k.padEnd(16)} ${String(n).padStart(3)} / ${target}`);
    }
  };
  console.log(`\nTotal ${items.length} / ${TARGET_TOTAL}`);
  section("Language", targets.language, count((i) => i.language));
  section("Grade band", targets.gradeBand, count((i) => i.gradeBand));
  section("Subject", targets.subject, count((i) => i.subject));
  section("Content type", targets.contentType, count((i) => i.contentType));
  section("Features", targets.features, count((i) => i.features));
  section("Source type", targets.sourceType, count((i) => i.source.type));
  section("Split", targets.split, count((i) => i.split));
  section("Review", { reviewed: targets.reviewed }, count((i) => i.review.status));
  const words = items.map((i) => i.words).sort((x, y) => x - y);
  if (words.length) console.log(`\nWords per item: min ${words[0]}, median ${words[Math.floor(words.length / 2)]}, max ${words.at(-1)}`);
}

process.exit(errors ? 1 : 0);
