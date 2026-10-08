export function extractSql(text: string): string {
  const closed = text.match(/```[a-zA-Z]*\s*\n([\s\S]*?)```/);
  if (closed) return closed[1].trim();
  return text
    .replace(/^\s*```[a-zA-Z]*\s*\n?/, "")
    .replace(/```\s*$/, "")
    .trim();
}