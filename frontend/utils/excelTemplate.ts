export type ExcelTemplateValue = string | number | boolean | null | undefined;
export interface ExcelTemplateCell {
  value: ExcelTemplateValue;
  styleId?: string;
}
export type ExcelTemplateRowCell = ExcelTemplateValue | ExcelTemplateCell;
export type ExcelTemplateRow = ExcelTemplateRowCell[];
export interface ExcelTemplateStyle {
  id: string;
  fontName?: string;
  fontSize?: number;
  bold?: boolean;
  horizontal?: 'Left' | 'Center' | 'Right';
  vertical?: 'Top' | 'Center' | 'Bottom';
  wrapText?: boolean;
  backgroundColor?: string;
  border?: boolean;
}
export interface ExcelTemplateSheet {
  name: string;
  headers: string[];
  rows: ExcelTemplateRow[];
  columns?: number[];
  styles?: ExcelTemplateStyle[];
  headerStyleId?: string;
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

const isExcelTemplateCell = (value: ExcelTemplateRowCell): value is ExcelTemplateCell =>
  typeof value === 'object' && value !== null && 'value' in value;

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

const buildBorderXml = (): string => `<Borders>
    <Border ss:Position="Bottom" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Left" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Right" ss:LineStyle="Continuous" ss:Weight="1"/>
    <Border ss:Position="Top" ss:LineStyle="Continuous" ss:Weight="1"/>
  </Borders>`;

const buildStyleXml = (style: ExcelTemplateStyle): string => {
  const fontAttrs = [
    style.fontName ? ` ss:FontName="${escapeXml(style.fontName)}"` : '',
    style.fontSize ? ` ss:Size="${style.fontSize}"` : '',
    style.bold ? ' ss:Bold="1"' : '',
  ].join('');
  const fontXml = fontAttrs ? `<Font${fontAttrs}/>` : '';

  const alignmentAttrs = [
    style.horizontal ? ` ss:Horizontal="${style.horizontal}"` : '',
    style.vertical ? ` ss:Vertical="${style.vertical}"` : '',
    style.wrapText ? ' ss:WrapText="1"' : '',
  ].join('');
  const alignmentXml = alignmentAttrs ? `<Alignment${alignmentAttrs}/>` : '';

  const interiorXml = style.backgroundColor
    ? `<Interior ss:Color="${escapeXml(style.backgroundColor)}" ss:Pattern="Solid"/>`
    : '';

  return `<Style ss:ID="${escapeXml(style.id)}">
   ${alignmentXml}
   ${style.border ? buildBorderXml() : ''}
   ${fontXml}
   ${interiorXml}
  </Style>`;
};

const buildRowXml = (row: ExcelTemplateRow, isHeader = false, headerStyleId = 'Header'): string => {
  const cells = row
    .map((cell) => {
      const cellValue = isExcelTemplateCell(cell) ? cell.value : cell;
      const explicitStyleId = isExcelTemplateCell(cell) ? cell.styleId : undefined;
      const styleId = explicitStyleId || (isHeader ? headerStyleId : undefined);
      const styleAttr = styleId ? ` ss:StyleID="${escapeXml(styleId)}"` : '';
      const type = toCellDataType(cellValue);
      const rawValue = toCellValue(cellValue);
      const value = escapeXml(rawValue)
        .replace(/\r\n|\r|\n/g, '&#10;');
      const preserveSpaceAttr = type === 'String' ? ' xml:space="preserve"' : '';
      return `<Cell${styleAttr}><Data ss:Type="${type}"${preserveSpaceAttr}>${value}</Data></Cell>`;
    })
    .join('');

  return `<Row>${cells}</Row>`;
};

const buildWorksheetXml = (
  sheetName: string,
  headers: string[],
  rows: ExcelTemplateRow[],
  columns?: number[],
  headerStyleId?: string
): string => {
  const safeSheetName = escapeXml(normalizeSheetName(sheetName));
  const columnXml = (columns || [])
    .map((width) => `<Column ss:AutoFitWidth="0" ss:Width="${Math.max(0, width)}"/>`)
    .join('');
  const headerXml = buildRowXml(headers, true, headerStyleId);
  const bodyXml = rows.map((row) => buildRowXml(row)).join('');

  return `<Worksheet ss:Name="${safeSheetName}">
  <Table>
   ${columnXml}
   ${headerXml}
   ${bodyXml}
  </Table>
 </Worksheet>`;
};

const buildWorkbookXml = (sheets: ExcelTemplateSheet[]): string => {
  const normalizedSheets = sheets.length > 0
    ? sheets
    : [{ name: 'Sheet1', headers: [], rows: [] }];

  const customStyles = normalizedSheets
    .flatMap((sheet) => sheet.styles || [])
    .filter((style, index, collection) => collection.findIndex((item) => item.id === style.id) === index);

  const worksheetsXml = normalizedSheets
    .map((sheet) => buildWorksheetXml(sheet.name, sheet.headers, sheet.rows, sheet.columns, sheet.headerStyleId))
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
  ${customStyles.map((style) => buildStyleXml(style)).join('\n  ')}
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
