export type ExcelTemplateValue = string | number | boolean | null | undefined;
export type ExcelTemplateRow = ExcelTemplateValue[];
export interface ExcelTemplateSheet {
  name: string;
  headers: string[];
  rows: ExcelTemplateRow[];
}

const escapeXml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');

const normalizeSheetName = (sheetName: string): string => {
  const sanitized = sheetName.replace(/[\\/?*:[\]]/g, ' ').trim();
  if (!sanitized) return 'Sheet1';
  return sanitized.slice(0, 31);
};

const toCellDataType = (value: ExcelTemplateValue): 'Number' | 'Boolean' | 'String' => {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return 'Number';
  }
  if (typeof value === 'boolean') {
    return 'Boolean';
  }
  return 'String';
};

const toCellValue = (value: ExcelTemplateValue): string => {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'boolean') {
    return value ? '1' : '0';
  }
  return String(value);
};

const buildRowXml = (row: ExcelTemplateRow, isHeader = false): string => {
  const styleAttr = isHeader ? ' ss:StyleID="Header"' : '';
  const cells = row
    .map((cell) => {
      const type = toCellDataType(cell);
      const value = escapeXml(toCellValue(cell));
      return `<Cell${styleAttr}><Data ss:Type="${type}">${value}</Data></Cell>`;
    })
    .join('');

  return `<Row>${cells}</Row>`;
};

const buildWorksheetXml = (sheetName: string, headers: string[], rows: ExcelTemplateRow[]): string => {
  const safeSheetName = escapeXml(normalizeSheetName(sheetName));
  const headerXml = buildRowXml(headers, true);
  const bodyXml = rows.map((row) => buildRowXml(row)).join('');

  return `<Worksheet ss:Name="${safeSheetName}">
  <Table>
   ${headerXml}
   ${bodyXml}
  </Table>
 </Worksheet>`;
};

const buildWorkbookXml = (sheets: ExcelTemplateSheet[]): string => {
  const normalizedSheets = sheets.length > 0
    ? sheets
    : [{ name: 'Sheet1', headers: [], rows: [] }];

  const worksheetsXml = normalizedSheets
    .map((sheet) => buildWorksheetXml(sheet.name, sheet.headers, sheet.rows))
    .join('');

  return `<?xml version="1.0"?>
<?mso-application progid="Excel.Sheet"?>
<Workbook xmlns="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:o="urn:schemas-microsoft-com:office:office"
 xmlns:x="urn:schemas-microsoft-com:office:excel"
 xmlns:ss="urn:schemas-microsoft-com:office:spreadsheet"
 xmlns:html="http://www.w3.org/TR/REC-html40">
 <Styles>
  <Style ss:ID="Header">
   <Font ss:Bold="1"/>
   <Interior ss:Color="#EAF2FF" ss:Pattern="Solid"/>
  </Style>
 </Styles>
 ${worksheetsXml}
</Workbook>`;
};

export const downloadExcelWorkbook = (
  fileName: string,
  sheets: ExcelTemplateSheet[]
): void => {
  const workbookXml = buildWorkbookXml(sheets);
  const blob = new Blob([`\uFEFF${workbookXml}`], { type: 'application/vnd.ms-excel;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${fileName}.xls`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

export const downloadExcelTemplate = (
  fileName: string,
  sheetName: string,
  headers: string[],
  rows: ExcelTemplateRow[]
): void => {
  downloadExcelWorkbook(fileName, [{ name: sheetName, headers, rows }]);
};
