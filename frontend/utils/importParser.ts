export interface ParsedImportSheet {
  name: string;
  headers: string[];
  rows: string[][];
}

export interface ParsedImportFile {
  fileName: string;
  extension: string;
  sheets: ParsedImportSheet[];
}

const XML_NS_SS = 'urn:schemas-microsoft-com:office:spreadsheet';

const normalizeText = (value: unknown): string =>
  String(value ?? '')
    .replace(/\uFEFF/g, '')
    .replace(/\r/g, '')
    .trim();

const normalizeToken = (value: unknown): string =>
  normalizeText(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '');

const readFileAsText = (file: File): Promise<string> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('Không thể đọc nội dung file.'));
    reader.readAsText(file, 'utf-8');
  });

const detectCsvDelimiter = (rawText: string): string => {
  const firstLine = rawText
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find((line) => line.length > 0) || '';

  const candidates = [',', ';', '\t', '|'];
  let best = ',';
  let maxCount = -1;

  candidates.forEach((delimiter) => {
    let inQuotes = false;
    let count = 0;

    for (let i = 0; i < firstLine.length; i += 1) {
      const ch = firstLine[i];
      if (ch === '"') {
        if (inQuotes && firstLine[i + 1] === '"') {
          i += 1;
        } else {
          inQuotes = !inQuotes;
        }
      } else if (!inQuotes && ch === delimiter) {
        count += 1;
      }
    }

    if (count > maxCount) {
      maxCount = count;
      best = delimiter;
    }
  });

  return best;
};

const parseCsvRows = (rawText: string, delimiter: string): string[][] => {
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  const pushCell = () => {
    currentRow.push(normalizeText(currentCell));
    currentCell = '';
  };

  const pushRow = () => {
    const hasData = currentRow.some((cell) => cell.trim().length > 0);
    if (hasData) {
      rows.push(currentRow);
    }
    currentRow = [];
  };

  for (let i = 0; i < rawText.length; i += 1) {
    const ch = rawText[i];

    if (ch === '"') {
      if (inQuotes && rawText[i + 1] === '"') {
        currentCell += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
      continue;
    }

    if (!inQuotes && ch === delimiter) {
      pushCell();
      continue;
    }

    if (!inQuotes && (ch === '\n' || ch === '\r')) {
      pushCell();
      pushRow();
      if (ch === '\r' && rawText[i + 1] === '\n') {
        i += 1;
      }
      continue;
    }

    currentCell += ch;
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    pushCell();
    pushRow();
  }

  return rows;
};

const normalizeTableRows = (rows: string[][]): string[][] => {
  const maxColumns = rows.reduce((max, row) => Math.max(max, row.length), 0);
  if (maxColumns === 0) {
    return [];
  }

  return rows.map((row) => {
    const next = [...row];
    while (next.length < maxColumns) {
      next.push('');
    }
    return next.map((cell) => normalizeText(cell));
  });
};

const buildSheet = (name: string, rows: string[][]): ParsedImportSheet => {
  const normalizedRows = normalizeTableRows(rows);
  if (normalizedRows.length === 0) {
    return { name, headers: [], rows: [] };
  }

  const [headers, ...bodyRows] = normalizedRows;
  return {
    name,
    headers: headers.map((header) => normalizeText(header)),
    rows: bodyRows,
  };
};

const parseCsvFile = async (file: File): Promise<ParsedImportFile> => {
  const text = await readFileAsText(file);
  const delimiter = detectCsvDelimiter(text);
  const rows = parseCsvRows(text, delimiter);

  return {
    fileName: file.name,
    extension: 'csv',
    sheets: [buildSheet('CSV', rows)],
  };
};

const getChildrenByLocalName = (parent: Element, localName: string): Element[] =>
  Array.from(parent.children).filter((child) => child.localName === localName);

const parseSpreadsheetXml = async (file: File): Promise<ParsedImportFile> => {
  const text = await readFileAsText(file);
  if (!/<\s*Workbook[\s>]/i.test(text)) {
    throw new Error('File .xls chưa đúng định dạng mẫu. Vui lòng dùng file mẫu của hệ thống.');
  }

  const parser = new DOMParser();
  const xml = parser.parseFromString(text, 'application/xml');
  if (xml.getElementsByTagName('parsererror').length > 0) {
    throw new Error('Không thể đọc file .xls. Vui lòng kiểm tra lại nội dung file.');
  }

  const worksheetNodes = [
    ...Array.from(xml.getElementsByTagName('Worksheet')),
    ...Array.from(xml.getElementsByTagNameNS(XML_NS_SS, 'Worksheet')),
  ].filter((node, index, all) => all.indexOf(node) === index);

  const sheets = worksheetNodes.map((worksheet, sheetIndex) => {
    const sheetName =
      worksheet.getAttribute('ss:Name') ||
      worksheet.getAttribute('Name') ||
      `Sheet${sheetIndex + 1}`;

    const table =
      getChildrenByLocalName(worksheet, 'Table')[0] ||
      Array.from(worksheet.getElementsByTagName('Table'))[0] ||
      Array.from(worksheet.getElementsByTagNameNS(XML_NS_SS, 'Table'))[0];

    if (!table) {
      return { name: sheetName, headers: [], rows: [] };
    }

    const rowNodes = [
      ...getChildrenByLocalName(table, 'Row'),
      ...Array.from(table.getElementsByTagName('Row')),
      ...Array.from(table.getElementsByTagNameNS(XML_NS_SS, 'Row')),
    ].filter((node, index, all) => all.indexOf(node) === index);

    const rows = rowNodes.map((rowNode) => {
      const cells = [
        ...getChildrenByLocalName(rowNode, 'Cell'),
        ...Array.from(rowNode.getElementsByTagName('Cell')),
        ...Array.from(rowNode.getElementsByTagNameNS(XML_NS_SS, 'Cell')),
      ].filter((node, index, all) => all.indexOf(node) === index);

      const row: string[] = [];
      let colIndex = 1;

      cells.forEach((cell) => {
        const rawIndex =
          cell.getAttribute('ss:Index') ||
          cell.getAttribute('Index') ||
          cell.getAttributeNS(XML_NS_SS, 'Index');

        const targetIndex = rawIndex ? Number(rawIndex) : null;
        if (targetIndex && Number.isFinite(targetIndex) && targetIndex > colIndex) {
          while (colIndex < targetIndex) {
            row.push('');
            colIndex += 1;
          }
        }

        const dataNode =
          getChildrenByLocalName(cell, 'Data')[0] ||
          Array.from(cell.getElementsByTagName('Data'))[0] ||
          Array.from(cell.getElementsByTagNameNS(XML_NS_SS, 'Data'))[0];

        const value = normalizeText(dataNode?.textContent || cell.textContent || '');
        row.push(value);
        colIndex += 1;
      });

      while (row.length > 0 && !row[row.length - 1]) {
        row.pop();
      }
      return row;
    });

    return buildSheet(sheetName, rows);
  });

  return {
    fileName: file.name,
    extension: 'xls',
    sheets,
  };
};

export const parseImportFile = async (file: File): Promise<ParsedImportFile> => {
  const extension = normalizeText(file.name.split('.').pop()).toLowerCase();

  if (extension === 'csv') {
    return parseCsvFile(file);
  }

  if (extension === 'xls') {
    return parseSpreadsheetXml(file);
  }

  if (extension === 'xlsx') {
    throw new Error('Định dạng .xlsx chưa hỗ trợ ở bản này. Vui lòng dùng file .xls hoặc .csv.');
  }

  throw new Error('Định dạng file không hợp lệ. Vui lòng dùng .xls hoặc .csv.');
};

const findSheetByKeyword = (sheets: ParsedImportSheet[], keywords: string[]): ParsedImportSheet | undefined => {
  if (sheets.length === 0) {
    return undefined;
  }

  return sheets.find((sheet) => {
    const token = normalizeToken(sheet.name);
    return keywords.some((keyword) => token.includes(keyword));
  });
};

export const pickImportSheetByModule = (
  moduleKey: string,
  parsedFile: ParsedImportFile
): ParsedImportSheet | undefined => {
  const token = normalizeToken(moduleKey);
  const sheets = parsedFile.sheets || [];

  if (token === 'employees') {
    return (
      findSheetByKeyword(sheets, ['nhansu', 'nhanvien', 'employee']) ||
      sheets.find((sheet) => sheet.headers.length > 0) ||
      sheets[0]
    );
  }

  if (token === 'departments') {
    return (
      findSheetByKeyword(sheets, ['phongban', 'department']) ||
      sheets.find((sheet) => sheet.headers.length > 0) ||
      sheets[0]
    );
  }

  if (token === 'businesses') {
    return (
      findSheetByKeyword(sheets, ['linhvuc', 'business']) ||
      sheets.find((sheet) => sheet.headers.length > 0) ||
      sheets[0]
    );
  }

  if (token === 'vendors') {
    return (
      findSheetByKeyword(sheets, ['doitac', 'vendor', 'nhacungcap']) ||
      sheets.find((sheet) => sheet.headers.length > 0) ||
      sheets[0]
    );
  }

  if (token === 'products') {
    return (
      findSheetByKeyword(sheets, ['sanpham', 'product']) ||
      sheets.find((sheet) => sheet.headers.length > 0) ||
      sheets[0]
    );
  }

  if (token === 'clients') {
    return (
      findSheetByKeyword(sheets, ['khachhang', 'customer']) ||
      sheets.find((sheet) => sheet.headers.length > 0) ||
      sheets[0]
    );
  }

  return sheets.find((sheet) => sheet.headers.length > 0) || sheets[0];
};
