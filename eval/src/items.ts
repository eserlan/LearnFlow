import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import YAML from "yaml";
import { GoldenItem } from "./schema.ts";

export const goldenDir = join(import.meta.dir, "..", "golden");

export interface LoadedItem {
  item: GoldenItem;
  /** expected-clean.md: the 001 output, which is the input to simplification. */
  clean: string;
  isPrivate: boolean;
}

/** Load every committed and private item. Throws on schema errors; run `bun run validate` for details. */
export async function loadItems(): Promise<LoadedItem[]> {
  const out: LoadedItem[] = [];
  for (const [dir, isPrivate] of [[join(goldenDir, "items"), false], [join(goldenDir, "private", "items"), true]] as const) {
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
    for (const e of entries.filter((d) => d.isDirectory())) {
      const base = join(dir, e.name);
      const item = GoldenItem.parse(YAML.parse(await readFile(join(base, "item.yaml"), "utf8")));
      out.push({ item, clean: await readFile(join(base, "expected-clean.md"), "utf8"), isPrivate });
    }
  }
  return out.sort((a, b) => a.item.id.localeCompare(b.item.id));
}
