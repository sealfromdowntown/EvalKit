/** Quote a value as a SQL string literal. */
export function sqlString(s: string): string {
  return `'${s.replace(/'/g, "''")}'`;
}

/**
 * Median of resale_price for rows matching `where`. SQLite has no median function:
 * sort the prices, skip the first half, and average the middle one (odd count)
 * or two (even count) values.
 */
export function medianSql(where: string): string {
  return [
    "SELECT AVG(resale_price) FROM (",
    "  SELECT resale_price FROM resale",
    `  WHERE ${where}`,
    "  ORDER BY resale_price",
    `  LIMIT 2 - (SELECT COUNT(*) FROM resale WHERE ${where}) % 2`,
    `  OFFSET (SELECT (COUNT(*) - 1) / 2 FROM resale WHERE ${where})`,
    ")",
  ].join("\n");
}