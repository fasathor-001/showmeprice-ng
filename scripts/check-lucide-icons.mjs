import fs from "fs";
import path from "path";

function walk(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walk(p));
    else if (p.endsWith(".ts") || p.endsWith(".tsx")) out.push(p);
  }
  return out;
}

let lucide;
try {
  lucide = await import("lucide-react");
} catch {
  console.error("FAILED to import lucide-react. Install it first (npm i lucide-react --legacy-peer-deps).");
  process.exit(1);
}

const files = walk(path.join(process.cwd(), "src"));
const re = /import\s*\{\s*([^}]+)\s*\}\s*from\s*["']lucide-react["'];/g;

let bad = 0;

for (const file of files) {
  const txt = fs.readFileSync(file, "utf8");
  const matches = [...txt.matchAll(re)];
  for (const m of matches) {
    const names = m[1].split(",").map(s => s.trim()).filter(Boolean);
    for (const name of names) {
      if (!(name in lucide)) {
        bad++;
        console.log(`Missing export: ${name}  ->  ${file}`);
      }
    }
  }
}

if (bad === 0) console.log("OK: No missing lucide-react icon exports found.");
else console.log(`Found ${bad} missing icon exports.`);
