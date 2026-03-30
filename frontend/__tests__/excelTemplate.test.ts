// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest';
import { downloadExcelWorkbook } from '../utils/excelTemplate';

describe('downloadExcelWorkbook', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('encodes line breaks for Excel cells and preserves bullet indentation', async () => {
    let capturedBlob: Blob | null = null;
    const appendChildSpy = vi.spyOn(document.body, 'appendChild');
    const removeChildSpy = vi.spyOn(document.body, 'removeChild');
    const nativeCreateElement = document.createElement.bind(document);
    const anchorElement = nativeCreateElement('a') as HTMLAnchorElement;
    const clickSpy = vi.spyOn(anchorElement, 'click').mockImplementation(() => {});

    vi.spyOn(document, 'createElement').mockImplementation((tagName: string) => {
      if (tagName.toLowerCase() === 'a') {
        return anchorElement;
      }
      return nativeCreateElement(tagName);
    });

    const createObjectURL = vi.fn((blob: Blob | MediaSource) => {
      capturedBlob = blob as Blob;
      return 'blob:test';
    });
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', {
      value: createObjectURL,
      configurable: true,
      writable: true,
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      value: revokeObjectURL,
      configurable: true,
      writable: true,
    });

    downloadExcelWorkbook('catalog-test', [
      {
        name: 'DanhMuc',
        headers: ['Mô tả'],
        rows: [[{ value: 'Chức năng gồm các tính năng:\n\u00A0- Nhập tài khoản\n\u00A0- Nhập OTP', styleId: 'CatalogFeatureDetail' }]],
        styles: [
          {
            id: 'CatalogFeatureDetail',
            fontName: 'Times New Roman',
            fontSize: 13,
            wrapText: true,
            border: true,
          },
        ],
      },
    ]);

    expect(capturedBlob).not.toBeNull();
    const xml = await capturedBlob!.text();

    expect(xml).toContain('Chức năng gồm các tính năng:&#10;');
    expect(xml).toContain('&#10;\u00A0- Nhập tài khoản');
    expect(xml).toContain('&#10;\u00A0- Nhập OTP');
    expect(xml).toContain('xml:space="preserve"');
    expect(anchorElement.getAttribute('download')).toBe('catalog-test.xls');
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(appendChildSpy).toHaveBeenCalled();
    expect(removeChildSpy).toHaveBeenCalled();
  });
});
