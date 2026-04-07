import React from 'react';
import { RACI_ROLES } from '../../constants';
import type { Department, Employee, Product, Project, ProjectItem, ProjectRACI } from '../../types';
import { SearchableSelect, type SearchableSelectOption } from './selectPrimitives';

export interface ProjectImportSummary {
  success: number;
  failed: number;
  warnings: string[];
  errors: string[];
}

interface ProjectItemsTabProps {
  errors: Record<string, string>;
  formData: Partial<Project>;
  formatCurrency: (value: number) => string;
  formatNumber: (num: number | string | undefined | null) => string;
  formatPercent: (value: number) => string;
  handleAddItem: () => void;
  handleDownloadProjectItemTemplate: () => void;
  handleItemBlur: (itemId: string, field: keyof ProjectItem) => void;
  handleRemoveItem: (itemId: string) => void;
  handleUpdateItem: (itemId: string, field: keyof ProjectItem, value: any) => void;
  isItemImportSaving: boolean;
  isProjectProductOptionsLoading: boolean;
  itemImportMenuRef: React.RefObject<HTMLDivElement | null>;
  itemImportSummary: ProjectImportSummary | null;
  itemSummary: {
    baseTotal: number;
    discountTotal: number;
    lineTotal: number;
  };
  parseNumber: (str: string | number) => number;
  productById: Map<string, Product>;
  projectProductDropdownHeader: React.ReactNode;
  projectProductSelectOptions: SearchableSelectOption[];
  renderProjectProductOption: (
    option: SearchableSelectOption,
    state: { isSelected: boolean; isHighlighted: boolean }
  ) => React.ReactNode;
  showItemImportMenu: boolean;
  toggleItemImportMenu: () => void;
  totalDiscountPercent: number;
  triggerProjectItemImport: () => void;
  onOpenQuotationPicker: () => void;
}

export const ProjectItemsTab: React.FC<ProjectItemsTabProps> = ({
  errors,
  formData,
  formatCurrency,
  formatNumber,
  formatPercent,
  handleAddItem,
  handleDownloadProjectItemTemplate,
  handleItemBlur,
  handleRemoveItem,
  handleUpdateItem,
  isItemImportSaving,
  isProjectProductOptionsLoading,
  itemImportMenuRef,
  itemImportSummary,
  itemSummary,
  parseNumber,
  productById,
  projectProductDropdownHeader,
  projectProductSelectOptions,
  renderProjectProductOption,
  showItemImportMenu,
  toggleItemImportMenu,
  totalDiscountPercent,
  triggerProjectItemImport,
  onOpenQuotationPicker,
}) => {
  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center mb-2">
        <h3 className="text-sm font-bold text-slate-700">Danh sách sản phẩm/dịch vụ</h3>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onOpenQuotationPicker}
            className="text-xs flex items-center gap-1.5 bg-white border border-slate-200 text-slate-600 px-3 py-1.5 rounded-md hover:bg-slate-50 font-medium transition-colors"
          >
            <span className="material-symbols-outlined text-sm text-primary">receipt_long</span>
            Lấy từ Báo giá
          </button>
          <div className="relative" ref={itemImportMenuRef}>
            <button
              type="button"
              onClick={toggleItemImportMenu}
              disabled={isItemImportSaving}
              className="text-xs flex items-center gap-1.5 bg-white border border-slate-200 text-slate-600 px-3 py-1.5 rounded-md hover:bg-slate-50 font-medium transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined text-sm">upload</span>
              {isItemImportSaving ? 'Đang nhập...' : 'Nhập'}
              <span className="material-symbols-outlined text-sm">expand_more</span>
            </button>
            {showItemImportMenu && (
              <div className="absolute right-0 top-full mt-2 w-44 bg-white border border-slate-200 rounded-lg shadow-xl z-[120] overflow-hidden">
                <button
                  type="button"
                  onClick={triggerProjectItemImport}
                  disabled={isItemImportSaving}
                  className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 hover:text-primary transition-colors flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <span className="material-symbols-outlined text-sm">upload_file</span>
                  Nhập dữ liệu
                </button>
                <button
                  type="button"
                  onClick={handleDownloadProjectItemTemplate}
                  disabled={isItemImportSaving}
                  className="w-full text-left px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 hover:text-green-600 transition-colors border-t border-slate-100 flex items-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <span className="material-symbols-outlined text-sm">download</span>
                  Tải file mẫu
                </button>
              </div>
            )}
          </div>
          <button onClick={handleAddItem} className="text-xs flex items-center gap-1 bg-blue-50 text-blue-600 px-3 py-1.5 rounded-md hover:bg-blue-100 font-medium">
            <span className="material-symbols-outlined text-sm">add</span> Thêm hạng mục
          </button>
        </div>
      </div>

      {itemImportSummary && (
        <div className="space-y-2">
          <div className="text-xs text-green-700 bg-green-50 border border-green-200 rounded-md px-3 py-2">
            Đã nhập {itemImportSummary.success} dòng, lỗi {itemImportSummary.failed} dòng.
          </div>
          {itemImportSummary.warnings.length > 0 && (
            <div className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-md px-3 py-2">
              {itemImportSummary.warnings.slice(0, 3).map((warning, index) => (
                <p key={`${warning}-${index}`}>{warning}</p>
              ))}
              {itemImportSummary.warnings.length > 3 && (
                <p>... còn {itemImportSummary.warnings.length - 3} cảnh báo.</p>
              )}
            </div>
          )}
          {itemImportSummary.errors.length > 0 && (
            <div className="text-xs text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
              {itemImportSummary.errors.slice(0, 5).map((error, index) => (
                <p key={`${error}-${index}`}>{error}</p>
              ))}
              {itemImportSummary.errors.length > 5 && (
                <p>... còn {itemImportSummary.errors.length - 5} lỗi.</p>
              )}
            </div>
          )}
        </div>
      )}

      {errors.items && (
        <div className="text-sm text-red-700 bg-red-50 border border-red-200 rounded-md px-3 py-2">
          {errors.items}
        </div>
      )}

      <div className="border border-slate-200 rounded-lg bg-slate-50 p-4 overflow-visible">
        <table className="w-full table-fixed text-left bg-white rounded-lg shadow-sm">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-3 py-3 text-xs font-bold text-slate-500 uppercase w-[38%]">Sản phẩm</th>
              <th className="px-2 py-3 text-xs font-bold text-slate-500 uppercase w-[8%] text-center whitespace-nowrap">Đơn vị tính</th>
              <th className="px-2 py-3 text-xs font-bold text-slate-500 uppercase w-[6%] text-center whitespace-nowrap">SL</th>
              <th className="px-3 py-3 text-xs font-bold text-slate-500 uppercase w-[13%] text-right whitespace-nowrap">Đơn giá</th>
              <th className="px-3 py-3 text-xs font-bold text-slate-500 uppercase w-[7%] text-right whitespace-nowrap">% CK</th>
              <th className="px-3 py-3 text-xs font-bold text-slate-500 uppercase w-[12%] text-right whitespace-nowrap">Giảm giá</th>
              <th className="px-3 py-3 text-xs font-bold text-slate-500 uppercase w-[12%] text-right whitespace-nowrap">Thành tiền</th>
              <th className="px-2 py-3 text-xs font-bold text-slate-500 uppercase w-[4%] text-center whitespace-nowrap">Xóa</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {formData.items && formData.items.length > 0 ? (
              formData.items.map((item) => {
                const selectedProduct = productById.get(String(item.productId ?? item.product_id ?? '').trim());

                return (
                  <tr key={item.id} className="hover:bg-slate-50">
                    <td className="p-2">
                      <SearchableSelect
                        compact
                        value={item.productId}
                        options={projectProductSelectOptions}
                        placeholder="Chọn sản phẩm"
                        onChange={(value) => handleUpdateItem(item.id, 'productId', value)}
                        disabled={isProjectProductOptionsLoading}
                        triggerClassName="w-full text-sm border border-slate-300 rounded-md focus:ring-primary focus:border-primary py-1.5 bg-white text-slate-900 shadow-sm h-9"
                        dropdownClassName="min-w-[760px] max-w-[920px]"
                        renderOptionContent={renderProjectProductOption}
                        renderDropdownHeader={projectProductDropdownHeader}
                        usePortal
                      />
                    </td>
                    <td className="p-2">
                      <div className="flex h-9 items-center justify-center rounded-md border border-slate-200 bg-slate-50 px-2 text-center text-sm font-medium text-slate-600">
                        <span className="line-clamp-2">{selectedProduct?.unit || '—'}</span>
                      </div>
                    </td>
                    <td className="p-2">
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        className="w-full text-sm border border-slate-300 rounded-md text-center focus:ring-primary focus:border-primary py-1.5 bg-white text-slate-900 shadow-sm"
                        value={item.quantity === 0 ? '' : item.quantity}
                        onChange={(e) => handleUpdateItem(item.id, 'quantity', e.target.value === '' ? 0 : parseFloat(e.target.value))}
                        placeholder="0"
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="text"
                        className="w-full text-sm border border-slate-300 rounded-md text-right focus:ring-primary focus:border-primary py-1.5 bg-white text-slate-900 shadow-sm pr-4"
                        value={formatNumber(item.unitPrice)}
                        onChange={(e) => handleUpdateItem(item.id, 'unitPrice', parseNumber(e.target.value))}
                      />
                    </td>
                    <td className="p-2">
                      <input
                        type="text"
                        disabled={item.discountMode === 'AMOUNT'}
                        className={`w-full text-sm border border-slate-300 rounded-md text-right focus:ring-primary focus:border-primary py-1.5 shadow-sm pr-4 ${item.discountMode === 'AMOUNT' ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-white text-slate-900'}`}
                        value={item.discountPercent === 0 ? '' : item.discountPercent}
                        onChange={(e) => handleUpdateItem(item.id, 'discountPercent', e.target.value)}
                        onBlur={() => handleItemBlur(item.id, 'discountPercent')}
                        placeholder="0"
                      />
                    </td>
                    <td className="p-2">
                      <div className="relative">
                        <input
                          type="text"
                          disabled={item.discountMode === 'PERCENT'}
                          className={`w-full text-sm border border-slate-300 rounded-md text-right focus:ring-primary focus:border-primary py-1.5 shadow-sm pr-8 ${item.discountMode === 'PERCENT' ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-white text-slate-900'}`}
                          value={parseNumber(item.discountAmount) <= 0 ? '' : formatNumber(parseNumber(item.discountAmount))}
                          onChange={(e) => handleUpdateItem(item.id, 'discountAmount', e.target.value)}
                          onBlur={() => handleItemBlur(item.id, 'discountAmount')}
                          placeholder="0"
                        />
                        <span className={`absolute right-2 top-1/2 -translate-y-1/2 text-xs ${item.discountMode === 'PERCENT' ? 'text-slate-300' : 'text-slate-400'}`}>
                          ₫
                        </span>
                      </div>
                    </td>
                    <td className="p-2 text-right text-sm font-bold text-slate-900 whitespace-nowrap">
                      {formatCurrency(item.lineTotal || 0)}
                    </td>
                    <td className="p-2 text-center">
                      <button
                        onClick={() => handleRemoveItem(item.id)}
                        className="text-slate-400 hover:text-red-500 transition-colors p-1"
                      >
                        <span className="material-symbols-outlined text-lg">delete</span>
                      </button>
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan={8} className="px-4 py-8 text-center text-slate-400 text-sm">Chưa có hạng mục nào.</td>
              </tr>
            )}
          </tbody>
          {formData.items && formData.items.length > 0 && (
            <tfoot className="bg-slate-50 border-t border-slate-200">
              <tr>
                <td colSpan={4} className="px-4 py-3 text-sm font-bold text-slate-700 text-right">Tổng % CK:</td>
                <td className="px-4 py-3 text-sm font-bold text-amber-600 text-right whitespace-nowrap">
                  {formatPercent(totalDiscountPercent)}
                </td>
                <td className="px-4 py-3 text-sm font-bold text-red-600 text-right">
                  {formatCurrency(itemSummary.discountTotal)}
                </td>
                <td className="px-4 py-3 text-sm font-bold text-primary text-right whitespace-nowrap">
                  {formatCurrency(itemSummary.lineTotal)}
                </td>
                <td></td>
              </tr>
            </tfoot>
          )}
        </table>
      </div>
    </div>
  );
};

interface ProjectRaciTabProps {
  employees: Employee[];
  employeeOptions: SearchableSelectOption[];
  formData: Partial<Project>;
  handleAddRACI: () => void;
  handleCopyRACI: (raciId: string) => void;
  handleDownloadProjectRaciTemplate: () => void;
  handleRaciAssignedDateBlur: (raciId: string) => void;
  handleRemoveRACI: (raciId: string) => void;
  handleUpdateRACI: (raciId: string, field: keyof ProjectRACI, value: any) => void;
  duplicateRaciIds: Set<string>;
  isDepartmentsLoading: boolean;
  isProjectEmployeeOptionsLoading: boolean;
  isRaciImportSaving: boolean;
  raciImportMenuRef: React.RefObject<HTMLDivElement | null>;
  raciImportSummary: ProjectImportSummary | null;
  resolveEmployeeDepartment: (employee: Partial<Employee> | null | undefined) => Department | null;
  showRaciImportMenu: boolean;
  toggleRaciImportMenu: () => void;
  triggerProjectRaciImport: () => void;
}

export const ProjectRaciTab: React.FC<ProjectRaciTabProps> = ({
  employees,
  employeeOptions,
  formData,
  handleAddRACI,
  handleCopyRACI,
  handleDownloadProjectRaciTemplate,
  handleRaciAssignedDateBlur,
  handleRemoveRACI,
  handleUpdateRACI,
  duplicateRaciIds,
  isDepartmentsLoading,
  isProjectEmployeeOptionsLoading,
  isRaciImportSaving,
  raciImportMenuRef,
  raciImportSummary,
  resolveEmployeeDepartment,
  showRaciImportMenu,
  toggleRaciImportMenu,
  triggerProjectRaciImport,
}) => {
  return (
    <div className="space-y-3">
      {/* ── Header ── */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wide text-slate-500">
          Đội ngũ dự án (RACI)
          {formData.raci && formData.raci.length > 0 && (
            <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600 normal-case tracking-normal">
              {formData.raci.length} thành viên
            </span>
          )}
        </h3>
        <div className="flex items-center gap-1.5">
          {/* Import dropdown */}
          <div className="relative" ref={raciImportMenuRef}>
            <button
              type="button"
              onClick={toggleRaciImportMenu}
              disabled={isRaciImportSaving}
              className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded border border-slate-200 bg-white text-slate-600 hover:bg-slate-50 transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <span className="material-symbols-outlined" style={{ fontSize: 14 }}>upload</span>
              {isRaciImportSaving ? 'Đang nhập...' : 'Nhập'}
              <span className="material-symbols-outlined" style={{ fontSize: 13 }}>expand_more</span>
            </button>
            {showRaciImportMenu && (
              <div className="absolute right-0 top-full z-[120] mt-1.5 w-44 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-xl">
                <button
                  type="button"
                  onClick={triggerProjectRaciImport}
                  disabled={isRaciImportSaving}
                  className="flex w-full items-center gap-2 px-3 py-2 text-left text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-primary disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>upload_file</span>
                  Nhập dữ liệu
                </button>
                <button
                  type="button"
                  onClick={handleDownloadProjectRaciTemplate}
                  disabled={isRaciImportSaving}
                  className="flex w-full items-center gap-2 border-t border-slate-100 px-3 py-2 text-left text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 hover:text-emerald-600 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  <span className="material-symbols-outlined" style={{ fontSize: 14 }}>download</span>
                  Tải file mẫu
                </button>
              </div>
            )}
          </div>
          {/* Add button — primary CTA */}
          <button
            type="button"
            onClick={handleAddRACI}
            className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1.5 rounded bg-primary text-white hover:bg-deep-teal shadow-sm transition-colors"
          >
            <span className="material-symbols-outlined" style={{ fontSize: 14 }}>person_add</span>
            Thêm nhân sự
          </button>
        </div>
      </div>

      {/* ── Import summary ── */}
      {raciImportSummary && (
        <div className="space-y-1.5">
          <div className="rounded border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs text-emerald-700">
            Đã nhập {raciImportSummary.success} dòng, lỗi {raciImportSummary.failed} dòng.
          </div>
          {raciImportSummary.warnings.length > 0 && (
            <div className="rounded border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs text-amber-700">
              {raciImportSummary.warnings.slice(0, 3).map((warning, index) => (
                <p key={`${warning}-${index}`}>{warning}</p>
              ))}
              {raciImportSummary.warnings.length > 3 && (
                <p>... còn {raciImportSummary.warnings.length - 3} cảnh báo.</p>
              )}
            </div>
          )}
          {raciImportSummary.errors.length > 0 && (
            <div className="rounded border border-red-200 bg-red-50 px-3 py-1.5 text-xs text-red-700">
              {raciImportSummary.errors.slice(0, 5).map((error, index) => (
                <p key={`${error}-${index}`}>{error}</p>
              ))}
              {raciImportSummary.errors.length > 5 && (
                <p>... còn {raciImportSummary.errors.length - 5} lỗi.</p>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Loading notice ── */}
      {(isProjectEmployeeOptionsLoading || employees.length === 0) && (
        <div className="rounded border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700">
          {isProjectEmployeeOptionsLoading
            ? 'Đang tải danh sách nhân sự. Các lựa chọn RACI sẽ xuất hiện sau khi dữ liệu nạp xong.'
            : 'Chưa tải được danh sách nhân sự. Dữ liệu sẽ xuất hiện sau khi màn Dự án nạp xong hoặc khi tài khoản có quyền xem nhân sự.'}
          {isDepartmentsLoading && ' Thông tin phòng ban sẽ cập nhật ngay sau đó.'}
        </div>
      )}

      {/* ── Table ── */}
      <div className="overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm">
        <div className="min-h-[200px] max-h-[52vh] overflow-auto">
          <table className="min-w-[820px] w-full table-fixed text-left">
            <thead>
              <tr className="border-b border-slate-200">
                <th className="sticky top-0 z-10 bg-slate-50/95 px-2 py-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500 backdrop-blur-sm w-[36%]">Nhân sự</th>
                <th className="sticky top-0 z-10 bg-slate-50/95 px-2 py-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500 backdrop-blur-sm w-[20%]">Phòng ban</th>
                <th className="sticky top-0 z-10 bg-slate-50/95 px-2 py-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500 backdrop-blur-sm w-[22%]">Vai trò</th>
                <th className="sticky top-0 z-10 bg-slate-50/95 px-2 py-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500 backdrop-blur-sm w-[14%] text-center">Ngày phân công</th>
                <th className="sticky top-0 z-10 bg-slate-50/95 px-2 py-1.5 text-[11px] font-bold uppercase tracking-wide text-slate-500 backdrop-blur-sm w-[8%] text-center">Tác vụ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {formData.raci && formData.raci.length > 0 ? (
                formData.raci.map((raci) => {
                  const employee = employees.find((candidate) => String(candidate.id) === String(raci.userId));
                  const department = resolveEmployeeDepartment(employee);
                  const departmentLabel = department?.dept_name || '---';
                  const departmentTitle = department
                    ? `${department.dept_code ? `${department.dept_code} - ` : ''}${department.dept_name}`
                    : String(employee?.department_id ?? employee?.department ?? '---');

                  return (
                    <tr key={raci.id} className={duplicateRaciIds.has(raci.id) ? 'bg-red-50 ring-1 ring-inset ring-red-300' : 'hover:bg-slate-50 align-middle'}>
                      <td className="px-2 py-1.5">
                        <SearchableSelect
                          compact
                          value={raci.userId}
                          options={employeeOptions}
                          onChange={(value) => handleUpdateRACI(raci.id, 'userId', value)}
                          disabled={isProjectEmployeeOptionsLoading || employees.length === 0}
                          triggerClassName="w-full border border-slate-300 rounded focus:ring-primary focus:border-primary bg-white text-slate-900 h-[30px] text-xs px-2"
                          dropdownClassName="min-w-[380px] max-w-[680px]"
                          usePortal
                        />
                      </td>
                      <td className="px-2 py-1.5">
                        <span className="block truncate text-xs font-medium text-slate-700" title={departmentTitle}>{departmentLabel}</span>
                      </td>
                      <td className="px-2 py-1.5">
                        <div className="flex items-center gap-1.5">
                          <div className={`w-6 h-6 rounded flex items-center justify-center font-bold text-[10px] shrink-0 ${RACI_ROLES.find((role) => role.value === raci.roleType)?.color || 'bg-slate-100 text-slate-700'}`}>
                            {raci.roleType}
                          </div>
                          <SearchableSelect
                            compact
                            className="flex-1"
                            value={raci.roleType}
                            options={RACI_ROLES.map((role) => ({ value: role.value, label: role.label }))}
                            onChange={(value) => handleUpdateRACI(raci.id, 'roleType', value)}
                            triggerClassName="flex-1 border border-slate-300 rounded focus:ring-primary focus:border-primary bg-white text-slate-900 h-[30px] text-xs px-2"
                            dropdownClassName="min-w-[200px] max-w-[320px]"
                            usePortal
                          />
                        </div>
                      </td>
                      <td className="px-2 py-1.5">
                        <input
                          type="text"
                          className="w-full h-[30px] text-xs border border-slate-300 rounded focus:ring-1 focus:ring-primary/30 focus:border-primary bg-white text-slate-900 px-2 text-center outline-none"
                          value={raci.assignedDate}
                          onChange={(e) => handleUpdateRACI(raci.id, 'assignedDate', e.target.value)}
                          onBlur={() => handleRaciAssignedDateBlur(raci.id)}
                          placeholder="dd/mm/yyyy"
                        />
                      </td>
                      <td className="px-2 py-1.5 text-center">
                        <button
                          type="button"
                          onClick={() => handleCopyRACI(raci.id)}
                          title="Sao chép dòng này"
                          className="rounded p-1 text-slate-400 transition-colors hover:bg-blue-50 hover:text-blue-600"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 15 }}>content_copy</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveRACI(raci.id)}
                          title="Xóa"
                          className="rounded p-1 text-slate-400 transition-colors hover:bg-red-50 hover:text-error"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 15 }}>delete</span>
                        </button>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="px-4 py-10 text-center text-xs text-slate-400">
                    Chưa có nhân sự nào được phân công. Bấm <strong>Thêm nhân sự</strong> để bắt đầu.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
