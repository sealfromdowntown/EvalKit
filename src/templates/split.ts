import { createHash } from "node:crypto";

/**
 * Stable dev/test assignment based on the case id. About 20% of ids become "test".
 * Because it depends only on the id, a case never changes split when others are added.
 */
export function splitFor(id: string): "dev" | "test" {
  const n = Number.parseInt(createHash("sha256").update(id).digest("hex").slice(0, 8), 16);
  return n % 5 === 0 ? "test" : "dev";
}