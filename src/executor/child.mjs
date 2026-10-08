import Database from "better-sqlite3";

process.once("message", ({ dbPath, sql, maxRows }) => {
  let result;
  try {
    const db = new Database(dbPath, { readonly: true, fileMustExist: true });
    try {
      const stmt = db.prepare(sql);
      if (!stmt.reader) {
        result = {
          ok: false,
          error: "rejected",
          message: "Statement does not return rows",
        };
      } else {
        const columns = stmt.columns().map((c) => c.name);
        const rows = [];
        let truncated = false;
        for (const row of stmt.raw(true).iterate()) {
          if (rows.length >= maxRows) {
            truncated = true;
            break;
          }
          rows.push(row);
        }
        result = { ok: true, columns, rows, truncated };
      }
    } finally {
      db.close();
    }
  } catch (e) {
    result = {
      ok: false,
      error: "sql_error",
      message: String(e && e.message ? e.message : e),
    };
  }
  process.send(result, () => process.exit(0));
});