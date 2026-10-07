function escapeCsvCell(value: unknown): string {
  const text = value === null || value === undefined ? "" : String(value);
  if (/[",\n]/.test(text)) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
}

export function toCsv(rows: Record<string, unknown>[], columns: { key: string; header: string }[]): string {
  const headerLine = columns.map((column) => escapeCsvCell(column.header)).join(",");
  const lines = rows.map((row) => columns.map((column) => escapeCsvCell(row[column.key])).join(","));
  return [headerLine, ...lines].join("\n");
}
