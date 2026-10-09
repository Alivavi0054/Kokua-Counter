// Spreadsheet apps evaluate cells starting with these characters as formulas.
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

function escapeCsvCell(value: unknown): string {
  let text = value === null || value === undefined ? "" : String(value);
  // Only strings can carry attacker-controlled formulas; real numbers (e.g. -500) stay as-is.
  if (typeof value === "string" && FORMULA_PREFIX.test(text)) {
    text = `'${text}`;
  }
  if (/[",\r\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function toCsv(rows: Record<string, unknown>[], columns: { key: string; header: string }[]): string {
  const headerLine = columns.map((column) => escapeCsvCell(column.header)).join(",");
  const lines = rows.map((row) => columns.map((column) => escapeCsvCell(row[column.key])).join(","));
  return [headerLine, ...lines].join("\n");
}
