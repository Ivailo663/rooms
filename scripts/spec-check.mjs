// Cross-references acceptance-criterion ids in specs/ against the ids cited in
// test titles. Fails only on dangling ids (a test citing a criterion no spec
// defines); uncovered criteria are reported, not fatal. See specs/README.md.
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const SKIP = new Set(["node_modules", ".git", ".turbo", "dist", "test-results"]);

const walk = (dir, match) =>
  readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    if (SKIP.has(entry.name)) return [];
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return walk(path, match);
    return match(entry.name) ? [path] : [];
  });

const AC_LINE = /^\s*- \*\*([A-Z]+-\d{2})\*\*(.*)$/;
const criteria = new Map(); // id -> { file, tag }

for (const file of walk(join(root, "specs"), (n) => n.endsWith(".md"))) {
  const lines = readFileSync(file, "utf8").split("\n");
  let fenced = false;
  lines.forEach((line, i) => {
    if (line.trimStart().startsWith("```")) fenced = !fenced;
    const m = !fenced && AC_LINE.exec(line);
    if (!m) return;
    const [, id] = m;
    if (criteria.has(id)) {
      console.error(`duplicate id ${id} in ${relative(root, file)}`);
      process.exitCode = 1;
    }
    // A criterion's tag sits at the end of its bullet, which may wrap.
    let body = m[2];
    for (let j = i + 1; j < lines.length && /^\s{2,}\S/.test(lines[j]); j++) {
      body += " " + lines[j];
    }
    const tag = body.includes("`[gap]`")
      ? "gap"
      : body.includes("`[deferred]`")
        ? "deferred"
        : body.includes("`[tbd]`")
          ? "tbd"
          : null;
    criteria.set(id, { file: relative(root, file), tag });
  });
}

const prefixes = new Set([...criteria.keys()].map((id) => id.split("-")[0]));
const CITED = /\b([A-Z]+-\d{2})\b/g;
const cited = new Map(); // id -> test files

const testFiles = ["client", "server", "packages"].flatMap((dir) =>
  walk(join(root, dir), (n) => /\.(test|spec)\.ts$/.test(n)),
);

for (const file of testFiles) {
  for (const [, id] of readFileSync(file, "utf8").matchAll(CITED)) {
    if (!prefixes.has(id.split("-")[0])) continue;
    const files = cited.get(id) ?? new Set();
    files.add(relative(root, file));
    cited.set(id, files);
  }
}

const dangling = [...cited.keys()].filter((id) => !criteria.has(id));
const count = (tag) => [...criteria.values()].filter((c) => c.tag === tag).length;
const active = [...criteria].filter(([, c]) => c.tag !== "deferred" && c.tag !== "tbd");
const uncovered = active.filter(([id, c]) => !cited.has(id) && c.tag !== "gap");
const coveredGaps = active.filter(([id, c]) => cited.has(id) && c.tag === "gap");
const covered = active.filter(([id]) => cited.has(id));
// Tests against a criterion still under discussion pin behaviour nobody agreed.
const coveredTbd = [...criteria].filter(([id, c]) => cited.has(id) && c.tag === "tbd");

console.log(
  `spec-check: ${covered.length}/${active.length} active criteria cited by tests` +
    ` (${count("deferred")} deferred, ${count("tbd")} tbd, ${count("gap")} gaps)`,
);

if (process.argv.includes("--verbose")) {
  for (const [id, c] of uncovered) console.log(`  uncovered  ${id}  ${c.file}`);
}
for (const [id] of coveredGaps) {
  console.log(`  covered gap ${id}  (test should be failing or todo)`);
}
for (const [id] of coveredTbd) {
  console.log(`  covered tbd ${id}  (criterion not agreed yet)`);
}
for (const id of dangling) {
  console.error(`  dangling   ${id}  cited in ${[...cited.get(id)].join(", ")}`);
}

if (dangling.length) process.exitCode = 1;
