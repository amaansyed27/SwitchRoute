import { readdir, readFile } from "node:fs/promises";
import { extname, join, relative } from "node:path";

const root = process.cwd();
const roots = ["apps/web/src", "packages/ui/src", "services/gateway/src", "crates/switchroute-edge/src"];
const extensions = new Set([".ts", ".tsx", ".py", ".rs"]);
const ignored = new Set(["node_modules", ".next", ".venv", "__pycache__", "target"]);
let failed = false;

async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    if (ignored.has(entry.name)) continue;
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await walk(path);
    else if (extensions.has(extname(path))) {
      const lines = (await readFile(path, "utf8")).split(/\r?\n/).length;
      const display = relative(root, path);
      if (lines > 400) { console.error(`ERROR ${display}: ${lines} lines (>400)`); failed = true; }
      else if (lines > 300) console.warn(`WARN  ${display}: ${lines} lines (>300; reconsider structure)`);
    }
  }
}

for (const directory of roots) await walk(join(root, directory));
if (failed) process.exit(1);
