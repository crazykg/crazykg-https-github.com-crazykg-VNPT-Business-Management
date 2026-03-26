interface OpenProductQuotationPreviewOptions {
  title?: string;
  loadPdf: () => Promise<Blob>;
}

const escapeHtml = (value: string): string =>
  value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');

const buildPdfViewerHtml = (pdfUrl: string, title: string): string => `<!doctype html>
<html lang="vi">
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <style>
      html,
      body {
        margin: 0;
        height: 100%;
        background: #cbd5e1;
        font-family: Inter, Arial, sans-serif;
      }

      .viewer-shell {
        display: flex;
        flex-direction: column;
        height: 100vh;
      }

      .toolbar {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        padding: 12px 16px;
        background: rgba(15, 23, 42, 0.88);
        color: #fff;
      }

      .toolbar h1 {
        margin: 0;
        font-size: 15px;
        font-weight: 700;
      }

      iframe {
        display: block;
        width: 100%;
        height: calc(100vh - 56px);
        border: 0;
        background: #cbd5e1;
      }

      .fallback {
        padding: 12px 16px;
        background: #fff;
        color: #334155;
        font-size: 14px;
      }

      .fallback a {
        color: #0f766e;
        font-weight: 600;
      }
    </style>
  </head>
  <body>
    <div class="viewer-shell">
      <div class="toolbar">
        <h1>${escapeHtml(title)}</h1>
      </div>
      <iframe title="${escapeHtml(title)}" src="${pdfUrl}#toolbar=1&navpanes=0&scrollbar=1"></iframe>
      <div class="fallback">
        Nếu trình duyệt không hiển thị PDF trong khung, hãy
        <a href="${pdfUrl}" target="_blank" rel="noopener noreferrer">mở trực tiếp file PDF</a>.
      </div>
    </div>
  </body>
</html>`;

export const openProductQuotationPreview = async ({
  title = 'Xem báo giá',
  loadPdf,
}: OpenProductQuotationPreviewOptions): Promise<boolean> => {
  const popup = window.open('about:blank', '_blank');
  if (!popup) {
    return false;
  }

  try {
    const pdfBlob = await loadPdf();
    const pdfUrl = URL.createObjectURL(pdfBlob);
    const wrapperHtml = buildPdfViewerHtml(pdfUrl, title);
    const wrapperBlob = new Blob([wrapperHtml], { type: 'text/html;charset=utf-8' });
    const wrapperUrl = URL.createObjectURL(wrapperBlob);

    if (popup.location && typeof popup.location.replace === 'function') {
      popup.location.replace(wrapperUrl);
    } else if (popup.location) {
      popup.location.href = wrapperUrl;
    }

    if (typeof popup.focus === 'function') {
      popup.focus();
    }

    window.setTimeout(() => {
      URL.revokeObjectURL(pdfUrl);
      URL.revokeObjectURL(wrapperUrl);
    }, 60000);

    return true;
  } catch (error) {
    if (typeof popup.close === 'function') {
      popup.close();
    }
    throw error;
  }
};
