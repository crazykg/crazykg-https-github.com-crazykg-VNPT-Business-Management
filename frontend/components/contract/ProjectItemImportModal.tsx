import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { ContractItem, Project, ProjectItemMaster } from '../../types';
import { ModalWrapper } from '../modals/shared';
import { resolveContractItemCatalogValue } from './contractItemCatalogUtils';

interface ProjectItemImportModalProps {
  project: Project | null;
  projectCustomerName: string;
  projectValue: number;
  projectInvestmentModeLabel: string;
  projectItems: ProjectItemMaster[];
  existingItems: ContractItem[];
  onConfirm: (items: ProjectItemMaster[], mergeMode: 'merge' | 'replace') => void;
  onClose: () => void;
}

const formatMoney = (value: number): string =>
  value.toLocaleString('vi-VN', { minimumFractionDigits: 0, maximumFractionDigits: 0 });

const formatQuantity = (value: number): string =>
  Number.isFinite(value)
    ? value.toLocaleString('vi-VN', {
        minimumFractionDigits: 0,
        maximumFractionDigits: Number.isInteger(value) ? 0 : 2,
      })
    : '0';

const buildProjectItemSelectionKey = (item: ProjectItemMaster, idx: number): string =>
  String(item.id ?? `idx-${idx}`);

export const ProjectItemImportModal: React.FC<ProjectItemImportModalProps> = ({
  project,
  projectCustomerName,
  projectValue,
  projectInvestmentModeLabel,
  projectItems,
  existingItems,
  onConfirm,
  onClose,
}) => {
  const [searchText, setSearchText] = useState('');
  const [mergeMode, setMergeMode] = useState<'merge' | 'replace'>('merge');
  const [selectedItemKeys, setSelectedItemKeys] = useState<Set<string>>(new Set());
  const selectAllRef = useRef<HTMLInputElement | null>(null);

  const existingCatalogValues = useMemo(
    () => new Set(existingItems.map((item) => resolveContractItemCatalogValue(item)).filter(Boolean)),
    [existingItems]
  );

  const filteredItems = useMemo(() => {
    if (!searchText.trim()) {
      return projectItems;
    }

    const keyword = searchText.trim().toLocaleLowerCase('vi-VN');
    return projectItems.filter((item) =>
      [
        item.product_code,
        item.product_name,
        item.display_name,
        item.project_code,
        item.project_name,
      ]
        .map((value) => String(value || '').trim().toLocaleLowerCase('vi-VN'))
        .join(' ')
        .includes(keyword)
    );
  }, [projectItems, searchText]);

  useEffect(() => {
    setSelectedItemKeys(
      new Set(projectItems.map((item, idx) => buildProjectItemSelectionKey(item, idx)))
    );
  }, [projectItems]);

  const selectedProjectItems = useMemo(
    () =>
      projectItems.filter((item, idx) =>
        selectedItemKeys.has(buildProjectItemSelectionKey(item, idx))
      ),
    [projectItems, selectedItemKeys]
  );

  const areAllProjectItemsSelected =
    projectItems.length > 0 && selectedProjectItems.length === projectItems.length;
  const hasPartiallySelectedProjectItems =
    selectedProjectItems.length > 0 && selectedProjectItems.length < projectItems.length;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = hasPartiallySelectedProjectItems;
    }
  }, [hasPartiallySelectedProjectItems]);

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

  const toggleAllProjectItems = useCallback(() => {
    setSelectedItemKeys((prev) => {
      if (projectItems.length === 0) {
        return prev;
      }

      if (prev.size === projectItems.length) {
        return new Set<string>();
      }

      return new Set(projectItems.map((item, idx) => buildProjectItemSelectionKey(item, idx)));
    });
  }, [projectItems]);

  const handleConfirm = useCallback(() => {
    if (selectedProjectItems.length === 0) {
      return;
    }
    onConfirm(selectedProjectItems, mergeMode);
  }, [mergeMode, onConfirm, selectedProjectItems]);

  const selectedValue = selectedProjectItems.reduce((sum, item) => {
    const quantity = Number(item.quantity || 0);
    const unitPrice = Number(item.unit_price || 0);
    return sum + Math.max(0, quantity * unitPrice);
  }, 0);

  return (
    <ModalWrapper
      onClose={onClose}
      title="Lấy hạng mục từ dự án"
      icon="playlist_add_check"
      zIndexClassName="ui-layer-popover"
      width="max-w-[96rem]"
      maxHeightClass="max-h-[90vh]"
      panelClassName="rounded-xl"
      contentClassName="flex min-h-0 flex-1 flex-col overflow-hidden"
      headerClassName="bg-slate-50/80 px-4 py-3"
    >
      <div
        data-testid="contract-project-item-picker-modal"
        className="flex min-h-0 flex-1 flex-col overflow-hidden"
      >
        <div className="border-b border-slate-100 px-4 py-2.5">
          <div className="relative">
            <span
              className="material-symbols-outlined pointer-events-none absolute inset-y-0 left-2.5 flex items-center text-slate-400"
              style={{ fontSize: 16 }}
            >
              search
            </span>
            <input
              type="search"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="Tìm theo tên hạng mục, mã SP/DV..."
              className="h-8 w-full rounded border border-slate-200 bg-white pl-8 pr-3 text-xs text-slate-800 outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary/30"
            />
          </div>
        </div>

        <div className="flex min-h-0 flex-1 overflow-hidden">
          <div className="flex w-72 shrink-0 flex-col border-r border-slate-100 xl:w-80">
            <div className="border-b border-slate-100 bg-slate-50/60 px-3 py-1.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                {project ? '1 dự án liên kết' : '0 dự án'}
              </p>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto p-3">
              {project ? (
                <div className="rounded-xl border border-primary/15 bg-primary/[0.04] p-3">
                  <p className="text-xs font-semibold leading-5 text-primary">
                    {`${String(project.project_code || '').trim()} - ${String(project.project_name || '').trim()}`.trim()}
                  </p>
                  <div className="mt-2 space-y-1.5 text-[11px] text-slate-600">
                    <p>
                      <span className="font-semibold text-slate-500">Khách hàng:</span>{' '}
                      {projectCustomerName || '--'}
                    </p>
                    <p>
                      <span className="font-semibold text-slate-500">Hình thức:</span>{' '}
                      {projectInvestmentModeLabel || '--'}
                    </p>
                    <p>
                      <span className="font-semibold text-slate-500">Giá trị hạng mục:</span>{' '}
                      <span className="font-semibold text-slate-800">{formatMoney(Number(projectValue || 0))} đ</span>
                    </p>
                    <p>
                      <span className="font-semibold text-slate-500">Số hạng mục:</span>{' '}
                      {projectItems.length}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="flex h-full items-center justify-center rounded-xl border border-dashed border-slate-200 bg-slate-50 p-4 text-center text-xs text-slate-400">
                  Chưa có dự án liên kết để lấy hạng mục.
                </div>
              )}
            </div>
          </div>

          <div className="flex min-h-0 flex-1 flex-col overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/60 px-3 py-1.5">
              <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                Xem trước hạng mục — giá trước VAT
              </p>
              <p className="text-[10px] font-semibold text-slate-500">
                Đã chọn {selectedProjectItems.length}/{projectItems.length} hạng mục
              </p>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto">
              {filteredItems.length === 0 ? (
                <div className="flex h-full items-center justify-center px-6 py-10 text-center">
                  <div>
                    <span className="material-symbols-outlined text-slate-300" style={{ fontSize: 36 }}>
                      inventory_2
                    </span>
                    <p className="mt-2 text-xs text-slate-400">
                      {projectItems.length === 0
                        ? 'Dự án liên kết chưa có hạng mục hợp lệ để đưa vào hợp đồng.'
                        : 'Không tìm thấy hạng mục phù hợp.'}
                    </p>
                  </div>
                </div>
              ) : (
                <table className="w-full min-w-[62rem] text-left">
                  <thead className="sticky top-0 bg-slate-50/95 backdrop-blur-sm">
                    <tr className="border-b border-slate-200">
                      <th className="px-2 py-1.5 text-center">
                        <input
                          ref={selectAllRef}
                          type="checkbox"
                          checked={areAllProjectItemsSelected}
                          onChange={toggleAllProjectItems}
                          aria-label="Chọn tất cả hạng mục dự án"
                          className="h-3.5 w-3.5 rounded border-slate-300 text-primary focus:ring-primary/30"
                        />
                      </th>
                      <th className="px-2 py-1.5 text-center text-[10px] font-bold uppercase tracking-wide text-slate-500">
                        #
                      </th>
                      <th className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                        Sản phẩm/DV
                      </th>
                      <th className="px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-500">
                        ĐVT
                      </th>
                      <th className="px-2 py-1.5 text-right text-[10px] font-bold uppercase tracking-wide text-slate-500">
                        Số lượng
                      </th>
                      <th className="px-2 py-1.5 text-right text-[10px] font-bold uppercase tracking-wide text-slate-500">
                        Đơn giá
                      </th>
                      <th className="px-2 py-1.5 text-right text-[10px] font-bold uppercase tracking-wide text-slate-500">
                        Thành tiền
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {filteredItems.map((item, idx) => {
                      const quantity = Number(item.quantity || 0);
                      const unitPrice = Number(item.unit_price || 0);
                      const amount = quantity * unitPrice;
                      const itemKey = buildProjectItemSelectionKey(item, idx);
                      const isChecked = selectedItemKeys.has(itemKey);
                      const alreadyExists = existingCatalogValues.has(
                        resolveContractItemCatalogValue({
                          product_id: item.product_id,
                          product_package_id: item.product_package_id ?? null,
                          productPackageId: item.product_package_id ?? null,
                        })
                      );

                      return (
                        <tr key={itemKey} className={alreadyExists ? 'bg-amber-50/60' : ''}>
                          <td className="px-2 py-1.5 text-center">
                            <input
                              type="checkbox"
                              checked={isChecked}
                              onChange={() => toggleSelectedItem(itemKey)}
                              aria-label={`Chọn hạng mục ${String(item.product_name || item.display_name || idx + 1).trim()}`}
                              className="h-3.5 w-3.5 rounded border-slate-300 text-primary focus:ring-primary/30"
                            />
                          </td>
                          <td className="px-2 py-1.5 text-center text-[10px] text-slate-400">{idx + 1}</td>
                          <td className="px-2 py-1.5">
                            <p className="text-xs font-semibold text-slate-800">
                              {String(item.product_name || item.display_name || `Hạng mục #${idx + 1}`).trim()}
                            </p>
                            <p className="mt-0.5 text-[10px] text-slate-400">
                              {String(item.product_code || '').trim() || 'Không có mã sản phẩm'}
                            </p>
                            {alreadyExists && (
                              <p className="mt-0.5 text-[10px] text-amber-600">Đã có trong hợp đồng</p>
                            )}
                          </td>
                          <td className="px-2 py-1.5 text-xs text-slate-600">
                            {String(item.unit || '').trim() || '—'}
                          </td>
                          <td className="px-2 py-1.5 text-right text-xs text-slate-800">
                            {formatQuantity(quantity)}
                          </td>
                          <td className="px-2 py-1.5 text-right text-xs text-slate-800">
                            {formatMoney(unitPrice)}
                          </td>
                          <td className="px-2 py-1.5 text-right text-xs font-semibold text-slate-900">
                            {formatMoney(amount)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>

            <div className="border-t border-slate-100 bg-slate-50/60 px-3 py-2 text-right text-xs text-slate-500">
              Tổng trước thuế:{' '}
              <span className="font-black text-slate-900">{formatMoney(selectedValue)} đ</span>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-3 border-t border-slate-200 bg-slate-50/80 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <span className="text-[11px] font-semibold text-slate-500">Tuỳ chọn:</span>
            <label className="flex cursor-pointer items-center gap-1.5 text-xs">
              <input
                type="radio"
                name="contractProjectMergeMode"
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
                name="contractProjectMergeMode"
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
              disabled={selectedProjectItems.length === 0}
              className="inline-flex items-center gap-1.5 rounded bg-primary px-3 py-1.5 text-xs font-semibold text-white shadow-sm transition-colors hover:bg-deep-teal disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>
                done
              </span>
              {`Lấy ${selectedProjectItems.length} hạng mục`}
            </button>
          </div>
        </div>
      </div>
    </ModalWrapper>
  );
};
