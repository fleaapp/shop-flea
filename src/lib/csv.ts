/** Quote every cell and keep spreadsheet formula prefixes inert, including whitespace tricks. */
export function csvCell(value: unknown): string {
  const text = value == null ? '' : String(value);
  const inert = /^[\s\u0000-\u001f]*[=+\-@]/u.test(text) || /^[\t\r\n]/u.test(text)
    ? `'${text}` : text;
  return `"${inert.replace(/"/g, '""')}"`;
}

export function toCsv(rows: readonly (readonly unknown[])[]): string {
  return rows.map(row => row.map(csvCell).join(',')).join('\r\n');
}