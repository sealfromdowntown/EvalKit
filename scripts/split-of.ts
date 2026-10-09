import { splitFor } from "../src/templates/split";

const ids = process.argv.slice(2);
if (ids.length === 0) {
  console.error("Usage: npx tsx scripts/split-of.ts <case-id> [<case-id> ...]");
  process.exit(1);
}
for (const id of ids) console.log(`${splitFor(id).padEnd(5)} ${id}`);