import Database from "better-sqlite3";

export function describeSchema(dbPath: string, table = "resale"): string {
  const db = new Database(dbPath, { readonly: true, fileMustExist: true });
  try {
    const cols = db.prepare(`PRAGMA table_info(${table})`).all() as { name: string; type: string }[];
    return `${table}(${cols.map((c) => `${c.name} ${c.type}`).join(", ")})`;
  } finally {
    db.close();
  }
}

export function buildUserMessage(schema: string, question: string): string {
  return `Schema:\n${schema}\n\nQuestion: ${question}`;
}