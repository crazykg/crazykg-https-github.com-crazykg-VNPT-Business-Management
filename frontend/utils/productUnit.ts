const normalizeProductUnitText = (value: unknown): string => {
  const text = String(value ?? '').trim();
  if (!text || text === '--' || text === '---') {
    return '';
  }
  return text;
};

export const normalizeProductUnitForSave = (value: unknown): string | null => {
  const text = normalizeProductUnitText(value);
  return text || null;
};

export const formatProductUnitForDisplay = (value: unknown): string => {
  return normalizeProductUnitText(value) || '—';
};

export const formatProductUnitForExport = (value: unknown): string => {
  return normalizeProductUnitText(value);
};
