import React, { useMemo, useState } from 'react';
import { Attachment, Employee, FeedbackPriority, FeedbackRequest, FeedbackStatus } from '../../types';
import { deleteUploadedFeedbackAttachment, uploadFeedbackAttachment } from '../../services/v5Api';
import { useEscKey } from '../../hooks/useEscKey';
import { AttachmentManager } from '../AttachmentManager';
import { FormSelect } from './selectPrimitives';
import { FormInput, ModalWrapper } from './shared';

const FEEDBACK_PRIORITY_OPTIONS = [
  { value: 'UNRATED', label: 'Chưa đánh giá' },
  { value: 'LOW', label: 'Thấp' },
  { value: 'MEDIUM', label: 'Trung bình' },
  { value: 'HIGH', label: 'Cao' },
];

const FEEDBACK_STATUS_OPTIONS = [
  { value: 'IN_PROGRESS', label: 'Đang xử lý' },
  { value: 'RESOLVED', label: 'Đã giải quyết' },
  { value: 'CLOSED', label: 'Đã đóng' },
  { value: 'CANCELLED', label: 'Đã huỷ' },
];

const PRIORITY_BADGE: Record<FeedbackPriority, string> = {
  UNRATED: 'bg-slate-100 text-slate-600',
  LOW: 'bg-sky-100 text-sky-700',
  MEDIUM: 'bg-amber-100 text-amber-700',
  HIGH: 'bg-red-100 text-red-700',
};

const STATUS_BADGE: Record<FeedbackStatus, string> = {
  OPEN: 'bg-blue-100 text-blue-700',
  IN_PROGRESS: 'bg-yellow-100 text-yellow-700',
  RESOLVED: 'bg-green-100 text-green-700',
  CLOSED: 'bg-slate-100 text-slate-500',
  CANCELLED: 'bg-red-50 text-red-500',
};

const PRIORITY_LABEL: Record<FeedbackPriority, string> = {
  UNRATED: 'Chưa đánh giá',
  LOW: 'Thấp',
  MEDIUM: 'Trung bình',
  HIGH: 'Cao',
};

const STATUS_LABEL: Record<FeedbackStatus, string> = {
  OPEN: 'Mở',
  IN_PROGRESS: 'Đang xử lý',
  RESOLVED: 'Đã giải quyết',
  CLOSED: 'Đã đóng',
  CANCELLED: 'Đã huỷ',
};

export const FeedbackFormModal: React.FC<{
  type: 'ADD' | 'EDIT';
  data?: FeedbackRequest | null;
  isSaving?: boolean;
  onClose: () => void;
  onSave: (data: { title: string; description: string | null; priority: FeedbackPriority; status?: FeedbackStatus; attachments: Attachment[] }) => void;
}> = ({ type, data, isSaving = false, onClose, onSave }) => {
  const [title, setTitle] = useState(data?.title ?? '');
  const [description, setDescription] = useState(data?.description ?? '');
  const [priority, setPriority] = useState<FeedbackPriority>(data?.priority ?? 'UNRATED');
  const [status, setStatus] = useState<FeedbackStatus>(data?.status ?? 'OPEN');
  const [attachments, setAttachments] = useState<Attachment[]>(data?.attachments ?? []);
  const [isUploading, setIsUploading] = useState(false);
  const [errors, setErrors] = useState<{ title?: string }>({});

  const validate = () => {
    const nextErrors: { title?: string } = {};
    if (!title.trim()) nextErrors.title = 'Tiêu đề không được để trống.';
    setErrors(nextErrors);
    return Object.keys(nextErrors).length === 0;
  };

  const handleSubmit = () => {
    if (!validate()) return;

    onSave({
      title: title.trim(),
      description: description.trim() || null,
      priority,
      attachments,
      ...(type === 'EDIT' ? { status } : {}),
    });
  };

  const handleUploadFile = async (file: File) => {
    setIsUploading(true);
    try {
      const newAttachment = await uploadFeedbackAttachment(file);
      setAttachments((prev) => [...prev, newAttachment]);
      if (String(newAttachment.warningMessage || '').trim() !== '') {
        alert(String(newAttachment.warningMessage || '').trim());
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      alert(`Tải file thất bại: ${message}`);
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteFile = async (id: string) => {
    if (!window.confirm('Bạn có chắc chắn muốn xóa file đính kèm này?')) return;

    try {
      const target = attachments.find((attachment) => String(attachment.id) === String(id));
      if (target) {
        await deleteUploadedFeedbackAttachment({
          driveFileId: target.driveFileId || null,
          fileUrl: target.fileUrl || null,
          storagePath: target.storagePath || null,
          storageDisk: target.storageDisk || null,
        });
      }
      setAttachments((prev) => prev.filter((attachment) => String(attachment.id) !== String(id)));
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Lỗi không xác định';
      alert(`Xóa file thất bại: ${message}`);
    }
  };

  return (
    <ModalWrapper
      onClose={onClose}
      title={type === 'ADD' ? 'Thêm góp ý' : 'Chỉnh sửa góp ý'}
      icon="feedback"
      width="max-w-2xl"
    >
      <div className="space-y-4 p-6">
        <FormInput
          label="Tiêu đề"
          value={title}
          onChange={(e: React.ChangeEvent<HTMLInputElement>) => setTitle(e.target.value)}
          placeholder="Nhập tiêu đề góp ý..."
          required
          error={errors.title}
        />
        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-slate-700">Nội dung chi tiết</label>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            rows={4}
            placeholder="Mô tả chi tiết góp ý, vấn đề hoặc đề xuất..."
            className="w-full resize-none rounded-lg border border-slate-300 bg-white px-4 py-3 text-slate-900 outline-none transition-all placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20"
          />
        </div>
        <FormSelect
          label="Mức độ ưu tiên"
          value={priority}
          onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setPriority(e.target.value as FeedbackPriority)}
          options={FEEDBACK_PRIORITY_OPTIONS}
        />
        {type === 'EDIT' ? (
          <FormSelect
            label="Trạng thái"
            value={status}
            onChange={(e: React.ChangeEvent<HTMLSelectElement>) => setStatus(e.target.value as FeedbackStatus)}
            options={FEEDBACK_STATUS_OPTIONS}
          />
        ) : null}

        <div className="border-t border-slate-100 pt-2">
          <AttachmentManager
            attachments={attachments}
            onUpload={handleUploadFile}
            onDelete={handleDeleteFile}
            isUploading={isUploading}
            disabled={isSaving}
            uploadButtonLabel="Tải file / ảnh"
            helperText="Hỗ trợ PDF, Word, Excel, ảnh PNG/JPG/WEBP, ZIP... (tối đa 20 MB)."
            emptyStateDescription="Đính kèm ảnh chụp màn hình, tài liệu mô tả lỗi hoặc đề xuất."
            enableClipboardPaste
            clipboardPasteHint="Click vào khung rồi Ctrl/Cmd+V để dán ảnh trực tiếp từ clipboard."
          />
        </div>
      </div>

      <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
        <button
          onClick={onClose}
          disabled={isSaving || isUploading}
          className="rounded-lg border border-slate-300 px-5 py-2.5 font-medium text-slate-700 transition-colors hover:bg-slate-100 disabled:opacity-50"
        >
          Hủy
        </button>
        <button
          onClick={handleSubmit}
          disabled={isSaving || isUploading}
          className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 font-bold text-white shadow-lg shadow-primary/20 transition-all hover:bg-deep-teal disabled:opacity-60"
        >
          {isSaving ? (
            <span className="material-symbols-outlined text-lg animate-spin">progress_activity</span>
          ) : isUploading ? (
            <span className="material-symbols-outlined text-lg animate-spin">upload</span>
          ) : (
            <span className="material-symbols-outlined text-lg">check</span>
          )}
          {isSaving ? 'Đang lưu...' : isUploading ? 'Đang tải file...' : type === 'ADD' ? 'Thêm góp ý' : 'Lưu thay đổi'}
        </button>
      </div>
    </ModalWrapper>
  );
};

export const FeedbackViewModal: React.FC<{
  data: FeedbackRequest | null;
  employees?: Employee[];
  onClose: () => void;
  onEdit?: () => void;
  isLoading?: boolean;
}> = ({ data, employees = [], onClose, onEdit, isLoading = false }) => {
  useEscKey(onClose);

  const employeeMap = useMemo(() => {
    const map = new Map<number, string>();
    employees.forEach((employee) => {
      if (employee.id != null) {
        map.set(Number(employee.id), employee.full_name ?? employee.username ?? `#${employee.id}`);
      }
    });
    return map;
  }, [employees]);

  const resolveName = (id: number | null | undefined) => {
    if (id == null) return '—';
    return employeeMap.get(Number(id)) ?? `#${id}`;
  };

  const fmtDateTime = (iso: string | null | undefined) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleString('vi-VN', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const STATUS_ICON: Record<FeedbackStatus, string> = {
    OPEN: 'radio_button_unchecked',
    IN_PROGRESS: 'pending',
    RESOLVED: 'check_circle',
    CLOSED: 'cancel',
    CANCELLED: 'do_not_disturb_on',
  };

  const PRIORITY_ICON: Record<FeedbackPriority, string> = {
    UNRATED: 'help',
    LOW: 'arrow_downward',
    MEDIUM: 'remove',
    HIGH: 'arrow_upward',
  };

  if (isLoading || !data) {
    return (
      <ModalWrapper onClose={onClose} title="Chi tiết góp ý" icon="feedback" width="max-w-3xl">
        <div className="flex items-center justify-center py-20">
          <span className="material-symbols-outlined mr-3 animate-spin text-4xl text-slate-400">progress_activity</span>
          <span className="text-sm text-slate-500">Đang tải chi tiết...</span>
        </div>
      </ModalWrapper>
    );
  }

  const hasAttachments = (data.attachments ?? []).length > 0;
  const responses = (data as any).responses as Array<{
    id: number;
    content: string;
    is_admin_response: boolean;
    created_by?: number | null;
    created_at?: string | null;
  }> | undefined;
  const hasResponses = Boolean(responses && responses.length > 0);

  return (
    <ModalWrapper onClose={onClose} title="Chi tiết góp ý" icon="feedback" width="max-w-3xl">
      <div className="border-b border-slate-100 bg-gradient-to-br from-slate-50 to-white px-6 pb-4 pt-5">
        <h3 className="mb-3 text-lg font-bold leading-snug text-slate-900">{data.title}</h3>

        <div className="flex flex-wrap items-center gap-2">
          <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold ${PRIORITY_BADGE[data.priority]}`}>
            <span className="material-symbols-outlined text-[14px]">{PRIORITY_ICON[data.priority]}</span>
            {PRIORITY_LABEL[data.priority]}
          </span>

          <span className={`inline-flex items-center gap-1 rounded-full px-3 py-1.5 text-xs font-bold ${STATUS_BADGE[data.status]}`}>
            <span className="material-symbols-outlined text-[14px]">{STATUS_ICON[data.status]}</span>
            {STATUS_LABEL[data.status]}
          </span>

          {hasAttachments ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-violet-100 bg-violet-50 px-2.5 py-1.5 text-xs font-semibold text-violet-700">
              <span className="material-symbols-outlined text-[14px]">attach_file</span>
              {data.attachments!.length} file
            </span>
          ) : null}

          {hasResponses ? (
            <span className="inline-flex items-center gap-1 rounded-full border border-sky-100 bg-sky-50 px-2.5 py-1.5 text-xs font-semibold text-sky-700">
              <span className="material-symbols-outlined text-[14px]">forum</span>
              {responses!.length} phản hồi
            </span>
          ) : null}
        </div>
      </div>

      <div className="max-h-[60vh] overflow-y-auto">
        <div className="grid grid-cols-1 divide-y divide-slate-100 md:grid-cols-3 md:divide-x md:divide-y-0">
          <div className="space-y-5 p-6 md:col-span-2">
            {data.description ? (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  <span className="material-symbols-outlined mr-1 align-[-2px] text-[14px]">notes</span>
                  Nội dung chi tiết
                </p>
                <div className="min-h-[60px] whitespace-pre-wrap rounded-xl border border-slate-100 bg-slate-50 px-4 py-3.5 text-sm leading-relaxed text-slate-700">
                  {data.description}
                </div>
              </div>
            ) : (
              <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-4 py-3.5 text-sm italic text-slate-400">
                Không có mô tả chi tiết.
              </div>
            )}

            {hasAttachments ? (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  <span className="material-symbols-outlined mr-1 align-[-2px] text-[14px]">attach_file</span>
                  File đính kèm ({data.attachments!.length})
                </p>
                <AttachmentManager
                  attachments={data.attachments!}
                  onUpload={async () => {}}
                  onDelete={async () => {}}
                  isUploading={false}
                  disabled
                  helperText=""
                />
              </div>
            ) : null}

            {hasResponses ? (
              <div>
                <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                  <span className="material-symbols-outlined mr-1 align-[-2px] text-[14px]">forum</span>
                  Phản hồi ({responses!.length})
                </p>
                <div className="space-y-2">
                  {responses!.map((response) => (
                    <div
                      key={response.id}
                      className={`rounded-lg border px-4 py-3 text-sm ${response.is_admin_response ? 'border-primary/20 bg-primary/5' : 'border-slate-100 bg-slate-50'}`}
                    >
                      <div className="mb-1 flex items-center justify-between gap-2">
                        <span className={`text-xs font-semibold ${response.is_admin_response ? 'text-primary' : 'text-slate-600'}`}>
                          {response.is_admin_response ? '🛡 Quản trị viên' : resolveName(response.created_by)}
                        </span>
                        {response.created_at ? (
                          <span className="text-xs text-slate-400">{fmtDateTime(response.created_at)}</span>
                        ) : null}
                      </div>
                      <p className="whitespace-pre-wrap leading-relaxed text-slate-700">{response.content}</p>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </div>

          <div className="space-y-4 bg-slate-50/60 p-5 md:col-span-1">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Thông tin</p>

            <div className="flex items-start gap-2.5">
              <span className="material-symbols-outlined mt-0.5 flex-shrink-0 text-[18px] text-slate-400">person</span>
              <div className="min-w-0">
                <p className="mb-0.5 text-[11px] text-slate-400">Người tạo</p>
                <p className="truncate text-sm font-semibold text-slate-800">{resolveName(data.created_by)}</p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <span className="material-symbols-outlined mt-0.5 flex-shrink-0 text-[18px] text-slate-400">calendar_add_on</span>
              <div>
                <p className="mb-0.5 text-[11px] text-slate-400">Ngày tạo</p>
                <p className="text-sm font-medium text-slate-700">{fmtDateTime(data.created_at)}</p>
              </div>
            </div>

            <div className="flex items-start gap-2.5">
              <span className="material-symbols-outlined mt-0.5 flex-shrink-0 text-[18px] text-slate-400">update</span>
              <div>
                <p className="mb-0.5 text-[11px] text-slate-400">Cập nhật lần cuối</p>
                <p className="text-sm font-medium text-slate-700">{fmtDateTime(data.updated_at)}</p>
              </div>
            </div>

            {data.updated_by != null && data.updated_by !== data.created_by ? (
              <div className="flex items-start gap-2.5">
                <span className="material-symbols-outlined mt-0.5 flex-shrink-0 text-[18px] text-slate-400">manage_accounts</span>
                <div className="min-w-0">
                  <p className="mb-0.5 text-[11px] text-slate-400">Người cập nhật</p>
                  <p className="truncate text-sm font-medium text-slate-700">{resolveName(data.updated_by)}</p>
                </div>
              </div>
            ) : null}

            {data.status_changed_at ? (
              <div className="flex items-start gap-2.5">
                <span className="material-symbols-outlined mt-0.5 flex-shrink-0 text-[18px] text-slate-400">published_with_changes</span>
                <div>
                  <p className="mb-0.5 text-[11px] text-slate-400">Đổi trạng thái lúc</p>
                  <p className="text-sm font-medium text-slate-700">{fmtDateTime(data.status_changed_at)}</p>
                  {data.status_changed_by != null ? (
                    <p className="mt-0.5 text-xs text-slate-500">bởi {resolveName(data.status_changed_by)}</p>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className="border-t border-slate-200 pt-3">
              <div className="flex items-center gap-2">
                <span className="material-symbols-outlined text-[16px] text-slate-300">tag</span>
                <span className="font-mono text-xs text-slate-400">ID #{data.id}</span>
              </div>
              {data.uuid ? (
                <p className="mt-0.5 truncate font-mono text-[10px] text-slate-300" title={data.uuid}>
                  {data.uuid}
                </p>
              ) : null}
            </div>
          </div>
        </div>
      </div>

      <div className="flex justify-end gap-3 border-t border-slate-100 bg-slate-50 px-6 py-4">
        <button
          onClick={onClose}
          className="rounded-lg border border-slate-300 px-5 py-2.5 font-medium text-slate-700 transition-colors hover:bg-slate-100"
        >
          Đóng
        </button>
        {onEdit ? (
          <button
            onClick={onEdit}
            className="flex items-center gap-2 rounded-lg bg-primary px-6 py-2.5 font-bold text-white shadow-lg shadow-primary/20 transition-all hover:bg-deep-teal"
          >
            <span className="material-symbols-outlined text-lg">edit</span>
            Chỉnh sửa
          </button>
        ) : null}
      </div>
    </ModalWrapper>
  );
};
