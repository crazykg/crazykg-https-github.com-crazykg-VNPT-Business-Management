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

const readFileAsArrayBuffer = (file: File): Promise<ArrayBuffer> =>
  new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (result instanceof ArrayBuffer) {
        resolve(result);
        return;
      }
      reject(new Error('Không thể đọc nội dung file nhị phân.'));
    };
    reader.onerror = () => reject(new Error('Không thể đọc nội dung file.'));
    reader.readAsArrayBuffer(file);
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

const hasLocalName = (element: Element, localName: string): boolean => {
  const target = localName.toLowerCase();
  const local = String(element.localName || '').toLowerCase();
  if (local === target) {
    return true;
  }

  const nodeName = String(element.nodeName || '').toLowerCase();
  return nodeName === target || nodeName.endsWith(`:${target}`);
};

const uniqueElements = (elements: Element[]): Element[] =>
  elements.filter((node, index, all) => all.indexOf(node) === index);

const getChildrenByLocalName = (parent: Element, localName: string): Element[] =>
  uniqueElements(Array.from(parent.children).filter((child) => hasLocalName(child, localName)));

const getDescendantsByLocalName = (root: ParentNode, localName: string): Element[] =>
  uniqueElements(Array.from(root.querySelectorAll('*')).filter((element) => hasLocalName(element, localName)));

const parseSpreadsheetXmlText = (
  text: string,
  fileName: string,
  extension: string
): ParsedImportFile => {
  if (!/<\s*Workbook[\s>]/i.test(text)) {
    throw new Error('File Excel chưa đúng định dạng mẫu. Vui lòng dùng file mẫu của hệ thống.');
  }

  const parser = new DOMParser();
  const xml = parser.parseFromString(text, 'application/xml');
  if (xml.getElementsByTagName('parsererror').length > 0) {
    throw new Error('Không thể đọc file .xls. Vui lòng kiểm tra lại nội dung file.');
  }

  const worksheetNodes = uniqueElements([
    ...Array.from(xml.getElementsByTagName('Worksheet')),
    ...Array.from(xml.getElementsByTagNameNS(XML_NS_SS, 'Worksheet')),
    ...getDescendantsByLocalName(xml, 'Worksheet'),
  ]);

  const sheets = worksheetNodes.map((worksheet, sheetIndex) => {
    const sheetName =
      worksheet.getAttribute('ss:Name') ||
      worksheet.getAttributeNS(XML_NS_SS, 'Name') ||
      worksheet.getAttribute('Name') ||
      `Sheet${sheetIndex + 1}`;

    const table =
      getChildrenByLocalName(worksheet, 'Table')[0] ||
      Array.from(worksheet.getElementsByTagName('Table'))[0] ||
      Array.from(worksheet.getElementsByTagNameNS(XML_NS_SS, 'Table'))[0] ||
      getDescendantsByLocalName(worksheet, 'Table')[0];

    if (!table) {
      return { name: sheetName, headers: [], rows: [] };
    }

    const rowNodes = uniqueElements([
      ...getChildrenByLocalName(table, 'Row'),
      ...Array.from(table.getElementsByTagName('Row')),
      ...Array.from(table.getElementsByTagNameNS(XML_NS_SS, 'Row')),
      ...getDescendantsByLocalName(table, 'Row'),
    ]);

    const rows = rowNodes.map((rowNode) => {
      const cells = uniqueElements([
        ...getChildrenByLocalName(rowNode, 'Cell'),
        ...Array.from(rowNode.getElementsByTagName('Cell')),
        ...Array.from(rowNode.getElementsByTagNameNS(XML_NS_SS, 'Cell')),
        ...getDescendantsByLocalName(rowNode, 'Cell'),
      ]);

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
          Array.from(cell.getElementsByTagNameNS(XML_NS_SS, 'Data'))[0] ||
          getDescendantsByLocalName(cell, 'Data')[0];

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

  return { fileName, extension, sheets };
};

const parseSpreadsheetXml = async (file: File): Promise<ParsedImportFile> => {
  const text = await readFileAsText(file);
  return parseSpreadsheetXmlText(text, file.name, 'xls');
};

const CFB_SIGNATURE = [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1];
const CFB_FREE_SECTOR = 0xffffffff;
const CFB_END_OF_CHAIN = 0xfffffffe;
const CFB_FAT_SECTOR = 0xfffffffd;
const CFB_DIFAT_SECTOR = 0xfffffffc;
const CFB_MINI_STREAM_CUTOFF = 4096;

const BIFF_BOUNDSHEET = 0x0085;
const BIFF_SST = 0x00fc;
const BIFF_CONTINUE = 0x003c;
const BIFF_EOF = 0x000a;
const BIFF_NUMBER = 0x0203;
const BIFF_LABEL = 0x0204;
const BIFF_LABEL_SST = 0x00fd;
const BIFF_RK = 0x027e;

const utf16Decoder = new TextDecoder('utf-16le');

const readUInt16LE = (data: Uint8Array, offset: number): number =>
  new DataView(data.buffer, data.byteOffset + offset, 2).getUint16(0, true);

const readUInt32LE = (data: Uint8Array, offset: number): number =>
  new DataView(data.buffer, data.byteOffset + offset, 4).getUint32(0, true);

const readFloat64LE = (data: Uint8Array, offset: number): number =>
  new DataView(data.buffer, data.byteOffset + offset, 8).getFloat64(0, true);

const decodeUtf16Le = (bytes: Uint8Array): string => {
  if (bytes.length === 0) {
    return '';
  }
  return utf16Decoder.decode(bytes);
};

const decodeLatin1 = (bytes: Uint8Array): string => {
  let result = '';
  for (let i = 0; i < bytes.length; i += 1) {
    result += String.fromCharCode(bytes[i]);
  }
  return result;
};

const concatUint8Arrays = (chunks: Uint8Array[], expectedLength?: number): Uint8Array => {
  const totalLength = expectedLength ?? chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const output = new Uint8Array(totalLength);
  let offset = 0;
  chunks.forEach((chunk) => {
    if (offset >= totalLength) {
      return;
    }
    const remaining = totalLength - offset;
    const slice = remaining >= chunk.length ? chunk : chunk.subarray(0, remaining);
    output.set(slice, offset);
    offset += slice.length;
  });
  return output;
};

const hasCfbSignature = (bytes: Uint8Array): boolean =>
  bytes.length >= CFB_SIGNATURE.length &&
  CFB_SIGNATURE.every((value, index) => bytes[index] === value);

const readSector = (data: Uint8Array, sectorId: number, sectorSize: number): Uint8Array => {
  const start = 512 + sectorId * sectorSize;
  const end = start + sectorSize;
  if (start < 0 || start >= data.length) {
    return new Uint8Array();
  }
  return data.subarray(start, Math.min(end, data.length));
};

const buildChain = (startSector: number, table: number[], limit = 100000): number[] => {
  const chain: number[] = [];
  if (
    startSector < 0 ||
    startSector === CFB_FREE_SECTOR ||
    startSector === CFB_END_OF_CHAIN ||
    startSector >= table.length
  ) {
    return chain;
  }

  const visited = new Set<number>();
  let current = startSector;

  while (
    current !== CFB_END_OF_CHAIN &&
    current !== CFB_FREE_SECTOR &&
    current >= 0 &&
    current < table.length &&
    !visited.has(current) &&
    chain.length < limit
  ) {
    chain.push(current);
    visited.add(current);
    current = table[current];
  }

  return chain;
};

const readRegularStream = (
  data: Uint8Array,
  sectorSize: number,
  fat: number[],
  startSector: number,
  streamSize: number
): Uint8Array => {
  const chain = buildChain(startSector, fat);
  if (chain.length === 0) {
    return new Uint8Array();
  }

  const chunks: Uint8Array[] = [];
  let copied = 0;
  chain.forEach((sectorId) => {
    if (streamSize > 0 && copied >= streamSize) {
      return;
    }
    const sector = readSector(data, sectorId, sectorSize);
    if (sector.length === 0) {
      return;
    }
    const remaining = streamSize > 0 ? Math.max(streamSize - copied, 0) : sector.length;
    const take = Math.min(sector.length, remaining);
    chunks.push(sector.subarray(0, take));
    copied += take;
  });

  if (chunks.length === 0) {
    return new Uint8Array();
  }

  return concatUint8Arrays(chunks, streamSize > 0 ? Math.min(streamSize, copied) : copied);
};

interface CfbDirectoryEntry {
  name: string;
  type: number;
  startSector: number;
  streamSize: number;
}

const parseCfbDirectoryEntries = (directoryStream: Uint8Array, majorVersion: number): CfbDirectoryEntry[] => {
  const entries: CfbDirectoryEntry[] = [];
  const entrySize = 128;

  for (let offset = 0; offset + entrySize <= directoryStream.length; offset += entrySize) {
    const entry = directoryStream.subarray(offset, offset + entrySize);
    const nameByteLength = readUInt16LE(entry, 64);
    const type = entry[66];
    if (nameByteLength < 2 || type === 0) {
      continue;
    }

    const safeNameLength = Math.max(0, Math.min(nameByteLength - 2, 64));
    const rawName = decodeUtf16Le(entry.subarray(0, safeNameLength));
    const name = rawName.replace(/\u0000/g, '').trim();
    if (!name) {
      continue;
    }

    const startSector = readUInt32LE(entry, 116);
    const lowSize = readUInt32LE(entry, 120);
    const highSize = readUInt32LE(entry, 124);
    const streamSize =
      majorVersion >= 4
        ? lowSize + highSize * 0x100000000
        : lowSize;

    entries.push({
      name,
      type,
      startSector,
      streamSize: Number.isFinite(streamSize) ? Math.max(0, Math.floor(streamSize)) : 0,
    });
  }

  return entries;
};

const extractWorkbookStreamFromBinaryXls = (data: Uint8Array): Uint8Array => {
  if (!hasCfbSignature(data)) {
    throw new Error('File .xls chưa đúng định dạng mẫu. Vui lòng dùng file mẫu của hệ thống.');
  }

  const majorVersion = readUInt16LE(data, 26);
  const sectorShift = readUInt16LE(data, 30);
  const sectorSize = 1 << sectorShift;
  const miniSectorShift = readUInt16LE(data, 32);
  const miniSectorSize = 1 << miniSectorShift;
  const numFatSectors = readUInt32LE(data, 44);
  const firstDirectorySector = readUInt32LE(data, 48);
  const miniStreamCutoffSize = readUInt32LE(data, 56) || CFB_MINI_STREAM_CUTOFF;
  const firstMiniFatSector = readUInt32LE(data, 60);
  const numMiniFatSectors = readUInt32LE(data, 64);
  const firstDifatSector = readUInt32LE(data, 68);
  const numDifatSectors = readUInt32LE(data, 72);

  const difat: number[] = [];
  for (let i = 0; i < 109; i += 1) {
    const sectorId = readUInt32LE(data, 76 + i * 4);
    if (sectorId !== CFB_FREE_SECTOR) {
      difat.push(sectorId);
    }
  }

  let difatSector = firstDifatSector;
  for (let i = 0; i < numDifatSectors; i += 1) {
    if (
      difatSector === CFB_END_OF_CHAIN ||
      difatSector === CFB_FREE_SECTOR ||
      difatSector === CFB_FAT_SECTOR ||
      difatSector === CFB_DIFAT_SECTOR
    ) {
      break;
    }
    const sectorBytes = readSector(data, difatSector, sectorSize);
    if (sectorBytes.length === 0) {
      break;
    }

    const entriesPerSector = Math.floor(sectorSize / 4) - 1;
    for (let j = 0; j < entriesPerSector; j += 1) {
      const sectorId = readUInt32LE(sectorBytes, j * 4);
      if (sectorId !== CFB_FREE_SECTOR) {
        difat.push(sectorId);
      }
    }
    difatSector = readUInt32LE(sectorBytes, sectorSize - 4);
  }

  const fatSectorIds = difat.slice(0, numFatSectors).filter((sectorId) => sectorId !== CFB_FREE_SECTOR);
  if (fatSectorIds.length === 0) {
    throw new Error('Không thể đọc cấu trúc file .xls.');
  }

  const fat: number[] = [];
  fatSectorIds.forEach((sectorId) => {
    const sectorBytes = readSector(data, sectorId, sectorSize);
    for (let i = 0; i + 4 <= sectorBytes.length; i += 4) {
      fat.push(readUInt32LE(sectorBytes, i));
    }
  });

  const directoryStream = readRegularStream(data, sectorSize, fat, firstDirectorySector, 0);
  if (directoryStream.length === 0) {
    throw new Error('Không thể đọc thư mục file .xls.');
  }

  const directoryEntries = parseCfbDirectoryEntries(directoryStream, majorVersion);
  const rootEntry = directoryEntries.find((entry) => entry.type === 5);
  const workbookEntry = directoryEntries.find((entry) => {
    const normalized = entry.name.trim().toLowerCase();
    return normalized === 'workbook' || normalized === 'book';
  });

  if (!workbookEntry) {
    throw new Error('Không tìm thấy sheet dữ liệu trong file .xls.');
  }

  if (workbookEntry.streamSize < miniStreamCutoffSize) {
    if (!rootEntry) {
      throw new Error('Không thể đọc luồng mini trong file .xls.');
    }

    const miniStream = readRegularStream(
      data,
      sectorSize,
      fat,
      rootEntry.startSector,
      rootEntry.streamSize
    );

    const miniFatChain = buildChain(firstMiniFatSector, fat, numMiniFatSectors + 8);
    const miniFatBytes = concatUint8Arrays(
      miniFatChain.map((sectorId) => readSector(data, sectorId, sectorSize))
    );
    const miniFat: number[] = [];
    for (let i = 0; i + 4 <= miniFatBytes.length; i += 4) {
      miniFat.push(readUInt32LE(miniFatBytes, i));
    }

    const miniChain = buildChain(workbookEntry.startSector, miniFat);
    if (miniChain.length === 0) {
      throw new Error('Không thể đọc nội dung workbook từ file .xls.');
    }

    const chunks: Uint8Array[] = [];
    let copied = 0;
    miniChain.forEach((miniSectorId) => {
      if (copied >= workbookEntry.streamSize) {
        return;
      }
      const start = miniSectorId * miniSectorSize;
      const end = start + miniSectorSize;
      if (start >= miniStream.length) {
        return;
      }
      const sectorBytes = miniStream.subarray(start, Math.min(end, miniStream.length));
      const remaining = workbookEntry.streamSize - copied;
      const take = Math.min(sectorBytes.length, remaining);
      chunks.push(sectorBytes.subarray(0, take));
      copied += take;
    });

    return concatUint8Arrays(chunks, workbookEntry.streamSize);
  }

  return readRegularStream(
    data,
    sectorSize,
    fat,
    workbookEntry.startSector,
    workbookEntry.streamSize
  );
};

interface BiffRecord {
  id: number;
  data: Uint8Array;
  offset: number;
}

const parseBiffRecords = (workbookStream: Uint8Array): BiffRecord[] => {
  const records: BiffRecord[] = [];
  let offset = 0;

  while (offset + 4 <= workbookStream.length) {
    const id = readUInt16LE(workbookStream, offset);
    const size = readUInt16LE(workbookStream, offset + 2);
    const dataStart = offset + 4;
    const dataEnd = dataStart + size;
    if (dataEnd > workbookStream.length) {
      break;
    }

    records.push({
      id,
      data: workbookStream.subarray(dataStart, dataEnd),
      offset,
    });

    offset = dataEnd;
  }

  return records;
};

interface BoundSheetInfo {
  name: string;
  offset: number;
}

const parseBoundSheets = (records: BiffRecord[]): BoundSheetInfo[] =>
  records
    .filter((record) => record.id === BIFF_BOUNDSHEET && record.data.length >= 8)
    .map((record, index) => {
      const offset = readUInt32LE(record.data, 0);
      const nameLength = record.data[6];
      const optionFlags = record.data[7];
      const isUtf16 = (optionFlags & 0x01) === 0x01;
      const nameBytesLength = isUtf16 ? nameLength * 2 : nameLength;
      const nameStart = 8;
      const nameEnd = Math.min(record.data.length, nameStart + nameBytesLength);
      const nameBytes = record.data.subarray(nameStart, nameEnd);
      const name = normalizeText(isUtf16 ? decodeUtf16Le(nameBytes) : decodeLatin1(nameBytes));
      return {
        name: name || `Sheet${index + 1}`,
        offset,
      };
    })
    .filter((sheet) => Number.isFinite(sheet.offset) && sheet.offset >= 0)
    .sort((a, b) => a.offset - b.offset);

const parseSstString = (
  buffer: Uint8Array,
  startOffset: number
): { value: string; nextOffset: number } | null => {
  if (startOffset + 3 > buffer.length) {
    return null;
  }

  let offset = startOffset;
  const charCount = readUInt16LE(buffer, offset);
  offset += 2;

  const flags = buffer[offset];
  offset += 1;

  let richTextRuns = 0;
  let extensionLength = 0;
  if ((flags & 0x08) === 0x08) {
    if (offset + 2 > buffer.length) return null;
    richTextRuns = readUInt16LE(buffer, offset);
    offset += 2;
  }
  if ((flags & 0x04) === 0x04) {
    if (offset + 4 > buffer.length) return null;
    extensionLength = readUInt32LE(buffer, offset);
    offset += 4;
  }

  const isUtf16 = (flags & 0x01) === 0x01;
  const charBytesLength = charCount * (isUtf16 ? 2 : 1);
  if (offset + charBytesLength > buffer.length) {
    return null;
  }
  const textBytes = buffer.subarray(offset, offset + charBytesLength);
  offset += charBytesLength;

  const richTextBytes = richTextRuns * 4;
  if (offset + richTextBytes > buffer.length) {
    return null;
  }
  offset += richTextBytes;

  if (offset + extensionLength > buffer.length) {
    return null;
  }
  offset += extensionLength;

  const value = isUtf16 ? decodeUtf16Le(textBytes) : decodeLatin1(textBytes);
  return { value: normalizeText(value), nextOffset: offset };
};

const parseSharedStrings = (records: BiffRecord[]): string[] => {
  const sstIndex = records.findIndex((record) => record.id === BIFF_SST);
  if (sstIndex < 0) {
    return [];
  }

  const chunks: Uint8Array[] = [records[sstIndex].data];
  for (let i = sstIndex + 1; i < records.length; i += 1) {
    if (records[i].id !== BIFF_CONTINUE) {
      break;
    }
    chunks.push(records[i].data);
  }

  const sstBuffer = concatUint8Arrays(chunks);
  if (sstBuffer.length < 8) {
    return [];
  }

  const uniqueCount = readUInt32LE(sstBuffer, 4);
  const values: string[] = [];
  let offset = 8;

  for (let i = 0; i < uniqueCount && offset < sstBuffer.length; i += 1) {
    const parsed = parseSstString(sstBuffer, offset);
    if (!parsed) {
      break;
    }
    values.push(parsed.value);
    offset = parsed.nextOffset;
  }

  return values;
};

const decodeRkInteger = (rkValue: number): string | null => {
  const isInteger = (rkValue & 0x02) === 0x02;
  if (!isInteger) {
    return null;
  }

  let value = rkValue >> 2;
  if ((value & 0x20000000) !== 0) {
    value -= 0x40000000;
  }

  if ((rkValue & 0x01) === 0x01) {
    return String(value / 100);
  }

  return String(value);
};

const formatNumericValue = (value: number): string => {
  if (!Number.isFinite(value)) {
    return '';
  }
  if (Math.abs(value) > 0 && Math.abs(value) < 1e-6) {
    return value.toExponential();
  }
  if (Number.isInteger(value)) {
    return String(value);
  }
  return String(value);
};

const parseWorksheetRows = (
  workbookStream: Uint8Array,
  startOffset: number,
  sharedStrings: string[]
): string[][] => {
  if (startOffset < 0 || startOffset >= workbookStream.length) {
    return [];
  }

  const cellMap = new Map<number, Map<number, string>>();
  let maxRow = -1;
  let maxCol = -1;
  const setCell = (row: number, col: number, value: string): void => {
    if (row < 0 || col < 0) {
      return;
    }
    if (!cellMap.has(row)) {
      cellMap.set(row, new Map<number, string>());
    }
    cellMap.get(row)?.set(col, normalizeText(value));
    maxRow = Math.max(maxRow, row);
    maxCol = Math.max(maxCol, col);
  };

  let offset = startOffset;
  while (offset + 4 <= workbookStream.length) {
    const id = readUInt16LE(workbookStream, offset);
    const size = readUInt16LE(workbookStream, offset + 2);
    const dataStart = offset + 4;
    const dataEnd = dataStart + size;
    if (dataEnd > workbookStream.length) {
      break;
    }

    const data = workbookStream.subarray(dataStart, dataEnd);
    if (id === BIFF_EOF) {
      break;
    }

    if (id === BIFF_LABEL_SST && data.length >= 10) {
      const row = readUInt16LE(data, 0);
      const col = readUInt16LE(data, 2);
      const sstIndex = readUInt32LE(data, 6);
      setCell(row, col, sharedStrings[sstIndex] || '');
    } else if (id === BIFF_LABEL && data.length >= 8) {
      const row = readUInt16LE(data, 0);
      const col = readUInt16LE(data, 2);
      const textLength = readUInt16LE(data, 6);
      const textBytes = data.subarray(8, Math.min(data.length, 8 + textLength));
      setCell(row, col, decodeLatin1(textBytes));
    } else if (id === BIFF_NUMBER && data.length >= 14) {
      const row = readUInt16LE(data, 0);
      const col = readUInt16LE(data, 2);
      const value = readFloat64LE(data, 6);
      setCell(row, col, formatNumericValue(value));
    } else if (id === BIFF_RK && data.length >= 10) {
      const row = readUInt16LE(data, 0);
      const col = readUInt16LE(data, 2);
      const rkValue = readUInt32LE(data, 6);
      const parsed = decodeRkInteger(rkValue);
      if (parsed !== null) {
        setCell(row, col, parsed);
      }
    }

    offset = dataEnd;
  }

  if (maxRow < 0 || maxCol < 0) {
    return [];
  }

  const rows: string[][] = [];
  for (let rowIndex = 0; rowIndex <= maxRow; rowIndex += 1) {
    const rowValues = Array(maxCol + 1).fill('');
    const rowMap = cellMap.get(rowIndex);
    if (rowMap) {
      rowMap.forEach((value, colIndex) => {
        if (colIndex >= 0 && colIndex <= maxCol) {
          rowValues[colIndex] = value;
        }
      });
    }
    while (rowValues.length > 0 && !rowValues[rowValues.length - 1]) {
      rowValues.pop();
    }
    rows.push(rowValues);
  }

  return rows;
};

const parseBinaryXlsBytes = (fileName: string, bytes: Uint8Array): ParsedImportFile => {
  const workbookStream = extractWorkbookStreamFromBinaryXls(bytes);
  const records = parseBiffRecords(workbookStream);
  const sharedStrings = parseSharedStrings(records);
  const boundSheets = parseBoundSheets(records);

  const sheets =
    boundSheets.length > 0
      ? boundSheets.map((sheet) => buildSheet(sheet.name, parseWorksheetRows(workbookStream, sheet.offset, sharedStrings)))
      : [buildSheet('Sheet1', parseWorksheetRows(workbookStream, 0, sharedStrings))];

  return {
    fileName,
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
    const binary = new Uint8Array(await readFileAsArrayBuffer(file));
    if (hasCfbSignature(binary)) {
      return parseBinaryXlsBytes(file.name, binary);
    }
    return parseSpreadsheetXml(file);
  }

  if (extension === 'xml') {
    const text = await readFileAsText(file);
    return parseSpreadsheetXmlText(text, file.name, 'xml');
  }

  if (extension === 'xlsx') {
    throw new Error('Định dạng .xlsx chưa hỗ trợ ở bản này. Vui lòng dùng file .xls, .xml hoặc .csv.');
  }

  throw new Error('Định dạng file không hợp lệ. Vui lòng dùng .xls, .xml hoặc .csv.');
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

  if (token === 'employees' || token === 'internaluserlist') {
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

  if (token === 'supportrequests' || token === 'supportrequest') {
    return (
      findSheetByKeyword(sheets, ['support', 'hotro', 'task']) ||
      sheets.find((sheet) => sheet.headers.length > 0) ||
      sheets[0]
    );
  }

  return sheets.find((sheet) => sheet.headers.length > 0) || sheets[0];
};
