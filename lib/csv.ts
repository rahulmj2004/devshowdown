/** Characters that make spreadsheet apps treat a cell as a formula. */
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

function escapeCell(value: unknown): string {
  let text = value === null || value === undefined ? "" : String(value);
  // Neutralise formula injection from participant-supplied text.
  if (FORMULA_PREFIX.test(text)) text = `'${text}`;
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function toCsv(
  headers: readonly string[],
  rows: readonly (readonly unknown[])[],
): string {
  return [headers, ...rows]
    .map((row) => row.map(escapeCell).join(","))
    .join("\r\n");
}
