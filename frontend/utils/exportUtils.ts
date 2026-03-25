import { downloadExcelWorkbook } from './excelTemplate';

export type ExportCell = string | number | boolean | null | undefined;
export type ExportRow = ExportCell[];

interface ExportPdfOptions {
  fileName: string;
  title: string;
  headers: string[];
  rows: ExportRow[];
  subtitle?: string;
  landscape?: boolean;
}

const toText = (value: ExportCell): string => {
  if (value === null || value === undefined) {
    return '';
  }
  return String(value);
};

/**
 * Sanitize a CSV cell value against formula injection.
 * Any cell that starts with =, +, -, @, TAB, or CR is prefixed with a tab
 * so spreadsheet apps do not interpret it as a formula.
 * See: https://owasp.org/www-community/attacks/CSV_Injection
 */
const sanitizeCsvFormula = (raw: string): string => {
  if (raw.length > 0 && '=+-@\t\r'.includes(raw[0])) {
    return '\t' + raw;
  }
  return raw;
};

const escapeCsvCell = (value: ExportCell): string =>
  `"${sanitizeCsvFormula(toText(value)).replace(/"/g, '""')}"`;

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const removeExtension = (fileName: string, extensionPattern: RegExp): string =>
  fileName.replace(extensionPattern, '');

export const isoDateStamp = (): string => new Date().toISOString().slice(0, 10);

export const exportCsv = (fileName: string, headers: string[], rows: ExportRow[]): void => {
  const baseName = removeExtension(fileName, /\.csv$/i);
  const csvContent = [
    headers.map((header) => escapeCsvCell(header)).join(','),
    ...rows.map((row) => row.map((cell) => escapeCsvCell(cell)).join(',')),
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${baseName}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const exportExcel = (
  fileName: string,
  sheetName: string,
  headers: string[],
  rows: ExportRow[]
): void => {
  const baseName = removeExtension(fileName, /\.xlsx?$|\.xls$/i);
  downloadExcelWorkbook(baseName, [{ name: sheetName, headers, rows }]);
};

export const exportPdfTable = ({
  fileName,
  title,
  headers,
  rows,
  subtitle,
  landscape = true,
}: ExportPdfOptions): boolean => {
  const popup = window.open('', '_blank', 'noopener,noreferrer');
  if (!popup) {
    return false;
  }

  const generatedAt = new Date().toLocaleString('vi-VN');
  const htmlRows = rows
    .map(
      (row) =>
        `<tr>${row
          .map((cell) => `<td>${escapeHtml(toText(cell))}</td>`)
          .join('')}</tr>`
    )
    .join('');
  const htmlHeaders = headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('');

  const safeTitle = escapeHtml(title);
  const safeSubtitle = escapeHtml(subtitle || generatedAt);
  const pageOrientation = landscape ? 'landscape' : 'portrait';

  const htmlSource = `<!doctype html>
<html lang="vi">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(removeExtension(fileName, /\.pdf$/i))}</title>
    <style>
      @page {
        size: A4 ${pageOrientation};
        margin: 12mm;
      }

      body {
        font-family: Arial, sans-serif;
        color: #0f172a;
        margin: 0;
      }

      .title {
        font-size: 18px;
        font-weight: 700;
        margin-bottom: 4px;
      }

      .subtitle {
        font-size: 12px;
        color: #64748b;
        margin-bottom: 14px;
      }

      table {
        width: 100%;
        border-collapse: collapse;
        table-layout: fixed;
      }

      th,
      td {
        border: 1px solid #cbd5e1;
        padding: 6px;
        font-size: 11px;
        vertical-align: top;
        word-break: break-word;
      }

      th {
        background: #f1f5f9;
        font-weight: 700;
        text-align: left;
      }

      tr:nth-child(even) td {
        background: #f8fafc;
      }
    </style>
  </head>
  <body>
    <div class="title">${safeTitle}</div>
    <div class="subtitle">${safeSubtitle}</div>
    <table>
      <thead>
        <tr>${htmlHeaders}</tr>
      </thead>
      <tbody>${htmlRows}</tbody>
    </table>
  </body>
</html>`;

  // Use DOMParser to avoid deprecated document.write()
  const parsed = new DOMParser().parseFromString(htmlSource, 'text/html');
  popup.document.replaceChild(
    popup.document.adoptNode(parsed.documentElement),
    popup.document.documentElement,
  );
  popup.focus();
  window.setTimeout(() => {
    popup.print();
  }, 250);

  return true;
};
