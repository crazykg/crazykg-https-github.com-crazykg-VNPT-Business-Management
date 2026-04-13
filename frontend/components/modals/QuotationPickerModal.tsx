import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ProductQuotationDraft, ProductQuotationDraftListItem } from '../../services/api/productApi';
import { fetchProductQuotation, fetchProductQuotationsPage } from '../../services/api/productApi';
import type { Product, ProjectItem } from '../../types';

interface QuotationPickerModalProps {
  /** customer_id của dự án — dùng để lọc báo giá cùng đơn vị; null = hiện tất cả */
  projectCustomerId: string | number | null;
  /** Map product_id → Product để kiểm tra sản phẩm tồn tại */
  productById: Map<string, Product>;
  /** Hạng mục hiện có của dự án — dùng để hiển thị cảnh báo trùng */
  existingItems: ProjectItem[];
  onConfirm: (items: ProjectItem[], mergeMode: 'merge' | 'replace') => void;
  onClose: () => void;
}

const formatMoney = (value: number): string =>
  value.toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const formatDateTime = (value?: string | null): string => {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return new Intl.DateTimeFormat('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  }).format(d);
};

const buildQuotationItemSelectionKey = (
  item: ProductQuotationDraft['items'][number],
  idx: number
): string => String(item.id ?? `idx-${idx}`);

export const QuotationPickerModal: React.FC<QuotationPickerModalProps> = ({
  projectCustomerId,
  productById,
  existingItems,
  onConfirm,
  onClose,
}) => {
  const [isLoadingList, setIsLoadingList] = useState(true);
  const [isLoadingDetail, setIsLoadingDetail] = useState(false);
  const [quotationList, setQuotationList] = useState<ProductQuotationDraftListItem[]>([]);
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [quotationDetail, setQuotationDetail] = useState<ProductQuotationDraft | null>(null);
  const [mergeMode, setMergeMode] = useState<'merge' | 'replace'>('merge');
  const [searchText, setSearchText] = useState('');
  const [listError, setListError] = useState<string | null>(null);
  const [selectedItemKeys, setSelectedItemKeys] = useState<Set<string>>(new Set());
  const detailRequestRef = useRef(0);
  const selectAllRef = useRef<HTMLInputElement | null>(null);

  // Load danh sách báo giá — lọc theo customer_id nếu có
  useEffect(() => {
    let active = true;
    setIsLoadingList(true);
    setListError(null);

    const threeMonthsAgo = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
    const query =
      projectCustomerId != null && String(projectCustomerId).trim() !== ''
        ? {
            page: 1,
            per_page: 100,
            sort_by: 'updated_at',
            sort_dir: 'desc' as const,
            filters: {
              customer_id: projectCustomerId,
              updated_from: threeMonthsAgo,
            },
          }
        : {
            page: 1,
            per_page: 100,
            sort_by: 'updated_at',
            sort_dir: 'desc' as const,
            filters: { updated_from: threeMonthsAgo },
          };

    fetchProductQuotationsPage(query)
      .then((result) => {
        if (!active) return;
        setQuotationList(
          (Array.isArray(result.data) ? result.data : []).filter(
            (quotation) => Number(quotation.total_amount || 0) > 0
          )
        );
      })
      .catch((err: unknown) => {
        if (!active) return;
        setListError(err instanceof Error ? err.message : 'Không thể tải danh sách báo giá.');
      })
      .finally(() => {
        if (active) setIsLoadingList(false);
      });

    return () => { active = false; };
  }, [projectCustomerId]);

  // Load chi tiết khi chọn 1 báo giá
  useEffect(() => {
    if (selectedId === null) {
      setQuotationDetail(null);
      return;
    }

    const requestId = ++detailRequestRef.current;
    setIsLoadingDetail(true);
    setQuotationDetail(null);

    fetchProductQuotation(selectedId)
      .then((detail) => {
        if (detailRequestRef.current !== requestId) return;
        setQuotationDetail(detail);
      })
      .catch(() => {
        if (detailRequestRef.current !== requestId) return;
        setQuotationDetail(null);
      })
      .finally(() => {
        if (detailRequestRef.current === requestId) setIsLoadingDetail(false);
      });
  }, [selectedId]);

  const filteredList = useMemo(() => {
    if (!searchText.trim()) return quotationList;
    const q = searchText.trim().toLocaleLowerCase('vi-VN');
    return quotationList.filter((quo) =>
      [String(quo.id), String(quo.recipient_name || '')]
        .join(' ')
        .toLocaleLowerCase('vi-VN')
        .includes(q)
    );
  }, [quotationList, searchText]);

  // Phân tích items từ chi tiết báo giá
  const { eligibleItems, skippedItems } = useMemo(() => {
    if (!quotationDetail) return { eligibleItems: [], skippedItems: [] };

    const eligible: typeof quotationDetail.items = [];
    const skipped: typeof quotationDetail.items = [];

    for (const item of quotationDetail.items) {
      if (item.product_id != null && productById.has(String(item.product_id))) {
        eligible.push(item);
      } else {
        skipped.push(item);
      }
    }
    return { eligibleItems: eligible, skippedItems: skipped };
  }, [quotationDetail, productById]);

  useEffect(() => {
    setSelectedItemKeys(
      new Set(eligibleItems.map((item, idx) => buildQuotationItemSelectionKey(item, idx)))
    );
  }, [eligibleItems, selectedId]);

  const selectedEligibleItems = useMemo(
    () =>
      eligibleItems.filter((item, idx) =>
        selectedItemKeys.has(buildQuotationItemSelectionKey(item, idx))
      ),
    [eligibleItems, selectedItemKeys]
  );

  const areAllEligibleItemsSelected =
    eligibleItems.length > 0 && selectedEligibleItems.length === eligibleItems.length;
  const hasPartiallySelectedEligibleItems =
    selectedEligibleItems.length > 0 && selectedEligibleItems.length < eligibleItems.length;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = hasPartiallySelectedEligibleItems;
    }
  }, [hasPartiallySelectedEligibleItems]);

  const toggleSelectedItem = useCallback((key: string) => {
    setSelectedItemKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  }, []);

  const toggleAllEligibleItems = useCallback(() => {
    setSelectedItemKeys((prev) => {
      if (eligibleItems.length === 0) {
        return prev;
      }

      if (prev.size === eligibleItems.length) {
        return new Set<string>();
      }

      return new Set(
        eligibleItems.map((item, idx) => buildQuotationItemSelectionKey(item, idx))
      );
    });
  }, [eligibleItems]);

  const handleConfirm = useCallback(() => {
    if (!quotationDetail || selectedEligibleItems.length === 0) return;

    const newItems: ProjectItem[] = selectedEligibleItems.map((item, idx) => {
      const qty = Number(item.quantity) || 1;
      const price = Number(item.unit_price) || 0;
      return {
        id: `ITEM_QUO_${quotationDetail.id}_${item.id ?? idx}_${Date.now()}`,
        productId: String(item.product_id),
        product_id: item.product_id ?? null,
        quantity: qty,
        unitPrice: price,
        unit_price: price,
        discountPercent: 0,
        discountAmount: 0,
        lineTotal: qty * price,
        line_total: qty * price,
        discountMode: undefined,
      };
    });

    onConfirm(newItems, mergeMode);
  }, [mergeMode, onConfirm, quotationDetail, selectedEligibleItems]);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-black/40 p-4">
      <div
        data-testid="quotation-picker-modal"
        className="flex max-h-[90vh] w-full max-w-[50.5rem] flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-2xl"
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-200 bg-slate-50/80 px-4 py-3">
          <div className="flex items-center gap-2">
            <span className="material-symbols-outlined text-primary" style={{ fontSize: 20 }}>receipt_long</span>
            <h2 className="text-sm font-bold text-slate-800">Lấy hạng mục từ báo giá</h2>
            {projectCustomerId != null && String(projectCustomerId).trim() !== '' && (
              <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[10px] font-semibold text-primary">
                Cùng đơn vị
              </span>
            )}
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded p-1 text-slate-400 transition-colors hover:bg-slate-100 hover:text-slate-700"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 20 }}>close</span>
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col gap-0 overflow-hidden">
          {/* Search */}
          <div className="border-b border-slate-100 px-4 py-2.5">
            <div className="relative">
              <span className="material-symbols-outlined pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-slate-400" style={{ fontSize: 16 }}>
                search
              </span>
              <input
                type="text"
                value={searchText}
                onChange={(e) => setSearchText(e.target.value)}
                placeholder="Tìm theo tên đơn vị, mã báo giá..."
                className="h-8 w-full rounded border border-slate-200 bg-white pl-8 pr-3 text-xs text-slate-800 outline-none transition-all focus:border-primary focus:ring-1 focus:ring-primary/30"
              />
            </div>
          </div>

          <div className="flex min-h-0 flex-1 overflow-hidden">
            {/* Danh sách bên trái */}
            <div className="flex w-56 shrink-0 flex-col border-r border-slate-100">
              <div className="border-b border-slate-100 bg-slate-50/60 px-3 py-1.5">
                <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                  {isLoadingList ? 'Đang tải...' : `${filteredList.length} báo giá`}
                </p>
              </div>
              <div className="min-h-0 flex-1 overflow-y-auto">
                {listError ? (
                  <p className="px-3 py-4 text-xs text-error">{listError}</p>
                ) : isLoadingList ? (
                  <div className="flex items-center justify-center py-8">
                    <span className="material-symbols-outlined animate-spin text-slate-400" style={{ fontSize: 20 }}>progress_activity</span>
                  </div>
                ) : filteredList.length === 0 ? (
                  <p className="px-3 py-4 text-center text-xs text-slate-400">
                    {quotationList.length === 0 ? 'Chưa có báo giá phù hợp trong 3 tháng gần đây.' : 'Không tìm thấy kết quả.'}
                  </p>
                ) : (
                  <ul className="divide-y divide-slate-100">
                    {filteredList.map((quo) => {
                      const isSelected = selectedId === quo.id;
                      return (
                        <li key={quo.id}>
                          <button
                            type="button"
                            onClick={() => setSelectedId(quo.id)}
                            className={`w-full px-3 py-2.5 text-left transition-colors ${
                              isSelected
                                ? 'bg-primary/8 border-l-2 border-primary'
                                : 'hover:bg-slate-50 border-l-2 border-transparent'
                            }`}
                          >
                            <p className={`line-clamp-2 text-xs font-semibold leading-4 ${isSelected ? 'text-primary' : 'text-slate-800'}`}>
                              {String(quo.recipient_name || '').trim() || `Báo giá #${quo.id}`}
                            </p>
                            <p className="mt-0.5 text-[10px] text-slate-500">
                              {quo.items_count} hạng mục · {formatMoney(Number(quo.total_amount || 0))} đ
                            </p>
                            <p className="mt-0.5 text-[10px] text-slate-400">
                              {formatDateTime(quo.updated_at || quo.created_at)}
                            </p>
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>

            {/* Preview bên phải */}
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
              {selectedId === null ? (
                <div className="flex flex-1 items-center justify-center text-center">
                  <div>
                    <span className="material-symbols-outlined text-slate-300" style={{ fontSize: 36 }}>touch_app</span>
                    <p className="mt-2 text-xs text-slate-400">Chọn báo giá bên trái để xem trước</p>
                  </div>
                </div>
              ) : isLoadingDetail ? (
                <div className="flex flex-1 items-center justify-center">
                  <span className="material-symbols-outlined animate-spin text-slate-400" style={{ fontSize: 24 }}>progress_activity</span>
                </div>
              ) : quotationDetail === null ? (
                <div className="flex flex-1 items-center justify-center">
                  <p className="text-xs text-error">Không thể tải chi tiết báo giá.</p>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 px-3 py-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                      Xem trước hạng mục — giá trước thuế
                    </p>
                    {eligibleItems.length > 0 && (
                      <p className="text-[10px] font-semibold text-slate-500">
                        Đã chọn {selectedEligibleItems.length}/{eligibleItems.length} hạng mục
                      </p>
                    )}
                  </div>
                  <div className="min-h-0 flex-1 overflow-y-auto">
                    {eligibleItems.length === 0 ? (
                      <p className="px-3 py-4 text-center text-xs text-slate-400">
                        Không có hạng mục nào khớp sản phẩm trong hệ thống.
                      </p>
                    ) : (
                      <table className="w-full text-left">
                        <thead className="sticky top-0 bg-slate-50/95 backdrop-blur-sm">
                          <tr className="border-b border-slate-200">
                            <th className="px-2 py-1.5 text-center">
                              <input
                                ref={selectAllRef}
                                type="checkbox"
                                checked={areAllEligibleItemsSelected}
                                onChange={toggleAllEligibleItems}
                                aria-label="Chọn tất cả hạng mục báo giá"
                                className="h-3.5 w-3.5 rounded border-slate-300 text-primary focus:ring-primary/30"
                              />
                            </th>
                            {['#', 'Sản phẩm', 'ĐVT', 'SL', 'Đơn giá', 'Thành tiền'].map((h) => (
                              <th key={h} className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                                {h}
                              </th>
                            ))}
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100">
                          {eligibleItems.map((item, idx) => {
                            const qty = Number(item.quantity) || 0;
                            const price = Number(item.unit_price) || 0;
                            const total = qty * price;
                            const itemKey = buildQuotationItemSelectionKey(item, idx);
                            const isChecked = selectedItemKeys.has(itemKey);
                            const alreadyExists = existingItems.some(
                              (ei) => String(ei.productId || ei.product_id) === String(item.product_id)
                            );
                            return (
                              <tr key={item.id ?? idx} className={alreadyExists ? 'bg-amber-50/60' : ''}>
                                <td className="px-2 py-1.5 text-center">
                                  <input
                                    type="checkbox"
                                    checked={isChecked}
                                    onChange={() => toggleSelectedItem(itemKey)}
                                    aria-label={`Chọn hạng mục ${item.product_name || idx + 1}`}
                                    className="h-3.5 w-3.5 rounded border-slate-300 text-primary focus:ring-primary/30"
                                  />
                                </td>
                                <td className="px-2 py-1.5 text-center text-[10px] text-slate-400">{idx + 1}</td>
                                <td className="px-2 py-1.5">
                                  <p className="text-xs font-semibold text-slate-800">{item.product_name}</p>
                                  {alreadyExists && (
                                    <p className="text-[10px] text-amber-600">Đã có trong dự án</p>
                                  )}
                                </td>
                                <td className="px-2 py-1.5 text-xs text-slate-600">{item.unit ?? '—'}</td>
                                <td className="px-2 py-1.5 text-right text-xs text-slate-800">{qty}</td>
                                <td className="px-2 py-1.5 text-right text-xs text-slate-800">{formatMoney(price)}</td>
                                <td className="px-2 py-1.5 text-right text-xs font-semibold text-slate-900">{formatMoney(total)}</td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    )}

                    {skippedItems.length > 0 && (
                      <div className="m-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2">
                        <p className="text-[11px] font-semibold text-amber-700">
                          <span className="material-symbols-outlined align-middle text-sm">warning</span>
                          {' '}{skippedItems.length} hạng mục không tìm thấy sản phẩm trong hệ thống — sẽ bỏ qua
                        </p>
                        <ul className="mt-1 space-y-0.5">
                          {skippedItems.map((item, idx) => (
                            <li key={item.id ?? idx} className="text-[10px] text-amber-600">
                              · {item.product_name || `Dòng ${idx + 1}`}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </div>

                  {/* Footer trong preview */}
                  {eligibleItems.length > 0 && (
                    <div className="border-t border-slate-100 bg-slate-50/60 px-3 py-2 text-right text-xs text-slate-500">
                      Tổng trước thuế:{' '}
                      <span className="font-black text-slate-900">
                        {formatMoney(selectedEligibleItems.reduce((s, i) => s + Number(i.quantity) * Number(i.unit_price), 0))} đ
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>

        {/* Footer — tuỳ chọn gộp + Xác nhận */}
        <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="text-[11px] font-semibold text-slate-500">Tuỳ chọn:</span>
            <label className="flex cursor-pointer items-center gap-1.5 text-xs">
              <input
                type="radio"
                name="mergeMode"
                value="merge"
                checked={mergeMode === 'merge'}
                onChange={() => setMergeMode('merge')}
                className="accent-primary"
              />
              <span className={mergeMode === 'merge' ? 'font-semibold text-slate-800' : 'text-slate-500'}>
                Gộp với hạng mục hiện có
              </span>
            </label>
            <label className="flex cursor-pointer items-center gap-1.5 text-xs">
              <input
                type="radio"
                name="mergeMode"
                value="replace"
                checked={mergeMode === 'replace'}
                onChange={() => setMergeMode('replace')}
                className="accent-primary"
              />
              <span className={mergeMode === 'replace' ? 'font-semibold text-slate-800' : 'text-slate-500'}>
                Thay thế toàn bộ
              </span>
            </label>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="inline-flex items-center gap-1.5 rounded border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition-colors hover:bg-slate-100"
            >
              Huỷ
            </button>
            <button
              type="button"
              onClick={handleConfirm}
              disabled={selectedId === null || isLoadingDetail || selectedEligibleItems.length === 0}
              className="inline-flex items-center gap-1.5 rounded bg-primary px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-deep-teal disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 15 }}>check</span>
              Lấy {selectedEligibleItems.length > 0 ? `${selectedEligibleItems.length} hạng mục` : 'hạng mục'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
