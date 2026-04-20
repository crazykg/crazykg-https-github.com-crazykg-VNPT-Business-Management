
import React, { useState, useMemo } from 'react';
import { Reminder, Employee, ModalType } from '../types';
import { getEmployeeLabel, normalizeEmployeeCode } from '../utils/employeeDisplay';

interface ReminderListProps {
  reminders: Reminder[];
  employees: Employee[];
  onOpenModal: (type: ModalType, item?: Reminder) => void;
  canSendReminderEmail: boolean;
  canSendReminderTelegram: boolean;
  onSendReminderEmail: (item: Reminder, recipientEmail: string) => Promise<void>;
  onSendReminderTelegram: (item: Reminder, recipientUserId: string | number) => Promise<void>;
}

type FilterType = 'ALL' | 'TODAY' | 'UPCOMING' | 'OVERDUE';

export const ReminderList: React.FC<ReminderListProps> = ({
  reminders = [],
  employees = [],
  onOpenModal,
  canSendReminderEmail,
  canSendReminderTelegram,
  onSendReminderEmail,
  onSendReminderTelegram,
}) => {
  const [activeFilter, setActiveFilter] = useState<FilterType>('ALL');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedReminderForMail, setSelectedReminderForMail] = useState<Reminder | null>(null);
  const [recipientEmail, setRecipientEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [isSendingEmail, setIsSendingEmail] = useState(false);

  const [selectedReminderForTelegram, setSelectedReminderForTelegram] = useState<Reminder | null>(null);
  const [recipientTelegramUserId, setRecipientTelegramUserId] = useState('');
  const [telegramError, setTelegramError] = useState('');
  const [isSendingTelegram, setIsSendingTelegram] = useState(false);

  const isGmailAddress = (email: string) => /@gmail\.com$/i.test(email.trim());

  const handleOpenSendEmail = (item: Reminder) => {
    setSelectedReminderForMail(item);
    setRecipientEmail('');
    setEmailError('');
  };

  const handleCloseSendEmail = () => {
    if (isSendingEmail) {
      return;
    }
    setSelectedReminderForMail(null);
    setRecipientEmail('');
    setEmailError('');
  };

  const handleSubmitSendEmail = async () => {
    if (!selectedReminderForMail) {
      return;
    }

    const normalizedEmail = recipientEmail.trim().toLowerCase();
    if (!normalizedEmail) {
      setEmailError('Vui lòng nhập email người nhận.');
      return;
    }
    if (!isGmailAddress(normalizedEmail)) {
      setEmailError('Chỉ hỗ trợ email Gmail (@gmail.com).');
      return;
    }

    try {
      setIsSendingEmail(true);
      setEmailError('');
      await onSendReminderEmail(selectedReminderForMail, normalizedEmail);
      setSelectedReminderForMail(null);
      setRecipientEmail('');
      setEmailError('');
    } catch (error) {
      setEmailError(error instanceof Error ? error.message : 'Gửi email thất bại.');
    } finally {
      setIsSendingEmail(false);
    }
  };

  const handleOpenSendTelegram = (item: Reminder) => {
    setSelectedReminderForTelegram(item);
    setRecipientTelegramUserId('');
    setTelegramError('');
  };

  const handleCloseSendTelegram = () => {
    if (isSendingTelegram) {
      return;
    }
    setSelectedReminderForTelegram(null);
    setRecipientTelegramUserId('');
    setTelegramError('');
  };

  const telegramRecipients = useMemo(
    () => (employees || []).filter((employee) => String(employee.telechatbot || '').trim() !== ''),
    [employees]
  );

  const handleSubmitSendTelegram = async () => {
    if (!selectedReminderForTelegram) {
      return;
    }

    const recipientId = recipientTelegramUserId.trim();
    if (!recipientId) {
      setTelegramError('Vui lòng chọn người nhận Telegram.');
      return;
    }

    try {
      setIsSendingTelegram(true);
      setTelegramError('');
      await onSendReminderTelegram(selectedReminderForTelegram, recipientId);
      setSelectedReminderForTelegram(null);
      setRecipientTelegramUserId('');
      setTelegramError('');
    } catch (error) {
      setTelegramError(error instanceof Error ? error.message : 'Gửi Telegram thất bại.');
    } finally {
      setIsSendingTelegram(false);
    }
  };

  const getEmployeeName = (id: string) => {
    const employee = (employees || []).find(e => String(e.id) === String(id));
    if (!employee) return normalizeEmployeeCode(id, id);
    return getEmployeeLabel(employee);
  };

  const filteredReminders = useMemo(() => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const todayStr = now.toISOString().split('T')[0];

    return (reminders || []).filter(rem => {
      const matchesSearch = rem.title.toLowerCase().includes(searchTerm.toLowerCase()) || 
                           rem.content.toLowerCase().includes(searchTerm.toLowerCase());
      
      let matchesFilter = true;
      if (activeFilter === 'TODAY') {
        matchesFilter = rem.remindDate === todayStr;
      } else if (activeFilter === 'UPCOMING') {
        matchesFilter = rem.remindDate > todayStr;
      } else if (activeFilter === 'OVERDUE') {
        matchesFilter = rem.remindDate < todayStr;
      }

      return matchesSearch && matchesFilter;
    });
  }, [reminders, searchTerm, activeFilter]);

  const isOverdue = (dateStr: string) => {
    const now = new Date();
    now.setHours(0, 0, 0, 0);
    const date = new Date(dateStr);
    return date < now;
  };

  return (
    <div className="p-3 pb-6">
      {/* Header */}
      <header className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded bg-secondary/15 flex items-center justify-center shrink-0">
            <span className="material-symbols-outlined text-secondary" style={{ fontSize: 16 }}>notifications_active</span>
          </div>
          <div>
            <h2 className="text-sm font-bold text-deep-teal leading-tight">Nhắc việc</h2>
            <p className="text-[11px] text-slate-400 mt-0.5">Theo dõi và quản lý các công việc cần thực hiện.</p>
          </div>
        </div>
        <button onClick={() => onOpenModal('ADD_REMINDER')} className="inline-flex items-center gap-2 bg-gradient-to-br from-primary to-primary-container hover:bg-deep-teal transition-all text-white px-2.5 py-1.5 rounded-xl font-semibold text-xs shadow-sm">
          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>add_task</span>
          <span>Thêm nhắc việc</span>
        </button>
      </header>

      {/* Filters & Search */}
      <div className="flex gap-3 mb-3">
        <div className="flex bg-white p-1 rounded-lg border border-slate-200 shadow-sm self-start">
          {(['ALL', 'TODAY', 'UPCOMING', 'OVERDUE'] as FilterType[]).map((f) => (
            <button
              key={f}
              onClick={() => setActiveFilter(f)}
              className={`px-2.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                activeFilter === f
                  ? 'bg-primary text-white shadow-sm'
                  : 'text-neutral hover:bg-surface-variant'
              }`}
            >
              {f === 'ALL' ? 'Tất cả' : f === 'TODAY' ? 'Hôm nay' : f === 'UPCOMING' ? 'Sắp tới' : 'Quá hạn'}
            </button>
          ))}
        </div>
        <div className="flex-1 relative">
          <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-neutral" style={{ fontSize: 16 }}>search</span>
          <input
            type="text"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            placeholder="Tìm kiếm nhắc việc..."
            className="w-full h-8 pl-8 pr-3 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-xs"
          />
        </div>
      </div>

      {/* List */}
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
        {filteredReminders.length > 0 ? (
          filteredReminders.map((item) => {
            const overdue = isOverdue(item.remindDate);
            return (
              <div key={item.id} className={`rounded-lg border bg-white shadow-sm transition-all hover:shadow-md group ${overdue ? 'border-error/30 bg-error/5' : 'border-slate-200'}`}>
                <div className="p-3">
                  <div className="flex justify-between items-start mb-2">
                    <div className={`w-7 h-7 rounded flex items-center justify-center ${overdue ? 'bg-error/10 text-error' : 'bg-secondary/10 text-secondary'}`}>
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }}>notifications_active</span>
                    </div>
                    <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      {canSendReminderEmail && (
                        <button
                          onClick={() => handleOpenSendEmail(item)}
                          className="p-1.5 text-neutral hover:text-secondary hover:bg-secondary/10 rounded-lg transition-all"
                          title="Gửi mail"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>mail</span>
                        </button>
                      )}
                      {canSendReminderTelegram && (
                        <button
                          onClick={() => handleOpenSendTelegram(item)}
                          className="p-1.5 text-neutral hover:text-secondary hover:bg-secondary/10 rounded-lg transition-all"
                          title="Gửi tele"
                        >
                          <span className="material-symbols-outlined" style={{ fontSize: 16 }}>send</span>
                        </button>
                      )}

                      <button onClick={() => onOpenModal('EDIT_REMINDER', item)} className="p-1.5 text-neutral hover:text-primary hover:bg-surface-variant rounded-lg transition-all"><span className="material-symbols-outlined" style={{ fontSize: 16 }}>edit</span></button>
                      <button onClick={() => onOpenModal('DELETE_REMINDER', item)} className="p-1.5 text-neutral hover:text-error hover:bg-error/10 rounded-lg transition-all"><span className="material-symbols-outlined" style={{ fontSize: 16 }}>delete</span></button>
                    </div>
                  </div>

                  <h3 className={`text-sm font-bold mb-1 line-clamp-1 ${overdue ? 'text-error' : 'text-on-surface'}`}>{item.title}</h3>
                  <p className="text-[11px] text-on-surface-variant line-clamp-2 mb-2">{item.content}</p>

                  <div className="space-y-1.5 pt-2 border-t border-slate-100">
                    <div className="flex items-center gap-1.5 text-[10px]">
                      <span className="material-symbols-outlined text-neutral" style={{ fontSize: 14 }}>calendar_today</span>
                      <span className={`font-semibold ${overdue ? 'text-error' : 'text-on-surface-variant'}`}>
                        {item.remindDate} {overdue && '(Quá hạn)'}
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px]">
                      <span className="material-symbols-outlined text-neutral" style={{ fontSize: 14 }}>person</span>
                      <span className="text-on-surface-variant">Giao cho: <span className="font-semibold text-on-surface">{getEmployeeName(item.assignedToUserId)}</span></span>
                    </div>
                  </div>
                </div>
              </div>
            );
          })
        ) : (
          <div className="col-span-full py-20 flex flex-col items-center justify-center text-neutral bg-white rounded-lg border border-dashed border-slate-200">
            <span className="material-symbols-outlined text-neutral" style={{ fontSize: 48 }}>event_busy</span>
            <p className="text-sm font-semibold mt-3">Không tìm thấy nhắc việc nào.</p>
          </div>
        )}
      </div>

      {selectedReminderForMail && (
        <div className="fixed inset-0 z-[120] bg-black/35 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-xl bg-white border border-slate-200 shadow-xl">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-on-surface">Gửi mail nhắc việc</h3>
              <button
                onClick={handleCloseSendEmail}
                disabled={isSendingEmail}
                className="p-1 text-neutral hover:text-on-surface rounded"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
              </button>
            </div>
            <div className="px-4 py-3 space-y-3">
              <p className="text-xs text-on-surface-variant">
                Nhắc việc: <span className="font-semibold text-on-surface">{selectedReminderForMail.title}</span>
              </p>
              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">Email người nhận (Gmail)</label>
                <input
                  type="email"
                  value={recipientEmail}
                  onChange={(e) => {
                    setRecipientEmail(e.target.value);
                    if (emailError) {
                      setEmailError('');
                    }
                  }}
                  placeholder="example@gmail.com"
                  className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-xs"
                  disabled={isSendingEmail}
                />
                {emailError && <p className="mt-1 text-[11px] text-error">{emailError}</p>}
              </div>
            </div>
            <div className="px-4 py-3 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={handleCloseSendEmail}
                disabled={isSendingEmail}
                className="h-8 px-3 text-xs rounded-lg border border-slate-300 text-on-surface hover:bg-slate-50"
              >
                Huỷ
              </button>
              <button
                onClick={handleSubmitSendEmail}
                disabled={isSendingEmail}
                className="h-8 px-3 text-xs rounded-lg bg-primary text-white hover:bg-primary/90 disabled:opacity-60"
              >
                {isSendingEmail ? 'Đang gửi...' : 'Gửi mail'}
              </button>
            </div>
          </div>
        </div>
      )}

      {selectedReminderForTelegram && (
        <div className="fixed inset-0 z-[120] bg-black/35 flex items-center justify-center p-4">
          <div className="w-full max-w-md rounded-xl bg-white border border-slate-200 shadow-xl">
            <div className="px-4 py-3 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-bold text-on-surface">Gửi Telegram nhắc việc</h3>
              <button
                onClick={handleCloseSendTelegram}
                disabled={isSendingTelegram}
                className="p-1 text-neutral hover:text-on-surface rounded"
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }}>close</span>
              </button>
            </div>
            <div className="px-4 py-3 space-y-3">
              <p className="text-xs text-on-surface-variant">
                Nhắc việc: <span className="font-semibold text-on-surface">{selectedReminderForTelegram.title}</span>
              </p>
              <div>
                <label className="block text-xs font-semibold text-on-surface mb-1">Người nhận Telegram</label>
                <select
                  value={recipientTelegramUserId}
                  onChange={(e) => {
                    setRecipientTelegramUserId(e.target.value);
                    if (telegramError) {
                      setTelegramError('');
                    }
                  }}
                  className="w-full h-9 px-3 bg-white border border-slate-200 rounded-lg focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none text-xs"
                  disabled={isSendingTelegram}
                >
                  <option value="">Chọn người nhận</option>
                  {telegramRecipients.map((employee) => (
                    <option key={String(employee.id)} value={String(employee.id)}>
                      {getEmployeeLabel(employee)}
                    </option>
                  ))}
                </select>
                {telegramError && <p className="mt-1 text-[11px] text-error">{telegramError}</p>}
              </div>
            </div>
            <div className="px-4 py-3 border-t border-slate-200 flex justify-end gap-2">
              <button
                onClick={handleCloseSendTelegram}
                disabled={isSendingTelegram}
                className="h-8 px-3 text-xs rounded-lg border border-slate-300 text-on-surface hover:bg-slate-50"
              >
                Huỷ
              </button>
              <button
                onClick={handleSubmitSendTelegram}
                disabled={isSendingTelegram}
                className="h-8 px-3 text-xs rounded-lg bg-primary text-white hover:bg-primary/90 disabled:opacity-60"
              >
                {isSendingTelegram ? 'Đang gửi...' : 'Gửi tele'}
              </button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
};
