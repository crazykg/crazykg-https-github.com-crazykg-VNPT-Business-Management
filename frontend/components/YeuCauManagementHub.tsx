import React, { startTransition, useDeferredValue, useEffect, useMemo, useState } from 'react';
import {
  createYeuCau,
  fetchYeuCauPage,
  fetchYeuCauPeople,
  fetchYeuCauProcessCatalog,
  fetchYeuCauProcessDetail,
  fetchYeuCauTimeline,
  saveYeuCauProcess,
} from '../services/v5Api';
import type {
  Customer,
  Employee,
  PaginationMeta,
  YeuCau,
  YeuCauProcessCatalog,
  YeuCauProcessDetail,
  YeuCauProcessField,
  YeuCauProcessMeta,
  YeuCauRelatedUser,
  YeuCauTimelineEntry,
} from '../types';
import { SearchableSelect, type SearchableSelectOption } from './SearchableSelect';
import { formatDateDdMmYyyy } from '../utils/dateDisplay';

type YeuCauManagementHubProps = {
  customers: Customer[];
  customerPersonnel?: unknown[];
  projectItems?: unknown[];
  employees: Employee[];
  supportServiceGroups?: unknown[];
  currentUserId?: string | number | null;
  isAdminViewer?: boolean;
  canImportRequests?: boolean;
  canExportRequests?: boolean;
  canReadRequests: boolean;
  canWriteRequests: boolean;
  canDeleteRequests?: boolean;
  onNotify: (type: 'success' | 'error', title: string, message: string) => void;
};

type DraftState = Record<string, unknown>;

const PRIORITY_OPTIONS: SearchableSelectOption[] = [
  { value: 1, label: 'Thấp' },
  { value: 2, label: 'Trung bình' },
  { value: 3, label: 'Cao' },
  { value: 4, label: 'Khẩn' },
];

const BOOLEAN_NULLABLE_OPTIONS: SearchableSelectOption[] = [
  { value: '', label: 'Chưa xác định' },
  { value: '1', label: 'Có' },
  { value: '0', label: 'Không' },
];

const HUMAN_ROLE_LABEL: Record<string, string> = {
  nguoi_nhap: 'Người nhập',
  pm: 'PM',
  ba: 'BA',
  nguoi_thuc_hien: 'Người thực hiện',
  nguoi_trao_doi: 'Người trao đổi',
  dev: 'Dev',
  nguoi_phan_cong: 'Người được phân công',
};

const normalizeText = (value: unknown): string => String(value ?? '').trim();

const toDateTimeLocal = (value: unknown): string => {
  const normalized = normalizeText(value);
  if (!normalized) {
    return '';
  }

  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(normalized)) {
    return normalized.replace(' ', 'T').slice(0, 16);
  }

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(normalized)) {
    return normalized.slice(0, 16);
  }

  return normalized;
};

const toSqlDateTime = (value: unknown): string | null => {
  const normalized = normalizeText(value);
  if (!normalized) {
    return null;
  }

  if (/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(normalized)) {
    return `${normalized.replace('T', ' ')}:00`;
  }

  if (/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(normalized)) {
    return normalized;
  }

  return normalized;
};

const findProcessByCode = (
  catalog: YeuCauProcessCatalog | null,
  processCode: string | null | undefined
): YeuCauProcessMeta | null => {
  const target = normalizeText(processCode);
  if (!catalog || !target) {
    return null;
  }

  for (const group of catalog.groups) {
    const match = group.processes.find((process) => process.process_code === target);
    if (match) {
      return match;
    }
  }

  return null;
};

const buildDraftFromFields = (fields: YeuCauProcessField[], source: Record<string, unknown> | null | undefined): DraftState => {
  const nextDraft: DraftState = {};
  for (const field of fields) {
    const rawValue = source?.[field.name];
    if (field.type === 'datetime') {
      nextDraft[field.name] = toDateTimeLocal(rawValue);
      continue;
    }
    if (field.type === 'boolean_nullable') {
      if (rawValue === true || rawValue === 1 || rawValue === '1') {
        nextDraft[field.name] = '1';
      } else if (rawValue === false || rawValue === 0 || rawValue === '0') {
        nextDraft[field.name] = '0';
      } else {
        nextDraft[field.name] = '';
      }
      continue;
    }
    if (field.type === 'json_textarea' && rawValue && typeof rawValue !== 'string') {
      nextDraft[field.name] = JSON.stringify(rawValue, null, 2);
      continue;
    }
    nextDraft[field.name] = rawValue ?? '';
  }

  return nextDraft;
};

const serializeDraftValue = (field: YeuCauProcessField, value: unknown): unknown => {
  if (field.type === 'datetime') {
    return toSqlDateTime(value);
  }
  if (field.type === 'boolean_nullable') {
    const normalized = normalizeText(value);
    if (!normalized) {
      return null;
    }
    return normalized === '1';
  }
  if (field.type === 'number' || field.type === 'priority' || field.type === 'user_select' || field.type === 'customer_select') {
    const normalized = normalizeText(value);
    return normalized ? normalized : null;
  }
  const normalized = normalizeText(value);
  return normalized ? normalized : null;
};

const buildPayloadFromDraft = (fields: YeuCauProcessField[], draft: DraftState): Record<string, unknown> => {
  const payload: Record<string, unknown> = {};
  for (const field of fields) {
    payload[field.name] = serializeDraftValue(field, draft[field.name]);
  }
  return payload;
};

const fieldOptions = (
  field: YeuCauProcessField,
  customers: Customer[],
  employees: Employee[]
): SearchableSelectOption[] => {
  if (field.type === 'customer_select') {
    return customers.map((customer) => ({
      value: String(customer.id),
      label: customer.customer_name,
      searchText: `${customer.customer_name} ${customer.customer_code}`,
    }));
  }

  if (field.type === 'user_select') {
    return employees.map((employee) => ({
      value: String(employee.id),
      label: employee.full_name || employee.username,
      searchText: `${employee.full_name || ''} ${employee.user_code || ''} ${employee.username || ''}`,
    }));
  }

  if (field.type === 'priority') {
    return PRIORITY_OPTIONS;
  }

  if (field.type === 'boolean_nullable') {
    return BOOLEAN_NULLABLE_OPTIONS;
  }

  if (field.type === 'enum') {
    return (field.options || []).map((option) => ({ value: option, label: option }));
  }

  return [];
};

const ProcessFieldInput: React.FC<{
  field: YeuCauProcessField;
  value: unknown;
  customers: Customer[];
  employees: Employee[];
  disabled: boolean;
  onChange: (fieldName: string, value: unknown) => void;
}> = ({ field, value, customers, employees, disabled, onChange }) => {
  const commonLabel = (
    <label className="mb-1.5 block text-sm font-semibold text-slate-700">
      {field.label}
      {field.required ? <span className="text-red-500"> *</span> : null}
    </label>
  );

  if (field.type === 'textarea' || field.type === 'json_textarea') {
    return (
      <div>
        {commonLabel}
        <textarea
          value={String(value ?? '')}
          disabled={disabled}
          onChange={(event) => onChange(field.name, event.target.value)}
          rows={field.type === 'json_textarea' ? 7 : 4}
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:bg-slate-50"
        />
      </div>
    );
  }

  if (field.type === 'text' || field.type === 'number' || field.type === 'datetime') {
    return (
      <div>
        {commonLabel}
        <input
          type={field.type === 'datetime' ? 'datetime-local' : field.type === 'number' ? 'number' : 'text'}
          value={String(value ?? '')}
          disabled={disabled}
          onChange={(event) => onChange(field.name, event.target.value)}
          className="w-full rounded-xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15 disabled:cursor-not-allowed disabled:bg-slate-50"
        />
      </div>
    );
  }

  if (field.type === 'customer_select' || field.type === 'user_select' || field.type === 'priority' || field.type === 'boolean_nullable' || field.type === 'enum') {
    return (
      <SearchableSelect
        value={String(value ?? '')}
        options={fieldOptions(field, customers, employees)}
        onChange={(nextValue) => onChange(field.name, nextValue)}
        label={field.label}
        placeholder={`Chọn ${field.label.toLowerCase()}`}
        searchPlaceholder={`Tìm ${field.label.toLowerCase()}...`}
        disabled={disabled}
        compact
      />
    );
  }

  return null;
};

const humanizeKetQua = (value: string): string => {
  switch (value) {
    case 'dang_xu_ly':
      return 'Đang xử lý';
    case 'hoan_thanh':
      return 'Hoàn thành';
    case 'khong_tiep_nhan':
      return 'Không tiếp nhận';
    case 'ket_thuc':
      return 'Kết thúc';
    default:
      return value;
  }
};

export const YeuCauManagementHub: React.FC<YeuCauManagementHubProps> = ({
  customers,
  employees,
  currentUserId,
  canReadRequests,
  canWriteRequests,
  onNotify,
}) => {
  const [catalog, setCatalog] = useState<YeuCauProcessCatalog | null>(null);
  const [activeProcessCode, setActiveProcessCode] = useState<string>('');
  const [listRows, setListRows] = useState<YeuCau[]>([]);
  const [listMeta, setListMeta] = useState<PaginationMeta | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearchTerm = useDeferredValue(searchTerm);
  const [selectedRequestId, setSelectedRequestId] = useState<string | number | null>(null);
  const [activeEditorProcessCode, setActiveEditorProcessCode] = useState<string>('');
  const [processDetail, setProcessDetail] = useState<YeuCauProcessDetail | null>(null);
  const [timeline, setTimeline] = useState<YeuCauTimelineEntry[]>([]);
  const [people, setPeople] = useState<YeuCauRelatedUser[]>([]);
  const [masterDraft, setMasterDraft] = useState<DraftState>({});
  const [processDraft, setProcessDraft] = useState<DraftState>({});
  const [isCreateMode, setIsCreateMode] = useState(false);
  const [isCatalogLoading, setIsCatalogLoading] = useState(false);
  const [isListLoading, setIsListLoading] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  const employeeOptions = useMemo<SearchableSelectOption[]>(
    () =>
      employees.map((employee) => ({
        value: String(employee.id),
        label: employee.full_name || employee.username,
        searchText: `${employee.full_name || ''} ${employee.user_code || ''} ${employee.username || ''}`,
      })),
    [employees]
  );

  const customerOptions = useMemo<SearchableSelectOption[]>(
    () =>
      customers.map((customer) => ({
        value: String(customer.id),
        label: customer.customer_name,
        searchText: `${customer.customer_name} ${customer.customer_code}`,
      })),
    [customers]
  );

  const masterFields = catalog?.master_fields ?? [];
  const activeNavigatorProcess = findProcessByCode(catalog, activeProcessCode);
  const createInitialProcess = findProcessByCode(catalog, 'tt_giao_yc_pm');

  useEffect(() => {
    if (!canReadRequests) {
      return;
    }

    let cancelled = false;
    setIsCatalogLoading(true);
    void fetchYeuCauProcessCatalog()
      .then((nextCatalog) => {
        if (cancelled) {
          return;
        }
        setCatalog(nextCatalog);
        const firstProcess = nextCatalog.groups[0]?.processes[0]?.process_code ?? 'tt_giao_yc_pm';
        setActiveProcessCode((current) => current || firstProcess);
        setActiveEditorProcessCode((current) => current || 'tt_giao_yc_pm');
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        onNotify('error', 'Không thể tải tiến trình', error instanceof Error ? error.message : 'Đã xảy ra lỗi.');
      })
      .finally(() => {
        if (!cancelled) {
          setIsCatalogLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [canReadRequests, onNotify]);

  useEffect(() => {
    if (!canReadRequests || !activeProcessCode || isCreateMode) {
      return;
    }

    let cancelled = false;
    setIsListLoading(true);
    void fetchYeuCauPage({
      page: 1,
      per_page: 50,
      q: deferredSearchTerm || undefined,
      process_code: activeProcessCode,
    })
      .then((result) => {
        if (cancelled) {
          return;
        }
        setListRows(result.data);
        setListMeta(result.meta);
        if (!selectedRequestId && result.data[0]) {
          startTransition(() => {
            setSelectedRequestId(result.data[0].id);
            setActiveEditorProcessCode(result.data[0].tien_trinh_hien_tai || activeProcessCode);
          });
        }
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        onNotify('error', 'Không thể tải danh sách yêu cầu', error instanceof Error ? error.message : 'Đã xảy ra lỗi.');
      })
      .finally(() => {
        if (!cancelled) {
          setIsListLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeProcessCode, canReadRequests, deferredSearchTerm, isCreateMode, onNotify, selectedRequestId]);

  useEffect(() => {
    if (isCreateMode) {
      setTimeline([]);
      setPeople([]);
      const nextMasterDraft = buildDraftFromFields(masterFields, null);
      const nextProcessDraft = buildDraftFromFields(createInitialProcess?.form_fields ?? [], null);
      setMasterDraft(nextMasterDraft);
      setProcessDraft(nextProcessDraft);
      setProcessDetail(null);
      return;
    }

    if (!selectedRequestId || !activeEditorProcessCode) {
      setProcessDetail(null);
      setTimeline([]);
      setPeople([]);
      return;
    }

    let cancelled = false;
    setIsDetailLoading(true);
    Promise.all([
      fetchYeuCauProcessDetail(selectedRequestId, activeEditorProcessCode),
      fetchYeuCauTimeline(selectedRequestId),
      fetchYeuCauPeople(selectedRequestId),
    ])
      .then(([detail, nextTimeline, nextPeople]) => {
        if (cancelled) {
          return;
        }
        setProcessDetail(detail);
        setTimeline(nextTimeline);
        setPeople(nextPeople);
        setMasterDraft(buildDraftFromFields(masterFields, detail.yeu_cau as unknown as Record<string, unknown>));
        setProcessDraft(buildDraftFromFields(detail.process.form_fields, detail.process_row?.data));
      })
      .catch((error) => {
        if (cancelled) {
          return;
        }
        onNotify('error', 'Không thể tải chi tiết yêu cầu', error instanceof Error ? error.message : 'Đã xảy ra lỗi.');
      })
      .finally(() => {
        if (!cancelled) {
          setIsDetailLoading(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeEditorProcessCode, createInitialProcess?.form_fields, isCreateMode, masterFields, onNotify, selectedRequestId]);

  const editorProcessMeta = isCreateMode
    ? createInitialProcess
    : processDetail?.process ?? findProcessByCode(catalog, activeEditorProcessCode);

  const transitionOptions = useMemo(() => {
    if (isCreateMode || !processDetail) {
      return editorProcessMeta ? [editorProcessMeta] : [];
    }

    const options = [processDetail.current_process, ...(processDetail.allowed_next_processes || [])]
      .filter((item): item is YeuCauProcessMeta => Boolean(item))
      .filter((item, index, array) => array.findIndex((candidate) => candidate.process_code === item.process_code) === index);

    return options;
  }, [editorProcessMeta, isCreateMode, processDetail]);

  const canEditActiveForm = canWriteRequests && (isCreateMode || Boolean(processDetail?.can_write));

  const handleCreateMode = () => {
    startTransition(() => {
      setIsCreateMode(true);
      setSelectedRequestId(null);
      setActiveEditorProcessCode('tt_giao_yc_pm');
    });
  };

  const handleSave = async () => {
    if (!editorProcessMeta) {
      onNotify('error', 'Chưa xác định tiến trình', 'Vui lòng chọn một tiến trình hợp lệ để lưu.');
      return;
    }

    setIsSaving(true);
    try {
      if (isCreateMode) {
        const created = await createYeuCau({
          ...buildPayloadFromDraft(masterFields, masterDraft),
          created_by: currentUserId,
          nguoi_tao_id: currentUserId,
          process_payload: buildPayloadFromDraft(editorProcessMeta.form_fields, processDraft),
        });

        onNotify('success', 'Đã tạo yêu cầu', `Yêu cầu ${created.ma_yc} đã được tạo thành công.`);
        setIsCreateMode(false);
        startTransition(() => {
          setActiveProcessCode(created.tien_trinh_hien_tai || 'tt_giao_yc_pm');
          setSelectedRequestId(created.id);
          setActiveEditorProcessCode(created.tien_trinh_hien_tai || 'tt_giao_yc_pm');
        });
      } else if (selectedRequestId !== null) {
        const saved = await saveYeuCauProcess(selectedRequestId, editorProcessMeta.process_code, {
          ...buildPayloadFromDraft(masterFields, masterDraft),
          updated_by: currentUserId,
          process_payload: buildPayloadFromDraft(editorProcessMeta.form_fields, processDraft),
        });

        const nextProcessCode = saved.tien_trinh_hien_tai || editorProcessMeta.process_code;
        onNotify(
          'success',
          'Đã lưu yêu cầu',
          editorProcessMeta.process_code === processDetail?.current_process?.process_code
            ? `Yêu cầu ${saved.ma_yc} đã được cập nhật.`
            : `Yêu cầu ${saved.ma_yc} đã chuyển sang ${findProcessByCode(catalog, nextProcessCode)?.process_label || nextProcessCode}.`
        );

        startTransition(() => {
          setActiveProcessCode(nextProcessCode);
          setSelectedRequestId(saved.id);
          setActiveEditorProcessCode(nextProcessCode);
        });
      }

      const nextCatalog = await fetchYeuCauProcessCatalog();
      setCatalog(nextCatalog);
    } catch (error) {
      onNotify('error', 'Không thể lưu yêu cầu', error instanceof Error ? error.message : 'Đã xảy ra lỗi.');
    } finally {
      setIsSaving(false);
    }
  };

  if (!canReadRequests) {
    return (
      <div className="rounded-3xl border border-slate-200 bg-white p-8 shadow-sm">
        <h2 className="text-2xl font-bold text-slate-900">Quản lý yêu cầu khách hàng</h2>
        <p className="mt-3 text-sm text-slate-500">Bạn chưa có quyền xem module này.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="text-sm font-semibold uppercase tracking-[0.24em] text-primary">yeu_cau + tt_*</p>
            <h2 className="mt-2 text-3xl font-black tracking-tight text-slate-900">Quản lý yêu cầu khách hàng</h2>
            <p className="mt-2 max-w-3xl text-sm text-slate-500">
              Shell mới theo từng tiến trình. Mỗi bảng <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">tt_*</code> là một màn thao tác riêng, còn
              bảng <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">yeu_cau</code> giữ snapshot chung của yêu cầu.
            </p>
          </div>

          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={handleCreateMode}
              disabled={!canWriteRequests || isSaving}
              className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <span className="material-symbols-outlined text-[18px]">add_circle</span>
              Tạo yêu cầu mới
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-5 xl:grid-cols-[280px_360px_minmax(0,1fr)]">
        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">Tiến trình</h3>
            {isCatalogLoading ? <span className="text-xs text-slate-400">Đang tải...</span> : null}
          </div>

          <div className="space-y-4">
            {(catalog?.groups || []).map((group) => (
              <div key={group.group_code} className="space-y-2">
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">{group.group_label}</p>
                <div className="space-y-1.5">
                  {group.processes.map((process) => {
                    const isActive = process.process_code === activeProcessCode && !isCreateMode;
                    return (
                      <button
                        key={process.process_code}
                        type="button"
                        onClick={() => {
                          startTransition(() => {
                            setIsCreateMode(false);
                            setActiveProcessCode(process.process_code);
                            setActiveEditorProcessCode(process.process_code);
                            setSelectedRequestId(null);
                          });
                        }}
                        className={`flex w-full items-center justify-between rounded-2xl border px-3 py-2.5 text-left transition ${
                          isActive
                            ? 'border-primary/30 bg-primary/10 text-primary'
                            : 'border-slate-200 bg-white text-slate-700 hover:border-primary/20 hover:bg-slate-50'
                        }`}
                      >
                        <span className="pr-3 text-sm font-semibold">{process.process_label}</span>
                        <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-bold text-slate-500">{process.active_count ?? 0}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-[0.18em] text-slate-500">Danh sách yêu cầu</h3>
              <p className="mt-1 text-sm text-slate-500">{activeNavigatorProcess?.process_label || 'Chọn tiến trình để xem yêu cầu.'}</p>
            </div>
            {listMeta ? <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">{listMeta.total} yêu cầu</span> : null}
          </div>

          <div className="mb-4">
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Tìm theo mã YC, tiêu đề, khách hàng..."
              className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
            />
          </div>

          <div className="max-h-[70vh] space-y-3 overflow-y-auto pr-1 custom-scrollbar">
            {isListLoading ? (
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-400">Đang tải danh sách yêu cầu...</div>
            ) : listRows.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-10 text-center text-sm text-slate-400">
                Chưa có yêu cầu nào trong tiến trình này.
              </div>
            ) : (
              listRows.map((row) => {
                const isActive = !isCreateMode && String(selectedRequestId ?? '') === String(row.id);
                return (
                  <button
                    key={String(row.id)}
                    type="button"
                    onClick={() => {
                      startTransition(() => {
                        setIsCreateMode(false);
                        setSelectedRequestId(row.id);
                        setActiveEditorProcessCode(row.tien_trinh_hien_tai || activeProcessCode);
                      });
                    }}
                    className={`w-full rounded-2xl border p-4 text-left transition ${
                      isActive
                        ? 'border-primary/30 bg-primary/10 shadow-sm'
                        : 'border-slate-200 bg-white hover:border-primary/20 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">{row.ma_yc}</p>
                        <h4 className="mt-1 line-clamp-2 text-sm font-bold text-slate-900">{row.tieu_de}</h4>
                      </div>
                      <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-500 shadow-sm">
                        {row.current_process_label || row.tien_trinh_hien_tai}
                      </span>
                    </div>
                    <div className="mt-3 space-y-1 text-xs text-slate-500">
                      <p>Khách hàng: {row.khach_hang_name || '--'}</p>
                      <p>Trạng thái: {row.trang_thai}</p>
                      <p>Cập nhật: {formatDateDdMmYyyy(row.updated_at || row.created_at || null)}</p>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <div className="mb-5 flex flex-col gap-3 border-b border-slate-100 pb-4 lg:flex-row lg:items-start lg:justify-between">
            <div>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-slate-400">
                {isCreateMode ? 'Tạo mới' : processDetail?.yeu_cau?.ma_yc || 'Chi tiết yêu cầu'}
              </p>
              <h3 className="mt-2 text-2xl font-black tracking-tight text-slate-900">
                {isCreateMode ? 'Yêu cầu mới' : processDetail?.yeu_cau?.tieu_de || 'Chọn một yêu cầu để thao tác'}
              </h3>
              {!isCreateMode && processDetail ? (
                <p className="mt-2 text-sm text-slate-500">
                  Tiến trình hiện tại: <span className="font-semibold text-slate-700">{processDetail.current_process?.process_label || '--'}</span>
                  {' · '}
                  Kết quả: <span className="font-semibold text-slate-700">{humanizeKetQua(processDetail.yeu_cau.ket_qua)}</span>
                </p>
              ) : null}
            </div>

            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleSave}
                disabled={!canEditActiveForm || !editorProcessMeta || isSaving}
                className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-sm font-semibold text-white transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <span className="material-symbols-outlined text-[18px]">{isSaving ? 'progress_activity' : 'save'}</span>
                {isCreateMode
                  ? 'Tạo yêu cầu'
                  : editorProcessMeta?.process_code !== processDetail?.current_process?.process_code
                  ? `Chuyển sang ${editorProcessMeta?.process_label || 'tiến trình mới'}`
                  : 'Lưu tiến trình'}
              </button>
            </div>
          </div>

          {isDetailLoading ? (
            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-12 text-center text-sm text-slate-400">Đang tải chi tiết yêu cầu...</div>
          ) : !isCreateMode && !processDetail ? (
            <div className="rounded-2xl border border-dashed border-slate-200 px-4 py-12 text-center text-sm text-slate-400">
              Chọn một yêu cầu ở cột giữa để xem chi tiết hoặc tạo yêu cầu mới.
            </div>
          ) : (
            <div className="space-y-6">
              {transitionOptions.length > 0 ? (
                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="mb-3 flex items-center justify-between gap-3">
                    <div>
                      <h4 className="text-sm font-bold uppercase tracking-[0.16em] text-slate-500">Tiến trình thao tác</h4>
                      <p className="mt-1 text-sm text-slate-500">Chọn đúng bảng `tt_*` để cập nhật hoặc chuyển tiếp yêu cầu.</p>
                    </div>
                    {editorProcessMeta ? (
                      <span className="rounded-full bg-primary/10 px-3 py-1 text-xs font-bold text-primary">{editorProcessMeta.table_name}</span>
                    ) : null}
                  </div>
                  <SearchableSelect
                    value={activeEditorProcessCode}
                    options={transitionOptions.map((process) => ({
                      value: process.process_code,
                      label: process.process_label,
                      searchText: `${process.process_label} ${process.table_name}`,
                    }))}
                    onChange={(nextValue) => setActiveEditorProcessCode(nextValue)}
                    placeholder="Chọn tiến trình thao tác"
                    searchPlaceholder="Tìm tiến trình..."
                    compact
                  />
                </div>
              ) : null}

              <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_340px]">
                <div className="space-y-5">
                  <div className="rounded-2xl border border-slate-200 p-4">
                    <div className="mb-4 flex items-center justify-between gap-3">
                      <div>
                        <h4 className="text-sm font-bold uppercase tracking-[0.16em] text-slate-500">Thông tin yêu cầu</h4>
                        <p className="mt-1 text-sm text-slate-500">Snapshot chính của bảng master `yeu_cau`.</p>
                      </div>
                      {!isCreateMode && processDetail ? (
                        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-500">{processDetail.yeu_cau.ma_yc}</span>
                      ) : null}
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      {masterFields.map((field) => (
                        <ProcessFieldInput
                          key={field.name}
                          field={field}
                          value={masterDraft[field.name]}
                          customers={customers}
                          employees={employees}
                          disabled={!canEditActiveForm || isSaving}
                          onChange={(fieldName, value) =>
                            setMasterDraft((current) => ({
                              ...current,
                              [fieldName]: value,
                            }))
                          }
                        />
                      ))}
                    </div>
                  </div>

                  {editorProcessMeta ? (
                    <div className="rounded-2xl border border-slate-200 p-4">
                      <div className="mb-4">
                        <h4 className="text-sm font-bold uppercase tracking-[0.16em] text-slate-500">{editorProcessMeta.process_label}</h4>
                        <p className="mt-1 text-sm text-slate-500">
                          Bảng nguồn: <code className="rounded bg-slate-100 px-1 py-0.5 text-xs">{editorProcessMeta.table_name}</code>
                        </p>
                      </div>
                      <div className="grid gap-4 md:grid-cols-2">
                        {editorProcessMeta.form_fields.map((field) => (
                          <ProcessFieldInput
                            key={field.name}
                            field={field}
                            value={processDraft[field.name]}
                            customers={customers}
                            employees={employees}
                            disabled={!canEditActiveForm || isSaving}
                            onChange={(fieldName, value) =>
                              setProcessDraft((current) => ({
                                ...current,
                                [fieldName]: value,
                              }))
                            }
                          />
                        ))}
                      </div>
                    </div>
                  ) : null}
                </div>

                <div className="space-y-5">
                  <div className="rounded-2xl border border-slate-200 p-4">
                    <h4 className="text-sm font-bold uppercase tracking-[0.16em] text-slate-500">Người liên quan</h4>
                    <div className="mt-4 max-h-[280px] space-y-3 overflow-y-auto pr-1 custom-scrollbar">
                      {people.length === 0 ? (
                        <p className="text-sm text-slate-400">Chưa có dữ liệu người liên quan.</p>
                      ) : (
                        people.map((person) => (
                          <div key={String(person.id)} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                            <div className="flex items-center justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-slate-900">{person.user_name || '--'}</p>
                                <p className="text-xs text-slate-500">{person.user_code || '--'}</p>
                              </div>
                              <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-500 shadow-sm">
                                {HUMAN_ROLE_LABEL[person.vai_tro] || person.vai_tro}
                              </span>
                            </div>
                            <p className="mt-2 text-xs text-slate-500">
                              Hiệu lực từ: {person.trang_thai_bat_dau || 'Toàn bộ'} · {person.is_active ? 'Đang hoạt động' : 'Đã thu hồi'}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  <div className="rounded-2xl border border-slate-200 p-4">
                    <h4 className="text-sm font-bold uppercase tracking-[0.16em] text-slate-500">Timeline</h4>
                    <div className="mt-4 max-h-[360px] space-y-3 overflow-y-auto pr-1 custom-scrollbar">
                      {timeline.length === 0 ? (
                        <p className="text-sm text-slate-400">Chưa có lịch sử chuyển trạng thái.</p>
                      ) : (
                        timeline.map((entry) => (
                          <div key={String(entry.id)} className="rounded-2xl border border-slate-100 bg-slate-50 p-3">
                            <div className="flex items-start justify-between gap-3">
                              <div>
                                <p className="text-sm font-semibold text-slate-900">{entry.trang_thai_moi || '--'}</p>
                                <p className="text-xs text-slate-500">
                                  {entry.tien_trinh}
                                  {entry.trang_thai_cu ? ` · từ ${entry.trang_thai_cu}` : ''}
                                </p>
                              </div>
                              <span className="text-[11px] font-semibold text-slate-400">{formatDateDdMmYyyy(entry.thay_doi_luc || null)}</span>
                            </div>
                            <p className="mt-2 text-xs text-slate-500">
                              {entry.nguoi_thay_doi_name || '--'}
                              {entry.ly_do ? ` · ${entry.ly_do}` : ''}
                            </p>
                          </div>
                        ))
                      )}
                    </div>
                  </div>

                  {!isCreateMode && processDetail ? (
                    <div className="rounded-2xl border border-slate-200 p-4">
                      <h4 className="text-sm font-bold uppercase tracking-[0.16em] text-slate-500">Snapshot phân công</h4>
                      <div className="mt-4 space-y-3 text-sm text-slate-600">
                        <div className="flex items-center justify-between gap-3">
                          <span>PM</span>
                          <span className="font-semibold text-slate-900">{processDetail.yeu_cau.pm_name || '--'}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span>BA</span>
                          <span className="font-semibold text-slate-900">{processDetail.yeu_cau.ba_name || '--'}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span>R</span>
                          <span className="font-semibold text-slate-900">{processDetail.yeu_cau.r_name || '--'}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span>Dev</span>
                          <span className="font-semibold text-slate-900">{processDetail.yeu_cau.dev_name || '--'}</span>
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <span>Người trao đổi</span>
                          <span className="font-semibold text-slate-900">{processDetail.yeu_cau.nguoi_trao_doi_name || '--'}</span>
                        </div>
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            </div>
          )}
        </section>
      </div>
    </div>
  );
};
