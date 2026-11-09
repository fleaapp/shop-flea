import { expect, test } from 'bun:test';
import { csvCell, toCsv } from '../../../src/lib/csv';

test('both admin exports neutralize spreadsheet formulas, including leading controls', () => {
  for (const value of ['=1+1', '+SUM(A1)', '-1+2', '@SUM(A1)', '  =1+1', '\t=1+1', '\r=1+1', '\u0000=1+1']) {
    expect(csvCell(value)).toBe(`"'${value}"`);
  }
});

test('CSV preserves ordinary text, quotes, commas, newlines and amounts', () => {
  expect(toCsv([['Name', 'Amount'], ['Sarah, "Flea"\nAU', '42.50']]))
    .toBe('"Name","Amount"\r\n"Sarah, ""Flea""\nAU","42.50"');
  expect(csvCell(null)).toBe('""');
});