// Patient lists come from Excel. We read .xlsx and .csv in the browser and write CSV that Excel
// opens with Persian text intact (UTF-8 with a byte order mark).

import { toLatinDigits } from './numbers';

export type Table = string[][];

/** Splits CSV text, with quoted fields, a comma, semicolon or tab separator and any line ending. */
export function parseCsv(text: string): Table {
  const body = text.replace(/^\uFEFF/, '');
  const firstLine = body.split(/\r?\n/, 1)[0] ?? '';
  const separator = [',', ';', '\t'].reduce((best, s) =>
    firstLine.split(s).length > firstLine.split(best).length ? s : best,
  );
  const rows: Table = [];
  let row: string[] = [];
  let field = '';
  let quoted = false;
  for (let i = 0; i < body.length; i++) {
    const c = body[i];
    if (quoted) {
      if (c === '"' && body[i + 1] === '"') {
        field += '"';
        i++;
      } else if (c === '"') {
        quoted = false;
      } else {
        field += c;
      }
    } else if (c === '"' && field === '') {
      quoted = true;
    } else if (c === separator) {
      row.push(field);
      field = '';
    } else if (c === '\n' || c === '\r') {
      if (c === '\r' && body[i + 1] === '\n') i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = '';
    } else {
      field += c;
    }
  }
  if (field !== '' || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return withoutEmptyRows(rows);
}

function withoutEmptyRows(rows: Table): Table {
  return rows.map((r) => r.map((c) => c.trim())).filter((r) => r.some((c) => c !== ''));
}

function cellText(value: unknown): string {
  if (value == null) return '';
  if (value instanceof Date) return value.toISOString().slice(0, 10);
  if (typeof value === 'number') return Number.isInteger(value) ? String(value) : String(value);
  return String(value);
}

/** The first sheet of an .xlsx file, or a .csv file, as rows of text. */
export async function readTable(file: File): Promise<Table> {
  if (/\.xlsx$/i.test(file.name)) {
    // Loaded on demand: only owners importing a list need it.
    const { readSheet } = await import('read-excel-file/browser');
    const rows = await readSheet(file);
    return withoutEmptyRows(rows.map((r) => r.map(cellText)));
  }
  if (/\.xls$/i.test(file.name)) throw new Error('xls');
  return parseCsv(await file.text());
}

export type Column = 'name' | 'mobile' | 'externalRef';

const HEADER_HINTS: Record<Column, RegExp> = {
  name: /^(name|full ?name|patient|نام|نام و نام خانوادگی|نام بیمار|اسم)$/i,
  mobile: /(mobile|phone|cell|موبایل|همراه|تلفن|شماره تماس)/i,
  externalRef: /(file|record|ref|code|id|پرونده|کد|شناسه)/i,
};

/** Which column holds what, guessed from the header row; -1 when no header matches. */
export function guessColumns(header: string[]): Record<Column, number> {
  const find = (column: Column, taken: number[]) =>
    header.findIndex((h, i) => !taken.includes(i) && HEADER_HINTS[column].test(h.trim()));
  const externalRef = find('externalRef', []);
  const mobile = find('mobile', [externalRef]);
  const name = find('name', [externalRef, mobile]);
  return { name, mobile, externalRef };
}

/** Whether the first row looks like titles rather than a patient. */
export function hasHeader(table: Table) {
  const first = table[0] ?? [];
  return first.some((cell) => Object.values(HEADER_HINTS).some((re) => re.test(cell.trim())));
}

/**
 * A mobile as typed in a patient list, in the form the API accepts, or null when it cannot be one.
 * Excel often stores 09121234567 as the number 9121234567, so the leading zero is put back.
 */
export function cleanMobile(text: string): string | null {
  const digits = toLatinDigits(text).replace(/[\s\-()]/g, '');
  if (digits === '') return null;
  const m = /^(?:\+98|0098|98|0)?(9\d{9})$/.exec(digits);
  return m ? `0${m[1]}` : null;
}

/** A CSV file Excel opens with Persian intact. */
export function toCsv(rows: (string | number | null)[][]) {
  const escape = (value: string | number | null) => {
    const text = value == null ? '' : String(value);
    return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return '﻿' + rows.map((r) => r.map(escape).join(',')).join('\r\n') + '\r\n';
}

export function download(filename: string, content: string, type = 'text/csv;charset=utf-8') {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
