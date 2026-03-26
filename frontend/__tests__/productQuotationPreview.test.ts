// @vitest-environment jsdom

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { openProductQuotationPreview } from '../utils/productQuotationPreview';

describe('openProductQuotationPreview', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    Object.defineProperty(URL, 'createObjectURL', {
      configurable: true,
      value: vi.fn()
        .mockReturnValueOnce('blob:pdf-preview')
        .mockReturnValueOnce('blob:viewer-wrapper'),
    });
    Object.defineProperty(URL, 'revokeObjectURL', {
      configurable: true,
      value: vi.fn(),
    });
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('opens a blank tab first and then navigates it to the embedded pdf viewer', async () => {
    const focus = vi.fn();
    const replace = vi.fn();
    const close = vi.fn();
    const popup = {
      focus,
      close,
      location: { replace },
    } as unknown as Window;
    const loadPdf = vi.fn().mockResolvedValue(new Blob(['pdf'], { type: 'application/pdf' }));
    const windowOpenSpy = vi.spyOn(window, 'open').mockReturnValue(popup);

    const opened = await openProductQuotationPreview({
      title: 'Xem báo giá',
      loadPdf,
    });

    vi.runAllTimers();

    expect(opened).toBe(true);
    expect(windowOpenSpy).toHaveBeenCalledWith('about:blank', '_blank');
    expect(loadPdf).toHaveBeenCalledTimes(1);
    expect(replace).toHaveBeenCalledWith('blob:viewer-wrapper');
    expect(focus).toHaveBeenCalledTimes(1);
    expect(close).not.toHaveBeenCalled();
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:pdf-preview');
    expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:viewer-wrapper');
  });

  it('closes the preview tab and rethrows when pdf generation fails', async () => {
    const close = vi.fn();
    const popup = {
      close,
      focus: vi.fn(),
      location: { replace: vi.fn() },
    } as unknown as Window;
    const loadPdf = vi.fn().mockRejectedValue(new Error('PDF failed'));
    vi.spyOn(window, 'open').mockReturnValue(popup);

    await expect(
      openProductQuotationPreview({
        title: 'Xem báo giá',
        loadPdf,
      })
    ).rejects.toThrow('PDF failed');

    expect(close).toHaveBeenCalledTimes(1);
  });
});
