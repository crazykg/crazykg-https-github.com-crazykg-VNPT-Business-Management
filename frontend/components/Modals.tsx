
import React, { useState, useEffect, useRef, useMemo } from 'react';
import { Department, Employee, EmployeeType, Gender, EmployeeStatus, VpnStatus, ModalType, Business, Vendor, Product, Customer, CustomerPersonnel, PositionType, Opportunity, OpportunityStatus, Project, ProjectStatus, InvestmentMode, ProjectItem, Contract, ContractStatus, Document as AppDocument, Attachment, DocumentType, Reminder, ProjectRACI, RACIRole, UserDeptHistory } from '../types';
import { PARENT_OPTIONS, MOCK_DEPARTMENTS, POSITION_TYPES, OPPORTUNITY_STATUSES, PROJECT_STATUSES, INVESTMENT_MODES, CONTRACT_STATUSES, DOCUMENT_TYPES, DOCUMENT_STATUSES, RACI_ROLES } from '../constants';

interface ModalWrapperProps {
  children: React.ReactNode;
  onClose: () => void;
  title: string;
  icon: string;
  width?: string;
}

const ModalWrapper: React.FC<ModalWrapperProps> = ({ children, onClose, title, icon, width = 'max-w-[560px]' }) => (
  <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
    <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose}></div>
    <div className={`relative bg-white w-full ${width} max-h-[90vh] rounded-xl shadow-2xl flex flex-col overflow-hidden animate-fade-in`}>
      <div className="flex items-center justify-between px-4 md:px-6 py-4 border-b border-slate-100 flex-shrink-0">
        <div className="flex items-center gap-3 text-slate-900">
          <span className="material-symbols-outlined text-primary text-2xl">{icon}</span>
          <h2 className="text-lg md:text-xl font-bold leading-tight tracking-tight line-clamp-1">{title}</h2>
        </div>
        <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-full transition-colors text-slate-400 hover:text-slate-600">
          <span className="material-symbols-outlined text-2xl">close</span>
        </button>
      </div>
      <div className="overflow-y-auto flex-1 custom-scrollbar">
        {children}
      </div>
    </div>
  </div>
);

// --- Searchable Select Component ---
interface SearchableSelectProps {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  label?: string;
  error?: string;
  required?: boolean;
  disabled?: boolean;
}

const SearchableSelect: React.FC<SearchableSelectProps> = ({ options, value, onChange, placeholder, label, error, required, disabled }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const wrapperRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  // Focus search input when opened
  useEffect(() => {
    if (isOpen && inputRef.current) {
        inputRef.current.focus();
    }
  }, [isOpen]);

  const filteredOptions = (options || []).filter(opt =>
    opt.label.toLowerCase().includes(searchTerm.toLowerCase())
  );
  
  // Find label for current value if exists to display
  const currentLabel = (options || []).find(opt => opt.value === value)?.label || value;

  return (
    <div className={`col-span-1 flex flex-col gap-1.5 relative ${isOpen ? 'z-50' : 'z-10'}`} ref={wrapperRef}>
      {label && <label className="block text-sm font-semibold text-slate-700">
        {label} {required && <span className="text-red-500">*</span>}
      </label>}
      <div
        className={`w-full h-[46px] px-4 rounded-lg border bg-white flex items-center justify-between cursor-pointer transition-all ${
            disabled ? 'bg-slate-50 cursor-not-allowed text-slate-400 border-slate-200' :
            error ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-300 hover:border-primary focus:ring-2 focus:ring-primary focus:border-primary'
        }`}
        onClick={() => !disabled && setIsOpen(!isOpen)}
      >
        <span className={`text-sm ${value ? 'text-slate-900 font-medium' : 'text-slate-400'}`}>
          {currentLabel || placeholder || 'Chọn...'}
        </span>
        <span className="material-symbols-outlined text-slate-400 text-[20px]">expand_more</span>
      </div>
      
      {isOpen && (
        <div className="absolute top-full left-0 mt-1 w-full bg-white border border-slate-200 rounded-lg shadow-2xl overflow-hidden flex flex-col animate-fade-in ring-1 ring-slate-900/5">
          <div className="p-2 border-b border-slate-100 bg-slate-50">
             <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 text-lg">search</span>
                <input
                  ref={inputRef}
                  type="text"
                  className="w-full pl-9 pr-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:border-primary focus:ring-1 focus:ring-primary bg-white text-slate-900 placeholder:text-slate-400 shadow-sm"
                  placeholder="Tìm kiếm..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  onClick={(e) => e.stopPropagation()}
                />
             </div>
          </div>
          <div className="overflow-y-auto max-h-60 p-1 custom-scrollbar">
            {filteredOptions.length > 0 ? (
              filteredOptions.map(opt => (
                <div
                  key={opt.value}
                  className={`px-3 py-2.5 text-sm rounded-md cursor-pointer transition-colors flex items-center justify-between ${value === opt.value ? 'bg-primary/10 text-primary font-semibold' : 'text-slate-700 hover:bg-slate-50'}`}
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                    setSearchTerm('');
                  }}
                >
                  <span>{opt.label}</span>
                  {value === opt.value && <span className="material-symbols-outlined text-sm">check</span>}
                </div>
              ))
            ) : (
              <div className="px-4 py-8 text-sm text-slate-400 text-center flex flex-col items-center gap-2">
                  <span className="material-symbols-outlined text-2xl">search_off</span>
                  <span>Không tìm thấy kết quả</span>
              </div>
            )}
          </div>
        </div>
      )}
       {error && <p className="text-xs text-red-500 mt-0.5 flex items-center gap-1 animate-fade-in"><span className="material-symbols-outlined text-[14px]">error</span>{error}</p>}
    </div>
  );
};

// --- Helper Components for Forms ---
const FormInput = ({ label, value, onChange, placeholder, disabled, required, error, type = 'text' }: any) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-sm font-semibold text-slate-700">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <input 
      type={type}
      value={value || ''}
      onChange={onChange}
      placeholder={placeholder} 
      disabled={disabled}
      className={`w-full h-11 px-4 rounded-lg border bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all placeholder:text-slate-400 ${disabled ? 'bg-slate-50 text-slate-500 border-slate-200 cursor-not-allowed' : error ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-300'}`}
    />
    {error && <p className="text-xs text-red-500 mt-0.5">{error}</p>}
  </div>
);

const FormSelect = ({ label, value, onChange, options, disabled, required }: any) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-sm font-semibold text-slate-700">
      {label} {required && <span className="text-red-500">*</span>}
    </label>
    <div className="relative">
      <select 
        value={value || ''}
        onChange={onChange}
        disabled={disabled}
        className="appearance-none w-full h-11 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all cursor-pointer disabled:bg-slate-50 disabled:cursor-not-allowed"
      >
        {options.map((opt: any) => (
          <option key={opt.value} value={opt.value}>{opt.label}</option>
        ))}
      </select>
      <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none text-slate-400">
        <span className="material-symbols-outlined">expand_more</span>
      </div>
    </div>
  </div>
);

const DeleteConfirmModal: React.FC<{ title: string; message: React.ReactNode; onClose: () => void; onConfirm: () => void }> = ({ title, message, onClose, onConfirm }) => (
  <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
    <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose}></div>
    <div className="relative bg-white w-full max-w-md rounded-xl shadow-2xl overflow-hidden animate-fade-in border border-slate-200">
      <div className="p-6">
        <div className="flex items-center gap-4 mb-4">
          <div className="w-12 h-12 rounded-full bg-red-100 flex items-center justify-center flex-shrink-0 text-red-600">
             <span className="material-symbols-outlined text-2xl">warning</span>
          </div>
          <div>
             <h3 className="text-lg font-bold text-slate-900">{title}</h3>
             <p className="text-sm text-slate-500 mt-1">Hành động này cần xác nhận.</p>
          </div>
        </div>
        <div className="text-slate-600 mb-6">{message}</div>
        <div className="flex justify-end gap-3">
          <button onClick={onClose} className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 font-medium">Hủy</button>
          <button onClick={onConfirm} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 font-medium shadow-lg shadow-red-600/20">Xóa</button>
        </div>
      </div>
    </div>
  </div>
);

export interface DepartmentFormModalProps {
  type: 'ADD' | 'EDIT';
  data?: Department | null;
  departments?: Department[];
  onClose: () => void;
  onSave: (data: Partial<Department>) => void;
  isLoading?: boolean;
}

export const DepartmentFormModal: React.FC<DepartmentFormModalProps> = ({ type, data, departments = [], onClose, onSave, isLoading }) => {
  const [formData, setFormData] = useState<Partial<Department>>({
    dept_code: data?.dept_code || '',
    dept_name: data?.dept_name || '',
    parent_id: data?.parent_id || '',
    status: data?.status || 'ACTIVE'
  });

  // Filter parent options to prevent selecting self or descendants
  const parentOptions = useMemo(() => {
    let options = departments;

    if (type === 'EDIT' && data) {
      // Helper to find all descendants
      const getDescendants = (parentId: string): string[] => {
        const children = departments.filter(d => d.parent_id === parentId);
        let descendants = children.map(c => c.dept_code);
        children.forEach(c => {
          descendants = [...descendants, ...getDescendants(c.dept_code)];
        });
        return descendants;
      };

      const descendants = getDescendants(data.dept_code);
      
      // Exclude self and descendants
      options = departments.filter(d => 
        d.dept_code !== data.dept_code && !descendants.includes(d.dept_code)
      );
    }

    return [
      { value: '', label: 'Chọn phòng ban cha' },
      ...options.map(d => ({ value: d.dept_code, label: d.dept_name }))
    ];
  }, [departments, type, data]);

  return (
    <ModalWrapper 
      onClose={onClose} 
      title={type === 'ADD' ? 'Thêm mới phòng ban' : 'Chỉnh sửa phòng ban'} 
      icon={type === 'ADD' ? 'domain_add' : 'edit_note'}
    >
      <div className="p-6 space-y-5 relative">
        {isLoading && (
          <div className="absolute inset-0 z-10 bg-white/80 flex flex-col items-center justify-center backdrop-blur-[1px]">
             <div className="w-12 h-12 border-4 border-slate-200 border-t-primary rounded-full animate-spin mb-3"></div>
             <p className="text-primary font-semibold text-sm animate-pulse">Đang lưu dữ liệu...</p>
          </div>
        )}

        <FormInput 
            label="Mã phòng ban" 
            value={formData.dept_code} 
            onChange={(e: any) => setFormData({...formData, dept_code: e.target.value})} 
            placeholder="Nhập mã phòng ban" 
            disabled={type === 'EDIT'} 
            required 
            error={type === 'ADD' && !formData.dept_code ? 'Mã phòng ban là bắt buộc' : ''}
        />
        <FormInput 
            label="Tên phòng ban" 
            value={formData.dept_name} 
            onChange={(e: any) => setFormData({...formData, dept_name: e.target.value})} 
            placeholder="Nhập tên phòng ban" 
            required 
        />
        <FormSelect 
            label="Phòng ban cha"
            value={formData.parent_id}
            onChange={(e: any) => setFormData({...formData, parent_id: e.target.value})}
            options={parentOptions}
        />

        <div className="flex items-center justify-between py-2">
          <div className="flex flex-col">
            <label className="text-sm font-semibold text-slate-700">Trạng thái hoạt động</label>
            <span className="text-xs text-slate-500">Kích hoạt để cho phép phòng ban hoạt động ngay</span>
          </div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              checked={formData.status === 'ACTIVE'}
              onChange={(e) => setFormData({...formData, status: e.target.checked ? 'ACTIVE' : 'INACTIVE'})}
              className="sr-only peer" 
            />
            <div className="w-11 h-6 bg-slate-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-primary/20 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:start-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-primary"></div>
          </label>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-50 border-t border-slate-100 flex-shrink-0">
        <button onClick={onClose} className="px-6 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-semibold text-sm hover:bg-slate-100 transition-colors">
          Hủy
        </button>
        <button 
          onClick={() => onSave(formData)}
          className="px-8 py-2.5 rounded-lg bg-primary text-white font-semibold text-sm hover:bg-primary/90 shadow-lg shadow-primary/20 transition-all flex items-center gap-2"
        >
          {isLoading ? 'Đang lưu...' : (type === 'ADD' ? 'Lưu' : 'Lưu thay đổi')}
        </button>
      </div>
    </ModalWrapper>
  );
};

export const ViewDepartmentModal: React.FC<{ data: Department; onClose: () => void; onEdit: () => void }> = ({ data, onClose, onEdit }) => {
  const parentName = MOCK_DEPARTMENTS.find(d => d.dept_code === data.parent_id)?.dept_name || data.parent_id || '---';
  
  return (
    <ModalWrapper onClose={onClose} title="Thông tin phòng ban" icon="apartment">
      <div className="p-6 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div><label className="text-xs text-slate-500 font-medium uppercase">Mã phòng ban</label><p className="font-mono font-medium text-slate-900">{data.dept_code}</p></div>
          <div><label className="text-xs text-slate-500 font-medium uppercase">Tên phòng ban</label><p className="font-medium text-slate-900">{data.dept_name}</p></div>
          <div><label className="text-xs text-slate-500 font-medium uppercase">Phòng ban cha</label><p className="text-slate-900">{parentName}</p></div>
          <div><label className="text-xs text-slate-500 font-medium uppercase">Trạng thái</label>
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-bold ${data.status === 'ACTIVE' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
              {data.status === 'ACTIVE' ? 'Hoạt động' : 'Ngừng hoạt động'}
            </span>
          </div>
          <div><label className="text-xs text-slate-500 font-medium uppercase">Số lượng nhân sự</label><p className="text-slate-900">{data.employeeCount || 0} nhân viên</p></div>
          <div><label className="text-xs text-slate-500 font-medium uppercase">Ngày tạo</label><p className="text-slate-900">{data.createdDate || '---'}</p></div>
        </div>
      </div>
      <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-50 border-t border-slate-100">
        <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-100">Đóng</button>
        <button onClick={() => { onClose(); onEdit(); }} className="px-4 py-2 rounded-lg bg-primary text-white font-medium hover:bg-deep-teal flex items-center gap-2"><span className="material-symbols-outlined text-lg">edit</span> Chỉnh sửa</button>
      </div>
    </ModalWrapper>
  );
};

export const DeleteWarningModal: React.FC<{ data: Department; onClose: () => void; onConfirm: () => void }> = ({ data, onClose, onConfirm }) => (
  <DeleteConfirmModal 
    title="Xóa phòng ban" 
    message={<p>Bạn có chắc chắn muốn xóa phòng ban <span className="font-bold text-slate-900">"{data.dept_name}"</span>? Hành động này không thể hoàn tác.</p>}
    onClose={onClose} 
    onConfirm={onConfirm} 
  />
);

export const CannotDeleteModal: React.FC<{ data: Department; onClose: () => void }> = ({ data, onClose }) => (
  <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
    <div className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm" onClick={onClose}></div>
    <div className="relative bg-white w-full max-w-md rounded-xl shadow-2xl p-6 animate-fade-in border-l-4 border-yellow-500">
       <div className="flex items-start gap-4">
          <span className="material-symbols-outlined text-3xl text-yellow-500">warning_amber</span>
          <div>
            <h3 className="text-lg font-bold text-slate-900">Không thể xóa phòng ban</h3>
            <p className="text-slate-600 mt-2">Phòng ban <span className="font-bold">"{data.dept_name}"</span> đang có <span className="font-bold text-slate-900">{data.employeeCount} nhân sự</span>. Vui lòng điều chuyển hết nhân sự trước khi xóa.</p>
          </div>
       </div>
       <div className="mt-6 flex justify-end">
          <button onClick={onClose} className="px-5 py-2 bg-slate-100 text-slate-700 rounded-lg hover:bg-slate-200 font-medium">Đã hiểu</button>
       </div>
    </div>
  </div>
);

export const ImportModal: React.FC<{ title: string; onClose: () => void; onSave: () => void }> = ({ title, onClose, onSave }) => (
  <ModalWrapper onClose={onClose} title={title} icon="upload_file" width="max-w-lg">
    <div className="p-6">
       <div className="border-2 border-dashed border-slate-300 rounded-xl p-8 flex flex-col items-center justify-center text-center hover:border-primary hover:bg-slate-50 transition-all cursor-pointer">
          <span className="material-symbols-outlined text-4xl text-slate-400 mb-2">cloud_upload</span>
          <p className="text-sm font-medium text-slate-900">Kéo thả file vào đây hoặc click để chọn file</p>
          <p className="text-xs text-slate-500 mt-1">Hỗ trợ định dạng .xlsx, .csv (Tối đa 5MB)</p>
          <input type="file" className="hidden" />
       </div>
       <div className="mt-4 flex items-center gap-2 text-sm text-slate-600 bg-blue-50 p-3 rounded-lg border border-blue-100">
          <span className="material-symbols-outlined text-blue-600">info</span>
          <p>Vui lòng tải file mẫu để đảm bảo định dạng dữ liệu đúng.</p>
       </div>
    </div>
    <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-50 border-t border-slate-100">
      <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-100">Hủy</button>
      <button onClick={onSave} className="px-4 py-2 rounded-lg bg-primary text-white font-medium hover:bg-deep-teal shadow-lg shadow-primary/20">Tải lên</button>
    </div>
  </ModalWrapper>
);

export const EmployeeFormModal: React.FC<{ type: 'ADD' | 'EDIT'; data?: Employee | null; onClose: () => void; onSave: (data: Partial<Employee>) => void }> = ({ type, data, onClose, onSave }) => {
  const [formData, setFormData] = useState<Partial<Employee>>({
    id: data?.id || '',
    name: data?.name || '',
    email: data?.email || '',
    dob: data?.dob || '',
    gender: data?.gender || 'Male',
    department: data?.department || '',
    type: data?.type || 'Official',
    position: data?.position || '',
    phone: data?.phone || '',
    status: data?.status || 'Active',
    ipAddress: data?.ipAddress || '',
    vpnStatus: data?.vpnStatus || 'Not_Granted'
  });

  return (
    <ModalWrapper onClose={onClose} title={type === 'ADD' ? 'Thêm mới nhân sự' : 'Cập nhật nhân sự'} icon="person_add" width="max-w-2xl">
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-5">
        <FormInput label="Mã nhân viên" value={formData.id} onChange={(e: any) => setFormData({...formData, id: e.target.value})} placeholder="NV001" disabled={type === 'EDIT'} required />
        <FormInput label="Họ và tên" value={formData.name} onChange={(e: any) => setFormData({...formData, name: e.target.value})} placeholder="Nguyễn Văn A" required />
        <FormInput label="Email" value={formData.email} onChange={(e: any) => setFormData({...formData, email: e.target.value})} placeholder="email@vnpt.vn" required />
        <FormInput label="Ngày sinh" type="date" value={formData.dob} onChange={(e: any) => setFormData({...formData, dob: e.target.value})} />
        <FormSelect label="Giới tính" value={formData.gender} onChange={(e: any) => setFormData({...formData, gender: e.target.value})} options={[{value: 'Male', label: 'Nam'}, {value: 'Female', label: 'Nữ'}, {value: 'Other', label: 'Khác'}]} />
        <FormInput label="Số điện thoại" value={formData.phone} onChange={(e: any) => setFormData({...formData, phone: e.target.value})} placeholder="09xxxxxxxx" />
        
        <div className="col-span-1 md:col-span-2 grid grid-cols-1 md:grid-cols-2 gap-5 pt-2 border-t border-slate-100">
           <FormSelect label="Phòng ban" value={formData.department} onChange={(e: any) => setFormData({...formData, department: e.target.value})} options={[{value: '', label: 'Chọn phòng ban'}, ...MOCK_DEPARTMENTS.map(d => ({ value: d.dept_name, label: d.dept_name }))]} required />
           <FormSelect label="Loại hình" value={formData.type} onChange={(e: any) => setFormData({...formData, type: e.target.value})} options={[{value: 'Official', label: 'Chính thức'}, {value: 'Collaborator', label: 'Cộng tác viên'}]} />
           <FormInput label="Chức danh" value={formData.position} onChange={(e: any) => setFormData({...formData, position: e.target.value})} placeholder="Chuyên viên" />
           <FormSelect label="Trạng thái" value={formData.status} onChange={(e: any) => setFormData({...formData, status: e.target.value})} options={[{value: 'Active', label: 'Đang làm việc'}, {value: 'Suspended', label: 'Tạm đình chỉ'}, {value: 'Quit', label: 'Đã nghỉ việc'}]} />
        </div>

        <div className="col-span-1 md:col-span-2 pt-2 border-t border-slate-100">
           <p className="text-sm font-bold text-slate-800 mb-3">Thông tin mạng & VPN</p>
           <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <FormInput label="Địa chỉ IP (nếu có)" value={formData.ipAddress} onChange={(e: any) => setFormData({...formData, ipAddress: e.target.value})} placeholder="192.168.x.x" />
              <FormSelect label="Quyền truy cập VPN" value={formData.vpnStatus} onChange={(e: any) => setFormData({...formData, vpnStatus: e.target.value})} options={[{value: 'Granted', label: 'Đã cấp'}, {value: 'Not_Granted', label: 'Chưa cấp'}]} />
           </div>
        </div>
      </div>
      <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-50 border-t border-slate-100">
        <button onClick={onClose} className="px-4 py-2 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-100">Hủy</button>
        <button onClick={() => onSave(formData)} className="px-6 py-2 rounded-lg bg-primary text-white font-medium hover:bg-deep-teal shadow-lg shadow-primary/20">{type === 'ADD' ? 'Lưu' : 'Cập nhật'}</button>
      </div>
    </ModalWrapper>
  );
};

export const DeleteEmployeeModal: React.FC<{ data: Employee; onClose: () => void; onConfirm: () => void }> = ({ data, onClose, onConfirm }) => (
  <DeleteConfirmModal 
     title="Xóa nhân sự" 
     message={<p>Bạn có chắc chắn muốn xóa nhân sự <span className="font-bold text-slate-900">"{data.name}"</span>? Dữ liệu này không thể khôi phục.</p>}
     onClose={onClose} 
     onConfirm={onConfirm} 
  />
);

export const BusinessFormModal: React.FC<{ type: 'ADD' | 'EDIT'; data?: Business | null; onClose: () => void; onSave: (data: Partial<Business>) => void }> = ({ type, data, onClose, onSave }) => {
  const [formData, setFormData] = useState<Partial<Business>>({
    domain_code: data?.domain_code || '',
    domain_name: data?.domain_name || ''
  });

  return (
    <ModalWrapper onClose={onClose} title={type === 'ADD' ? 'Thêm lĩnh vực kinh doanh' : 'Cập nhật lĩnh vực'} icon="category" width="max-w-md">
      <div className="p-6 space-y-4">
        <FormInput label="Mã lĩnh vực" value={formData.domain_code} onChange={(e: any) => setFormData({...formData, domain_code: e.target.value})} placeholder="KD001" disabled={type === 'EDIT'} required />
        <FormInput label="Tên lĩnh vực" value={formData.domain_name} onChange={(e: any) => setFormData({...formData, domain_name: e.target.value})} placeholder="Tên lĩnh vực" required />
      </div>
      <div className="flex justify-end gap-3 px-6 py-4 bg-slate-50 border-t border-slate-100">
        <button onClick={onClose} className="px-4 py-2 border border-slate-300 rounded-lg">Hủy</button>
        <button onClick={() => onSave(formData)} className="px-4 py-2 bg-primary text-white rounded-lg">Lưu</button>
      </div>
    </ModalWrapper>
  );
};

export const DeleteBusinessModal: React.FC<{ data: Business; onClose: () => void; onConfirm: () => void }> = ({ data, onClose, onConfirm }) => (
  <DeleteConfirmModal title="Xóa lĩnh vực" message={<p>Xóa lĩnh vực <span className="font-bold">"{data.domain_name}"</span>?</p>} onClose={onClose} onConfirm={onConfirm} />
);

export const VendorFormModal: React.FC<{ type: 'ADD' | 'EDIT'; data?: Vendor | null; onClose: () => void; onSave: (data: Partial<Vendor>) => void }> = ({ type, data, onClose, onSave }) => {
  const [formData, setFormData] = useState<Partial<Vendor>>({
    vendor_code: data?.vendor_code || '',
    vendor_name: data?.vendor_name || ''
  });

  return (
    <ModalWrapper onClose={onClose} title={type === 'ADD' ? 'Thêm đối tác' : 'Cập nhật đối tác'} icon="storefront" width="max-w-md">
      <div className="p-6 space-y-4">
        <FormInput label="Mã đối tác" value={formData.vendor_code} onChange={(e: any) => setFormData({...formData, vendor_code: e.target.value})} placeholder="DT001" disabled={type === 'EDIT'} required />
        <FormInput label="Tên đối tác" value={formData.vendor_name} onChange={(e: any) => setFormData({...formData, vendor_name: e.target.value})} placeholder="Tên đối tác" required />
      </div>
      <div className="flex justify-end gap-3 px-6 py-4 bg-slate-50 border-t border-slate-100">
        <button onClick={onClose} className="px-4 py-2 border border-slate-300 rounded-lg">Hủy</button>
        <button onClick={() => onSave(formData)} className="px-4 py-2 bg-primary text-white rounded-lg">Lưu</button>
      </div>
    </ModalWrapper>
  );
};

export const DeleteVendorModal: React.FC<{ data: Vendor; onClose: () => void; onConfirm: () => void }> = ({ data, onClose, onConfirm }) => (
  <DeleteConfirmModal title="Xóa đối tác" message={<p>Xóa đối tác <span className="font-bold">"{data.vendor_name}"</span>?</p>} onClose={onClose} onConfirm={onConfirm} />
);

export const ProductFormModal: React.FC<{ type: 'ADD' | 'EDIT'; data?: Product | null; businesses: Business[]; vendors: Vendor[]; onClose: () => void; onSave: (data: Partial<Product>) => void }> = ({ type, data, businesses, vendors, onClose, onSave }) => {
  const [formData, setFormData] = useState<Partial<Product>>({
    product_code: data?.product_code || '',
    product_name: data?.product_name || '',
    domain_id: data?.domain_id || '',
    vendor_id: data?.vendor_id || '',
    standard_price: data?.standard_price || 0,
    unit: data?.unit || 'Cái/Gói'
  });

  return (
    <ModalWrapper onClose={onClose} title={type === 'ADD' ? 'Thêm sản phẩm' : 'Cập nhật sản phẩm'} icon="inventory_2" width="max-w-lg">
      <div className="p-6 space-y-4">
        <FormInput label="Mã sản phẩm" value={formData.product_code} onChange={(e: any) => setFormData({...formData, product_code: e.target.value})} placeholder="SP001" disabled={type === 'EDIT'} required />
        <FormInput label="Tên sản phẩm" value={formData.product_name} onChange={(e: any) => setFormData({...formData, product_name: e.target.value})} placeholder="Tên sản phẩm" required />
        <FormInput label="Giá tiêu chuẩn (VNĐ)" type="number" value={formData.standard_price} onChange={(e: any) => setFormData({...formData, standard_price: Number(e.target.value)})} placeholder="0" />
        <FormInput label="Đơn vị tính" value={formData.unit} onChange={(e: any) => setFormData({...formData, unit: e.target.value})} placeholder="Cái/Gói" />
        <FormSelect label="Lĩnh vực kinh doanh" value={formData.domain_id} onChange={(e: any) => setFormData({...formData, domain_id: e.target.value})} options={[{value:'', label: 'Chọn lĩnh vực'}, ...businesses.map(b => ({value: String(b.id), label: b.domain_name}))]} required />
        <FormSelect label="Nhà cung cấp" value={formData.vendor_id} onChange={(e: any) => setFormData({...formData, vendor_id: e.target.value})} options={[{value:'', label: 'Chọn nhà cung cấp'}, ...vendors.map(v => ({value: String(v.id), label: v.vendor_name}))]} required />
      </div>
      <div className="flex justify-end gap-3 px-6 py-4 bg-slate-50 border-t border-slate-100">
        <button onClick={onClose} className="px-4 py-2 border border-slate-300 rounded-lg">Hủy</button>
        <button onClick={() => onSave(formData)} className="px-4 py-2 bg-primary text-white rounded-lg">Lưu</button>
      </div>
    </ModalWrapper>
  );
};

export const DeleteProductModal: React.FC<{ data: Product; onClose: () => void; onConfirm: () => void }> = ({ data, onClose, onConfirm }) => (
  <DeleteConfirmModal title="Xóa sản phẩm" message={<p>Xóa sản phẩm <span className="font-bold">"{data.product_name}"</span>?</p>} onClose={onClose} onConfirm={onConfirm} />
);

export const CustomerFormModal: React.FC<{ type: 'ADD' | 'EDIT'; data?: Customer | null; onClose: () => void; onSave: (data: Partial<Customer>) => void }> = ({ type, data, onClose, onSave }) => {
  const [formData, setFormData] = useState<Partial<Customer>>({
    customer_code: data?.customer_code || '',
    company_name: data?.company_name || '',
    tax_code: data?.tax_code || '',
    address: data?.address || ''
  });

  return (
    <ModalWrapper onClose={onClose} title={type === 'ADD' ? 'Thêm khách hàng' : 'Cập nhật khách hàng'} icon="domain" width="max-w-lg">
      <div className="p-6 space-y-4">
        <FormInput label="Mã khách hàng" value={formData.customer_code} onChange={(e: any) => setFormData({...formData, customer_code: e.target.value})} placeholder="KH001" disabled={type === 'EDIT'} required />
        <FormInput label="Tên công ty" value={formData.company_name} onChange={(e: any) => setFormData({...formData, company_name: e.target.value})} placeholder="Tên công ty" required />
        <FormInput label="Mã số thuế" value={formData.tax_code} onChange={(e: any) => setFormData({...formData, tax_code: e.target.value})} placeholder="010xxxxxx" required />
        <FormInput label="Địa chỉ" value={formData.address} onChange={(e: any) => setFormData({...formData, address: e.target.value})} placeholder="Địa chỉ công ty" />
      </div>
      <div className="flex justify-end gap-3 px-6 py-4 bg-slate-50 border-t border-slate-100">
        <button onClick={onClose} className="px-4 py-2 border border-slate-300 rounded-lg">Hủy</button>
        <button onClick={() => onSave(formData)} className="px-4 py-2 bg-primary text-white rounded-lg">Lưu</button>
      </div>
    </ModalWrapper>
  );
};

export const DeleteCustomerModal: React.FC<{ data: Customer; onClose: () => void; onConfirm: () => void }> = ({ data, onClose, onConfirm }) => (
  <DeleteConfirmModal title="Xóa khách hàng" message={<p>Xóa khách hàng <span className="font-bold">"{data.company_name}"</span>?</p>} onClose={onClose} onConfirm={onConfirm} />
);

export interface CusPersonnelFormModalProps {
  type: 'ADD' | 'EDIT';
  data?: CustomerPersonnel | null;
  customers: Customer[];
  onClose: () => void;
  onSave: (data: Partial<CustomerPersonnel>) => void;
}

export const CusPersonnelFormModal: React.FC<CusPersonnelFormModalProps> = ({ type, data, customers, onClose, onSave }) => {
  const [formData, setFormData] = useState<Partial<CustomerPersonnel>>({
    fullName: data?.fullName || '',
    birthday: data?.birthday || '',
    positionType: data?.positionType || 'DAU_MOI',
    phoneNumber: data?.phoneNumber || '',
    email: data?.email || '',
    customerId: data?.customerId || '',
    status: data?.status || 'Active',
  });
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.fullName) newErrors.fullName = 'Vui lòng nhập Họ và tên';
    if (!formData.customerId) newErrors.customerId = 'Vui lòng chọn Khách hàng';
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) newErrors.email = 'Email không hợp lệ';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) {
      onSave(formData);
    }
  };

  const handleChange = (field: keyof CustomerPersonnel, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: '' }));
    }
  };

  return (
    <ModalWrapper onClose={onClose} title={type === 'ADD' ? 'Thêm Nhân sự liên hệ' : 'Cập nhật Nhân sự liên hệ'} icon="contact_phone" width="max-w-3xl">
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
        
        <div className="col-span-1">
          <label className="block text-sm font-semibold text-slate-700 mb-2">Họ và tên <span className="text-red-500">*</span></label>
          <input 
            type="text" 
            value={formData.fullName}
            onChange={(e) => handleChange('fullName', e.target.value)}
            placeholder="Nhập họ và tên"
            className={`w-full h-11 px-4 rounded-lg border ${errors.fullName ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-300'} bg-white text-slate-900 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all`}
          />
          {errors.fullName && <p className="text-xs text-red-500 mt-1">{errors.fullName}</p>}
        </div>

        <div className="col-span-1">
          <label className="block text-sm font-semibold text-slate-700 mb-2">Ngày sinh</label>
          <input 
            type="date"
            className="w-full h-11 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
            value={formData.birthday || ''}
            onChange={(e) => handleChange('birthday', e.target.value)}
          />
        </div>

        <div className="col-span-1">
          <label className="block text-sm font-semibold text-slate-700 mb-2">Chức vụ</label>
          <select 
            className="w-full h-11 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all cursor-pointer"
            value={formData.positionType}
            onChange={(e) => handleChange('positionType', e.target.value as PositionType)}
          >
            {POSITION_TYPES.map(p => (
                <option key={p.value} value={p.value}>{p.label}</option>
            ))}
          </select>
        </div>

        <div className="col-span-1">
          <label className="block text-sm font-semibold text-slate-700 mb-2">Số điện thoại</label>
          <input 
            type="tel"
            className="w-full h-11 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
            placeholder="091xxxxxxx"
            value={formData.phoneNumber || ''}
            onChange={(e) => handleChange('phoneNumber', e.target.value)}
          />
        </div>

        <div className="col-span-1">
          <label className="block text-sm font-semibold text-slate-700 mb-2">Email</label>
          <input 
            type="email"
            className={`w-full h-11 px-4 rounded-lg border ${errors.email ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-300'} bg-white text-slate-900 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all`}
            placeholder="example@domain.com"
            value={formData.email || ''}
            onChange={(e) => handleChange('email', e.target.value)}
          />
          {errors.email && <p className="text-xs text-red-500 mt-1">{errors.email}</p>}
        </div>

        <div className="col-span-2 pb-24">
            <SearchableSelect 
                label="Khách hàng"
                required
                options={customers.map(c => ({ value: String(c.id), label: c.company_name }))}
                value={formData.customerId || ''}
                onChange={(val) => handleChange('customerId', val)}
                error={errors.customerId}
                placeholder="Chọn khách hàng"
            />
        </div>

      </div>
      <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 absolute bottom-0 left-0 right-0 z-[60]">
        <button onClick={onClose} className="px-5 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-100 transition-colors">Hủy</button>
        <button onClick={handleSubmit} className="px-6 py-2.5 rounded-lg bg-primary text-white font-bold hover:bg-deep-teal shadow-lg shadow-primary/20 transition-all flex items-center gap-2">
           <span className="material-symbols-outlined text-lg">check</span> {type === 'ADD' ? 'Lưu' : 'Cập nhật'}
        </button>
      </div>
    </ModalWrapper>
  );
};

export const DeleteCusPersonnelModal: React.FC<{ data: CustomerPersonnel; onClose: () => void; onConfirm: () => void }> = ({ data, onClose, onConfirm }) => (
  <DeleteConfirmModal 
     title="Xóa nhân sự liên hệ" 
     message={<p>Bạn có chắc chắn muốn xóa nhân sự <span className="font-bold text-slate-900">"{data.fullName}"</span>? Dữ liệu sẽ không thể khôi phục.</p>}
     onClose={onClose} 
     onConfirm={onConfirm}
  />
);

export interface OpportunityFormModalProps {
  type: 'ADD' | 'EDIT';
  data?: Opportunity | null;
  customers: Customer[];
  personnel: CustomerPersonnel[];
  products: Product[];
  employees: Employee[];
  onClose: () => void;
  onSave: (data: Partial<Opportunity>) => void;
}

export const OpportunityFormModal: React.FC<OpportunityFormModalProps> = ({ 
  type, data, customers, personnel, products, employees, onClose, onSave 
}) => {
  const [formData, setFormData] = useState<Partial<Opportunity>>({
    name: data?.name || '',
    customerId: data?.customerId || '',
    personnelId: data?.personnelId || '',
    productId: data?.productId || '',
    estimatedValue: data?.estimatedValue || 0,
    probability: data?.probability || 50,
    status: data?.status || 'TIEM_NANG',
    salesId: data?.salesId || '',
  });

  const [personnelOptions, setPersonnelOptions] = useState<{value: string, label: string}[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});

  useEffect(() => {
    // Filter personnel based on selected customer
    if (formData.customerId) {
       const filtered = (personnel || [])
         .filter(p => p.customerId === formData.customerId)
         .map(p => ({ value: p.id, label: p.fullName }));
       setPersonnelOptions(filtered);
       
       // Clear personnel selection if it doesn't belong to new customer
       if (formData.personnelId) {
          const isValid = filtered.some(p => p.value === formData.personnelId);
          if (!isValid) setFormData(prev => ({ ...prev, personnelId: '' }));
       }
    } else {
       setPersonnelOptions([]);
    }
  }, [formData.customerId, personnel]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.name) newErrors.name = 'Vui lòng nhập Tên cơ hội';
    if (!formData.customerId) newErrors.customerId = 'Vui lòng chọn Khách hàng';
    if (!formData.productId) newErrors.productId = 'Vui lòng chọn Sản phẩm';
    if (!formData.salesId) newErrors.salesId = 'Vui lòng chọn Sales phụ trách';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) {
      onSave(formData);
    }
  };

  const handleChange = (field: keyof Opportunity, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  return (
    <ModalWrapper onClose={onClose} title={type === 'ADD' ? 'Thêm Cơ hội kinh doanh' : 'Cập nhật Cơ hội'} icon="lightbulb" width="max-w-3xl">
      <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
        
        <div className="col-span-2">
           <label className="block text-sm font-semibold text-slate-700 mb-2">Tên cơ hội <span className="text-red-500">*</span></label>
           <input 
              type="text" 
              value={formData.name}
              onChange={(e) => handleChange('name', e.target.value)}
              placeholder="VD: Triển khai phần mềm quản lý cho..."
              className={`w-full h-11 px-4 rounded-lg border ${errors.name ? 'border-red-500 ring-1 ring-red-500' : 'border-slate-300'} bg-white text-slate-900 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all`}
           />
           {errors.name && <p className="text-xs text-red-500 mt-1">{errors.name}</p>}
        </div>

        <div className="col-span-1">
            <SearchableSelect 
                label="Khách hàng"
                required
                options={customers.map(c => ({ value: String(c.id), label: c.company_name }))}
                value={formData.customerId || ''}
                onChange={(val) => handleChange('customerId', val)}
                error={errors.customerId}
                placeholder="Chọn khách hàng"
            />
        </div>

        <div className="col-span-1">
            <SearchableSelect 
                label="Đầu mối liên hệ"
                options={personnelOptions}
                value={formData.personnelId || ''}
                onChange={(val) => handleChange('personnelId', val)}
                disabled={!formData.customerId}
                placeholder={!formData.customerId ? 'Vui lòng chọn KH trước' : 'Chọn đầu mối'}
            />
        </div>

        <div className="col-span-1">
           <SearchableSelect 
               label="Sản phẩm chính"
               required
               options={products.map(p => ({ value: String(p.id), label: p.product_name }))}
               value={formData.productId || ''}
               onChange={(val) => handleChange('productId', val)}
               error={errors.productId}
           />
        </div>

        <div className="col-span-1">
           <SearchableSelect 
               label="Sales phụ trách"
               required
               options={employees.map(e => ({ value: e.id, label: e.name }))}
               value={formData.salesId || ''}
               onChange={(val) => handleChange('salesId', val)}
               error={errors.salesId}
           />
        </div>

        <div className="col-span-1">
           <label className="block text-sm font-semibold text-slate-700 mb-2">Giá trị dự kiến (VNĐ)</label>
           <input 
              type="number" 
              value={formData.estimatedValue}
              onChange={(e) => handleChange('estimatedValue', Number(e.target.value))}
              className="w-full h-11 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all"
           />
        </div>

        <div className="col-span-1">
           <label className="block text-sm font-semibold text-slate-700 mb-2">Khả năng thành công (%)</label>
           <div className="flex items-center gap-3">
              <input 
                 type="range" 
                 min="0" max="100" 
                 value={formData.probability} 
                 onChange={(e) => handleChange('probability', Number(e.target.value))}
                 className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-primary"
              />
              <span className="text-sm font-bold text-slate-700 w-12 text-right">{formData.probability}%</span>
           </div>
        </div>

        <div className="col-span-1">
          <label className="block text-sm font-semibold text-slate-700 mb-2">Trạng thái</label>
          <select 
            className="w-full h-11 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all cursor-pointer"
            value={formData.status}
            onChange={(e) => handleChange('status', e.target.value as OpportunityStatus)}
          >
            {OPPORTUNITY_STATUSES.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
            ))}
          </select>
        </div>

        <div className="col-span-2 pb-20"></div>

      </div>
      <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 absolute bottom-0 left-0 right-0 z-[60]">
        <button onClick={onClose} className="px-5 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-100 transition-colors">Hủy</button>
        <button onClick={handleSubmit} className="px-6 py-2.5 rounded-lg bg-primary text-white font-bold hover:bg-deep-teal shadow-lg shadow-primary/20 transition-all flex items-center gap-2">
           <span className="material-symbols-outlined text-lg">check</span> {type === 'ADD' ? 'Lưu' : 'Cập nhật'}
        </button>
      </div>
    </ModalWrapper>
  );
};

export const DeleteOpportunityModal: React.FC<{ data: Opportunity; onClose: () => void; onConfirm: () => void }> = ({ data, onClose, onConfirm }) => (
  <DeleteConfirmModal 
     title="Xóa Cơ hội" 
     message={<p>Bạn có chắc chắn muốn xóa cơ hội <span className="font-bold text-slate-900">"{data.name}"</span>? Dữ liệu sẽ không thể khôi phục.</p>}
     onClose={onClose} 
     onConfirm={onConfirm}
  />
);

// --- Project Modals ---

interface ProjectFormModalProps {
  type: 'ADD' | 'EDIT';
  data?: Project | null;
  customers: Customer[];
  opportunities: Opportunity[];
  products: Product[];
  employees: Employee[];
  departments: Department[];
  onClose: () => void;
  onSave: (data: Partial<Project>) => void;
}

export const ProjectFormModal: React.FC<ProjectFormModalProps> = ({ 
  type, data, customers, opportunities, products, employees, departments, onClose, onSave 
}) => {
  const [formData, setFormData] = useState<Partial<Project>>({
    project_code: data?.project_code || '',
    project_name: data?.project_name || '',
    customer_id: data?.customer_id || '',
    opportunity_id: data?.opportunity_id || '',
    investment_mode: data?.investment_mode || 'DAU_TU',
    start_date: data?.start_date || '',
    expected_end_date: data?.expected_end_date || '',
    actual_end_date: data?.actual_end_date || '',
    status: data?.status || 'ACTIVE',
    items: data?.items || [],
    raci: data?.raci || []
  });
  
  const [activeTab, setActiveTab] = useState<'info' | 'items' | 'raci'>('info');
  const [errors, setErrors] = useState<Record<string, string>>({});

  // Helper to get name
  const getCustomerName = (id: string) => customers.find(c => String(c.id) === id)?.company_name || id;
  const getOpportunityName = (id: string) => opportunities.find(o => o.id === id)?.name || id;

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.project_code) newErrors.project_code = 'Mã dự án là bắt buộc';
    if (!formData.project_name) newErrors.project_name = 'Tên dự án là bắt buộc';
    if (!formData.start_date) newErrors.start_date = 'Ngày bắt đầu là bắt buộc';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) {
      onSave(formData);
    }
  };

  const handleChange = (field: keyof Project, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  // --- Helpers for Formatting ---
  const formatNumber = (num: number | string | undefined | null) => {
    if (num === undefined || num === null || num === '') return '';
    if (typeof num === 'string') return num; // Return raw string if typing
    // Use Intl for correct formatting (VN: dots for thousands, comma for decimal)
    return new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(num);
  };

  const parseNumber = (str: string | number) => {
    if (typeof str === 'number') return str;
    // Remove dots (thousands), replace comma with dot (decimal)
    const normalized = str.replace(/\./g, '').replace(/,/g, '.');
    return parseFloat(normalized) || 0;
  };

  const formatCurrency = (value: number) => {
    return new Intl.NumberFormat('vi-VN', { style: 'currency', currency: 'VND' }).format(value);
  };

  // --- Project Item Handlers ---
  const handleAddItem = () => {
    const newItem: ProjectItem = {
        id: `ITEM_${Date.now()}`,
        productId: '',
        quantity: 1,
        unitPrice: 0,
        discountPercent: 0,
        discountAmount: 0,
        lineTotal: 0,
        discountMode: undefined
    };
    setFormData(prev => ({ ...prev, items: [...(prev.items || []), newItem] }));
  };

  const handleUpdateItem = (itemId: string, field: keyof ProjectItem, value: any) => {
    setFormData(prev => {
        const newItems = prev.items?.map(item => {
            if (item.id !== itemId) return item;
            
            const updatedItem = { ...item, [field]: value };
            
            // Auto update unit price if product changed
            if (field === 'productId') {
               const product = products.find(p => p.id === value);
               if (product) {
                   updatedItem.unitPrice = product.standard_price;
                   updatedItem.discountPercent = 0;
                   updatedItem.discountAmount = 0;
                   updatedItem.discountMode = undefined;
               }
            }

            // Logic: Calculate derived fields
            const baseTotal = updatedItem.quantity * updatedItem.unitPrice;

            if (field === 'discountPercent') {
                const rawValue = value.toString();
                
                // Allow empty
                if (rawValue === '') {
                    updatedItem.discountPercent = '';
                    updatedItem.discountAmount = 0;
                    updatedItem.discountMode = undefined;
                } else {
                    // Regex: digits, optional comma/dot, max 2 decimals
                    // Allow "5," or "5." during typing
                    if (!/^\d*([.,]\d{0,2})?$/.test(rawValue)) return item; // Reject invalid input

                    const parsed = parseFloat(rawValue.replace(',', '.'));
                    
                    // Immediate Clamp: Max 100%
                    if (parsed > 100) {
                        updatedItem.discountPercent = 100;
                        updatedItem.discountAmount = baseTotal;
                    } else {
                        updatedItem.discountPercent = rawValue; // Keep raw string for input
                        updatedItem.discountAmount = Math.round(baseTotal * (parsed / 100));
                    }
                    
                    if (parsed > 0) updatedItem.discountMode = 'PERCENT';
                    else updatedItem.discountMode = undefined;
                }

            } else if (field === 'discountAmount') {
                const rawValue = value.toString();
                
                // Allow empty
                if (rawValue === '') {
                    updatedItem.discountAmount = '';
                    updatedItem.discountPercent = 0;
                    updatedItem.discountMode = undefined;
                } else {
                    // Regex: digits, dots (thousands), optional comma/dot (decimal)
                    // Allow "1.000," during typing
                    if (!/^[\d.]*([.,]\d{0,2})?$/.test(rawValue)) return item; // Reject invalid input

                    const parsed = parseNumber(rawValue);
                    
                    // Immediate Clamp: Max Base Total
                    if (parsed > baseTotal) {
                        updatedItem.discountAmount = baseTotal;
                        updatedItem.discountPercent = 100;
                    } else {
                        updatedItem.discountAmount = rawValue; // Keep raw string
                        if (baseTotal > 0) {
                            updatedItem.discountPercent = parseFloat(((parsed / baseTotal) * 100).toFixed(2));
                        } else {
                            updatedItem.discountPercent = 0;
                        }
                    }

                    if (parsed > 0) updatedItem.discountMode = 'AMOUNT';
                    else updatedItem.discountMode = undefined;
                }

            } else if (field === 'quantity' || field === 'unitPrice') {
                // Recalculate derived based on mode
                const currentAmount = parseNumber(updatedItem.discountAmount);
                const currentPercent = parseNumber(updatedItem.discountPercent);

                if (updatedItem.discountMode === 'AMOUNT') {
                     // Check if amount exceeds new baseTotal
                     if (currentAmount > baseTotal) {
                         updatedItem.discountAmount = baseTotal;
                         updatedItem.discountPercent = 100;
                     } else {
                         // Keep amount constant, update percent
                         if (baseTotal > 0) {
                            updatedItem.discountPercent = parseFloat(((currentAmount / baseTotal) * 100).toFixed(2));
                         } else {
                            updatedItem.discountPercent = 0;
                         }
                     }
                } else {
                     // Default or PERCENT mode: Keep percent constant, update amount
                     updatedItem.discountAmount = Math.round(baseTotal * (currentPercent / 100));
                }
            }

            // Recalculate line total
            const finalAmount = parseNumber(updatedItem.discountAmount);
            updatedItem.lineTotal = baseTotal - finalAmount;
            
            return updatedItem;
        }) || [];
        return { ...prev, items: newItems };
    });
  };

  const handleItemBlur = (itemId: string, field: keyof ProjectItem) => {
      setFormData(prev => {
        const newItems = prev.items?.map(item => {
            if (item.id !== itemId) return item;
            
            const updatedItem = { ...item };
            const baseTotal = updatedItem.quantity * updatedItem.unitPrice;

            if (field === 'discountPercent') {
                 let val = updatedItem.discountPercent;
                 let parsed = typeof val === 'string' ? parseFloat(val.replace(',', '.')) : val;
                 if (isNaN(parsed)) parsed = 0;

                 // Safety clamp
                 if (parsed > 100) {
                    parsed = 100;
                 }
                 
                 // Warning Threshold > 50%
                 if (parsed > 50) {
                    if (!window.confirm("Cảnh báo: Tỷ lệ chiết khấu lớn hơn 50%. Bạn có chắc chắn muốn áp dụng?")) {
                        parsed = 0;
                        updatedItem.discountMode = undefined;
                    }
                 }
                 
                 updatedItem.discountPercent = parsed; // Commit to number
                 updatedItem.discountAmount = Math.round(baseTotal * (parsed / 100));
            
            } else if (field === 'discountAmount') {
                let val = updatedItem.discountAmount;
                let parsed = parseNumber(val);
                
                // Safety clamp
                if (parsed > baseTotal) {
                    parsed = baseTotal;
                }
                
                // Warning Threshold > 50% of Total
                if (parsed > baseTotal * 0.5) {
                    if (!window.confirm("Cảnh báo: Số tiền giảm giá lớn hơn 50% thành tiền. Bạn có chắc chắn muốn áp dụng?")) {
                        parsed = 0;
                        updatedItem.discountMode = undefined;
                    }
                }
                
                updatedItem.discountAmount = parsed; // Commit to number
                if (baseTotal > 0) {
                    updatedItem.discountPercent = parseFloat(((parsed / baseTotal) * 100).toFixed(2));
                } else {
                    updatedItem.discountPercent = 0;
                }
            }

            // Final Recalculate
            const finalAmount = typeof updatedItem.discountAmount === 'number' ? updatedItem.discountAmount : parseNumber(updatedItem.discountAmount);
            updatedItem.lineTotal = baseTotal - finalAmount;
            
            return updatedItem;
        }) || [];
        return { ...prev, items: newItems };
    });
  };

  const handleRemoveItem = (itemId: string) => {
    setFormData(prev => ({
        ...prev,
        items: prev.items?.filter(item => item.id !== itemId)
    }));
  };

  // --- RACI Management ---
  const handleAddRACI = () => {
    const newRACI: ProjectRACI = {
        id: `RACI_${Date.now()}`,
        userId: '',
        roleType: 'R',
        assignedDate: new Date().toLocaleDateString('vi-VN')
    };
    setFormData(prev => ({ ...prev, raci: [...(prev.raci || []), newRACI] }));
  };

  const handleUpdateRACI = (raciId: string, field: keyof ProjectRACI, value: any) => {
    const currentRACI = formData.raci?.find(r => r.id === raciId);
    if (!currentRACI) return;

    // Validation Logic: Unique (userId, roleType)
    const nextUserId = field === 'userId' ? value : currentRACI.userId;
    const nextRoleType = field === 'roleType' ? value : currentRACI.roleType;

    if (nextUserId && nextRoleType) {
        const duplicate = formData.raci?.find(r => 
            r.id !== raciId && 
            r.userId === nextUserId && 
            r.roleType === nextRoleType
        );

        if (duplicate) {
            const roleLabel = RACI_ROLES.find(role => role.value === nextRoleType)?.label || nextRoleType;
            alert(`Nhân sự này đã được phân công vai trò [${roleLabel}] trong dự án. Vui lòng chọn vai trò khác!`);
            return;
        }
    }

    setFormData(prev => ({
        ...prev,
        raci: prev.raci?.map(r => r.id === raciId ? { ...r, [field]: value } : r)
    }));
  };

  const handleRemoveRACI = (raciId: string) => {
    setFormData(prev => ({
        ...prev,
        raci: prev.raci?.filter(r => r.id !== raciId)
    }));
  };

  return (
    <ModalWrapper onClose={onClose} title={type === 'ADD' ? 'Thêm mới Dự án' : 'Cập nhật Dự án'} icon="topic" width="max-w-6xl">
      
      {/* Tabs */}
      <div className="flex border-b border-slate-200">
         <button 
            className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'info' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            onClick={() => setActiveTab('info')}
         >
            Thông tin chung
         </button>
         <button 
            className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'items' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            onClick={() => setActiveTab('items')}
         >
            Hạng mục dự án ({formData.items?.length || 0})
         </button>
         <button 
            className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors ${activeTab === 'raci' ? 'border-primary text-primary' : 'border-transparent text-slate-500 hover:text-slate-700'}`}
            onClick={() => setActiveTab('raci')}
         >
            Đội ngũ dự án ({formData.raci?.length || 0})
         </button>
      </div>

      <div className="p-6">
        {activeTab === 'info' ? (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-8 gap-y-6">
                <FormInput 
                    label="Mã dự án" 
                    value={formData.project_code} 
                    onChange={(e: any) => handleChange('project_code', e.target.value)} 
                    placeholder="DA001" 
                    disabled={type === 'EDIT'} 
                    required 
                    error={errors.project_code}
                />
                
                <FormInput 
                    label="Tên dự án" 
                    value={formData.project_name} 
                    onChange={(e: any) => handleChange('project_name', e.target.value)} 
                    placeholder="Dự án triển khai..." 
                    required 
                    error={errors.project_name}
                />

                <div className="col-span-1">
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Khách hàng</label>
                    {formData.opportunity_id ? (
                        <div className="w-full h-11 px-4 rounded-lg border border-slate-200 bg-slate-50 text-slate-600 flex items-center">
                            {getCustomerName(String(formData.customer_id || ''))}
                        </div>
                    ) : (
                        <select 
                            className="w-full h-11 px-4 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary focus:border-primary outline-none transition-all cursor-pointer"
                            value={formData.customer_id}
                            onChange={(e) => handleChange('customer_id', e.target.value)}
                        >
                            <option value="">Chọn khách hàng...</option>
                            {customers.map(c => <option key={c.customer_code} value={c.id}>{c.company_name}</option>)}
                        </select>
                    )}
                </div>

                <div className="col-span-1">
                    <label className="block text-sm font-semibold text-slate-700 mb-2">Cơ hội liên kết</label>
                    <div className="w-full h-11 px-4 rounded-lg border border-slate-200 bg-slate-50 text-slate-600 flex items-center truncate">
                        <span className="truncate">{formData.opportunity_id ? getOpportunityName(String(formData.opportunity_id)) : '---'}</span>
                    </div>
                </div>

                <FormSelect 
                    label="Hình thức đầu tư" 
                    value={formData.investment_mode} 
                    onChange={(e: any) => handleChange('investment_mode', e.target.value)} 
                    options={INVESTMENT_MODES} 
                />

                <FormSelect 
                    label="Trạng thái" 
                    value={formData.status} 
                    onChange={(e: any) => handleChange('status', e.target.value)} 
                    options={PROJECT_STATUSES} 
                />

                <FormInput 
                    label="Ngày bắt đầu" 
                    type="date"
                    value={formData.start_date} 
                    onChange={(e: any) => handleChange('start_date', e.target.value)} 
                    required
                    error={errors.start_date}
                />

                <FormInput 
                    label="Ngày kết thúc dự kiến" 
                    type="date"
                    value={formData.expected_end_date} 
                    onChange={(e: any) => handleChange('expected_end_date', e.target.value)} 
                />

                <FormInput 
                    label="Ngày kết thúc thực tế" 
                    type="date"
                    value={formData.actual_end_date} 
                    onChange={(e: any) => handleChange('actual_end_date', e.target.value)} 
                />
            </div>
        ) : activeTab === 'items' ? (
            <div className="space-y-4">
                <div className="flex justify-between items-center mb-2">
                    <h3 className="text-sm font-bold text-slate-700">Danh sách sản phẩm/dịch vụ</h3>
                    <button onClick={handleAddItem} className="text-xs flex items-center gap-1 bg-blue-50 text-blue-600 px-3 py-1.5 rounded-md hover:bg-blue-100 font-medium">
                        <span className="material-symbols-outlined text-sm">add</span> Thêm hạng mục
                    </button>
                </div>
                
                <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50 p-4">
                    <table className="w-full text-left bg-white rounded-lg shadow-sm overflow-hidden">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-3 py-3 text-xs font-bold text-slate-500 uppercase w-3/12">Sản phẩm</th>
                                <th className="px-2 py-3 text-xs font-bold text-slate-500 uppercase w-1/12 text-center">SL</th>
                                <th className="px-3 py-3 text-xs font-bold text-slate-500 uppercase w-2/12 text-right">Đơn giá</th>
                                <th className="px-3 py-3 text-xs font-bold text-slate-500 uppercase w-1/12 text-right">% CK</th>
                                <th className="px-3 py-3 text-xs font-bold text-slate-500 uppercase w-2/12 text-right">Giảm giá</th>
                                <th className="px-3 py-3 text-xs font-bold text-slate-500 uppercase w-2/12 text-right">Thành tiền</th>
                                <th className="px-2 py-3 text-xs font-bold text-slate-500 uppercase w-1/12 text-center">Xóa</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {formData.items && formData.items.length > 0 ? (
                                formData.items.map((item) => (
                                    <tr key={item.id} className="hover:bg-slate-50">
                                        <td className="p-2">
                                            <select 
                                                className="w-full text-sm border border-slate-300 rounded-md focus:ring-primary focus:border-primary py-1.5 bg-white text-slate-900 shadow-sm"
                                                value={item.productId}
                                                onChange={(e) => handleUpdateItem(item.id, 'productId', e.target.value)}
                                            >
                                                <option value="">Chọn sản phẩm</option>
                                                {products.map(p => (
                                                    <option key={p.product_code} value={p.id}>{p.product_name}</option>
                                                ))}
                                            </select>
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
                                            <input 
                                                type="text" 
                                                disabled={item.discountMode === 'PERCENT'}
                                                className={`w-full text-sm border border-slate-300 rounded-md text-right focus:ring-primary focus:border-primary py-1.5 shadow-sm pr-4 ${item.discountMode === 'PERCENT' ? 'bg-slate-100 text-slate-500 cursor-not-allowed' : 'bg-white text-slate-900'}`}
                                                value={formatNumber(item.discountAmount)}
                                                onChange={(e) => handleUpdateItem(item.id, 'discountAmount', e.target.value)}
                                                onBlur={() => handleItemBlur(item.id, 'discountAmount')}
                                                placeholder="0"
                                            />
                                        </td>
                                        <td className="p-2 text-right text-sm font-bold text-slate-900">
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
                                ))
                            ) : (
                                <tr>
                                    <td colSpan={7} className="px-4 py-8 text-center text-slate-400 text-sm">Chưa có hạng mục nào.</td>
                                </tr>
                            )}
                        </tbody>
                        {formData.items && formData.items.length > 0 && (
                            <tfoot className="bg-slate-50 border-t border-slate-200">
                                <tr>
                                    <td colSpan={4} className="px-4 py-3 text-sm font-bold text-slate-700 text-right">Tổng giảm giá:</td>
                                    <td className="px-4 py-3 text-sm font-bold text-red-600 text-right">
                                        {formatCurrency(formData.items.reduce((sum, item) => sum + (item.discountAmount || 0), 0))}
                                    </td>
                                    <td className="px-4 py-3 text-sm font-bold text-primary text-right">
                                        {formatCurrency(formData.items.reduce((sum, item) => sum + (item.lineTotal || 0), 0))}
                                    </td>
                                    <td></td>
                                </tr>
                            </tfoot>
                        )}
                    </table>
                </div>
            </div>
        ) : (
            <div className="space-y-4">
                <div className="flex justify-between items-center mb-2">
                    <h3 className="text-sm font-bold text-slate-700">Đội ngũ dự án (RACI)</h3>
                    <button onClick={handleAddRACI} className="text-xs flex items-center gap-1 bg-purple-50 text-purple-600 px-3 py-1.5 rounded-md hover:bg-purple-100 font-medium">
                        <span className="material-symbols-outlined text-sm">person_add</span> Thêm nhân sự
                    </button>
                </div>

                <div className="border border-slate-200 rounded-lg overflow-hidden bg-slate-50 p-4">
                    <table className="w-full text-left bg-white rounded-lg shadow-sm overflow-hidden">
                        <thead className="bg-slate-50 border-b border-slate-200">
                            <tr>
                                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Nhân sự</th>
                                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Phòng ban</th>
                                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase w-48">Vai trò</th>
                                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase w-32">Ngày phân công</th>
                                <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase w-20 text-center">Thao tác</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-200">
                            {formData.raci && formData.raci.length > 0 ? (
                                formData.raci.map((r) => {
                                    const employee = employees.find(e => e.id === r.userId);
                                    const deptName = departments.find(d => d.id === employee?.department)?.name || employee?.department || '---';
                                    
                                    return (
                                        <tr key={r.id} className="hover:bg-slate-50">
                                            <td className="p-2">
                                                <select 
                                                    className="w-full text-sm border border-slate-300 rounded-md focus:ring-primary focus:border-primary py-1.5 bg-white text-slate-900 shadow-sm"
                                                    value={r.userId}
                                                    onChange={(e) => handleUpdateRACI(r.id, 'userId', e.target.value)}
                                                >
                                                    <option value="">Chọn nhân viên</option>
                                                    {employees.map(e => (
                                                        <option key={e.id} value={e.id}>{e.name} ({e.id})</option>
                                                    ))}
                                                </select>
                                            </td>
                                            <td className="px-4 py-2 text-sm text-slate-600">
                                                {deptName}
                                            </td>
                                            <td className="p-2">
                                                <div className="flex items-center gap-2">
                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs flex-shrink-0 ${RACI_ROLES.find(role => role.value === r.roleType)?.color || 'bg-slate-100 text-slate-700'}`}>
                                                        {r.roleType}
                                                    </div>
                                                    <select 
                                                        className="flex-1 text-sm border border-slate-300 rounded-md focus:ring-primary focus:border-primary py-1.5 bg-white text-slate-900 shadow-sm"
                                                        value={r.roleType}
                                                        onChange={(e) => handleUpdateRACI(r.id, 'roleType', e.target.value)}
                                                    >
                                                        {RACI_ROLES.map(role => (
                                                            <option key={role.value} value={role.value}>{role.label}</option>
                                                        ))}
                                                    </select>
                                                </div>
                                            </td>
                                            <td className="p-2">
                                                <input 
                                                    type="text"
                                                    className="w-full text-sm border border-slate-300 rounded-md focus:ring-primary focus:border-primary py-1.5 bg-white text-slate-900 shadow-sm px-2"
                                                    value={r.assignedDate}
                                                    onChange={(e) => handleUpdateRACI(r.id, 'assignedDate', e.target.value)}
                                                />
                                            </td>
                                            <td className="p-2 text-center">
                                                <button 
                                                    onClick={() => handleRemoveRACI(r.id)}
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
                                    <td colSpan={5} className="px-4 py-8 text-center text-slate-400 text-sm">Chưa có nhân sự nào được phân công.</td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>
        )}
        
        {/* Spacer for footer */}
        <div className="pb-16"></div>
      </div>

      <div className="px-6 py-4 bg-slate-50 border-t border-slate-100 flex justify-end gap-3 absolute bottom-0 left-0 right-0 z-[60]">
        <button onClick={onClose} className="px-5 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-100 transition-colors">Hủy</button>
        <button onClick={handleSubmit} className="px-6 py-2.5 rounded-lg bg-primary text-white font-bold hover:bg-deep-teal shadow-lg shadow-primary/20 transition-all flex items-center gap-2">
           <span className="material-symbols-outlined text-lg">check</span> {type === 'ADD' ? 'Lưu' : 'Cập nhật'}
        </button>
      </div>
    </ModalWrapper>
  );
};

export const DeleteProjectModal: React.FC<{ data: Project; onClose: () => void; onConfirm: () => void }> = ({ data, onClose, onConfirm }) => (
  <DeleteConfirmModal 
     title="Xóa Dự án" 
     message={<p>Bạn có chắc chắn muốn xóa dự án <span className="font-bold text-slate-900">"{data.project_name}"</span>? Dữ liệu sẽ không thể khôi phục.</p>}
     onClose={onClose} 
     onConfirm={onConfirm}
  />
);

// --- Contract Modals ---

interface ContractFormModalProps {
  type: 'ADD' | 'EDIT';
  data?: Contract | null;
  projects: Project[];
  onClose: () => void;
  onSave: (data: Partial<Contract>) => void;
}

export const ContractFormModal: React.FC<ContractFormModalProps> = ({ 
  type, data, projects, onClose, onSave 
}) => {
  const [formData, setFormData] = useState<Partial<Contract>>({
    contract_number: data?.contract_number || '',
    project_id: data?.project_id || '',
    sign_date: data?.sign_date || '',
    total_value: data?.total_value || 0,
    status: data?.status || 'DRAFT'
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Formatting helpers
  const formatNumber = (num: number | string | undefined | null) => {
    if (num === undefined || num === null || num === '') return '';
    if (typeof num === 'string') return num; 
    return new Intl.NumberFormat('vi-VN').format(num);
  };

  const parseNumber = (str: string | number) => {
    if (typeof str === 'number') return str;
    const normalized = str.replace(/\./g, '').replace(/,/g, '.');
    return parseFloat(normalized) || 0;
  };

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.contract_number) newErrors.contract_number = 'Số hợp đồng là bắt buộc';
    if (!formData.project_id) newErrors.project_id = 'Vui lòng chọn Dự án';
    if (!formData.sign_date) newErrors.sign_date = 'Ngày ký là bắt buộc';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) {
      // Ensure totalValue is a number before saving
      const finalData = {
        ...formData,
        total_value: typeof formData.total_value === 'string' ? parseNumber(formData.total_value) : formData.total_value
      };
      onSave(finalData);
    }
  };

  const handleChange = (field: keyof Contract, value: any) => {
    setFormData(prev => {
        const updated = { ...prev, [field]: value };
        
        // Logic thông minh: Khi chọn Dự án, tự động tính tổng line_total
        if (field === 'project_id') {
            const project = projects.find(p => p.id === value);
            if (project) {
                const total = project.items.reduce((sum, item) => sum + (item.lineTotal || 0), 0);
                updated.total_value = total;
            }
        }
        
        return updated;
    });
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  return (
    <ModalWrapper onClose={onClose} title={type === 'ADD' ? 'Thêm mới Hợp đồng' : 'Cập nhật Hợp đồng'} icon="description" width="max-w-lg">
      <div className="p-6 space-y-5">
        <FormInput 
            label="Số hợp đồng" 
            value={formData.contract_number} 
            onChange={(e: any) => handleChange('contract_number', e.target.value)} 
            placeholder="HD-2024-001" 
            required 
            error={errors.contract_number}
        />

        <div className="col-span-1">
            <SearchableSelect 
                label="Dự án liên kết"
                required
                options={projects.map(p => ({ value: String(p.id), label: p.project_name }))}
                value={formData.project_id || ''}
                onChange={(val) => handleChange('project_id', val)}
                error={errors.project_id}
                placeholder="Chọn dự án"
            />
        </div>

        <FormInput 
            label="Ngày ký" 
            type="date"
            value={formData.sign_date} 
            onChange={(e: any) => handleChange('sign_date', e.target.value)} 
            required
            error={errors.sign_date}
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-slate-700">
            Tổng giá trị (VNĐ)
          </label>
          <div className="relative">
            <input 
              type="text"
              value={formatNumber(formData.total_value)} 
              onChange={(e) => handleChange('total_value', e.target.value)} 
              onBlur={() => {
                const parsed = parseNumber(formData.total_value as any);
                setFormData(prev => ({ ...prev, total_value: parsed }));
              }}
              placeholder="0"
              className="w-full h-11 pl-4 pr-10 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all font-bold"
            />
            <div className="absolute inset-y-0 right-0 flex items-center pr-4 pointer-events-none text-slate-400 font-bold">
              ₫
            </div>
          </div>
        </div>

        <FormSelect 
            label="Trạng thái" 
            value={formData.status} 
            onChange={(e: any) => handleChange('status', e.target.value)} 
            options={CONTRACT_STATUSES} 
        />
      </div>

      <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-50 border-t border-slate-100">
        <button onClick={onClose} className="px-5 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-100 transition-colors">Hủy</button>
        <button onClick={handleSubmit} className="px-6 py-2.5 rounded-lg bg-primary text-white font-bold hover:bg-deep-teal shadow-lg shadow-primary/20 transition-all flex items-center gap-2">
           <span className="material-symbols-outlined text-lg">check</span> {type === 'ADD' ? 'Lưu' : 'Cập nhật'}
        </button>
      </div>
    </ModalWrapper>
  );
};

export const DeleteContractModal: React.FC<{ data: Contract; onClose: () => void; onConfirm: () => void }> = ({ data, onClose, onConfirm }) => (
  <DeleteConfirmModal 
     title="Xóa Hợp đồng" 
     message={<p>Bạn có chắc chắn muốn xóa hợp đồng <span className="font-bold text-slate-900">"{data.contract_number}"</span>? Dữ liệu sẽ không thể khôi phục.</p>}
     onClose={onClose} 
     onConfirm={onConfirm}
  />
);

// --- Document Modals ---

interface AttachmentManagerProps {
  attachments: Attachment[];
  onUpload: (file: File) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  isUploading: boolean;
}

const AttachmentManager: React.FC<AttachmentManagerProps> = ({ attachments, onUpload, onDelete, isUploading }) => {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      await onUpload(file);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2">
          <span className="material-symbols-outlined text-primary text-lg">attach_file</span>
          Danh sách file đính kèm
        </h3>
        <button 
          onClick={() => fileInputRef.current?.click()}
          disabled={isUploading}
          className="text-xs flex items-center gap-1 bg-primary/10 text-primary px-3 py-1.5 rounded-md hover:bg-primary/20 font-bold transition-all disabled:opacity-50"
        >
          {isUploading ? (
            <span className="w-3 h-3 border-2 border-primary/20 border-t-primary rounded-full animate-spin mr-1"></span>
          ) : (
            <span className="material-symbols-outlined text-sm">upload</span>
          )}
          Tải lên Drive
        </button>
        <input type="file" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
      </div>

      <div className="border border-slate-200 rounded-lg overflow-hidden bg-white">
        <table className="w-full text-left border-collapse">
          <thead className="bg-slate-50 border-b border-slate-200">
            <tr>
              <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase">Tên file</th>
              <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase text-center">Kích thước</th>
              <th className="px-4 py-3 text-xs font-bold text-slate-500 uppercase text-right">Thao tác</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {attachments.length > 0 ? (
              attachments.map((file) => (
                <tr key={file.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="text-sm font-medium text-slate-900 truncate max-w-[200px]" title={file.fileName}>{file.fileName}</span>
                      <span className="text-[10px] text-slate-400 uppercase font-bold">{file.mimeType.split('/')[1] || 'FILE'}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 text-center">{formatSize(file.fileSize)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex justify-end gap-2">
                      <a 
                        href={file.fileUrl} 
                        target="_blank" 
                        rel="noopener noreferrer" 
                        className="p-1.5 text-blue-500 hover:bg-blue-50 rounded transition-all"
                        title="Xem trên Drive"
                      >
                        <span className="material-symbols-outlined text-lg">open_in_new</span>
                      </a>
                      <button 
                        onClick={() => onDelete(file.id)}
                        className="p-1.5 text-red-500 hover:bg-red-50 rounded transition-all"
                        title="Xóa file"
                      >
                        <span className="material-symbols-outlined text-lg">delete</span>
                      </button>
                    </div>
                  </td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={3} className="px-4 py-8 text-center text-slate-400 text-sm">Chưa có file nào được tải lên.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

interface DocumentFormModalProps {
  type: 'ADD' | 'EDIT';
  data?: AppDocument | null;
  customers: Customer[];
  projects: Project[];
  onClose: () => void;
  onSave: (data: Partial<AppDocument>) => void;
}

export const DocumentFormModal: React.FC<DocumentFormModalProps> = ({ 
  type, data, customers, projects, onClose, onSave 
}) => {
  const [formData, setFormData] = useState<Partial<AppDocument>>({
    id: data?.id || '',
    name: data?.name || '',
    typeId: data?.typeId || '',
    customerId: data?.customerId || '',
    projectId: data?.projectId || '',
    expiryDate: data?.expiryDate || '',
    status: data?.status || 'ACTIVE',
    attachments: data?.attachments || []
  });

  const [isUploading, setIsUploading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const filteredProjects = useMemo(() => {
    if (!formData.customerId) return [];
    return (projects || []).filter(p => p.customer_id === formData.customerId);
  }, [formData.customerId, projects]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.id) newErrors.id = 'Mã tài liệu là bắt buộc';
    if (!formData.name) newErrors.name = 'Tên tài liệu là bắt buộc';
    if (!formData.typeId) newErrors.typeId = 'Vui lòng chọn Loại tài liệu';
    if (!formData.customerId) newErrors.customerId = 'Vui lòng chọn Khách hàng';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) {
      onSave(formData);
    }
  };

  const handleChange = (field: keyof AppDocument, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  const handleUploadFile = async (file: File) => {
    setIsUploading(true);
    try {
      // Simulate Google Drive Upload API call
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      const newAttachment: Attachment = {
        id: `ATT_${Date.now()}`,
        fileName: file.name,
        mimeType: file.type || 'application/octet-stream',
        fileSize: file.size,
        fileUrl: 'https://docs.google.com/viewer?url=https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
        driveFileId: `drive_${Math.random().toString(36).substring(7)}`,
        createdAt: new Date().toISOString().split('T')[0]
      };

      setFormData(prev => ({
        ...prev,
        attachments: [...(prev.attachments || []), newAttachment]
      }));
    } catch (error) {
      console.error('Upload failed:', error);
      alert('Tải file lên Drive thất bại. Vui lòng thử lại.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDeleteFile = async (id: string) => {
    if (window.confirm('Bạn có chắc chắn muốn xóa file này khỏi Drive?')) {
      // Simulate Google Drive Delete API call
      await new Promise(resolve => setTimeout(resolve, 1000));
      setFormData(prev => ({
        ...prev,
        attachments: prev.attachments?.filter(a => a.id !== id)
      }));
    }
  };

  return (
    <ModalWrapper onClose={onClose} title={type === 'ADD' ? 'Thêm mới Hồ sơ tài liệu' : 'Cập nhật Hồ sơ tài liệu'} icon="folder_open" width="max-w-4xl">
      <div className="p-6 grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Left Column: Main Info */}
        <div className="space-y-5">
          <h3 className="text-sm font-bold text-slate-700 flex items-center gap-2 border-b border-slate-100 pb-2">
            <span className="material-symbols-outlined text-primary text-lg">info</span>
            Thông tin cơ bản
          </h3>
          
          <FormInput 
              label="Mã tài liệu" 
              value={formData.id} 
              onChange={(e: any) => handleChange('id', e.target.value)} 
              placeholder="TL-2024-001" 
              disabled={type === 'EDIT'} 
              required 
              error={errors.id}
          />

          <FormInput 
              label="Tên tài liệu" 
              value={formData.name} 
              onChange={(e: any) => handleChange('name', e.target.value)} 
              placeholder="Nhập tên tài liệu" 
              required 
              error={errors.name}
          />

          <FormSelect 
              label="Loại tài liệu" 
              value={formData.typeId} 
              onChange={(e: any) => handleChange('typeId', e.target.value)} 
              options={[{value: '', label: 'Chọn loại tài liệu'}, ...DOCUMENT_TYPES.map(t => ({value: t.id, label: t.name}))]} 
              required
              error={errors.typeId}
          />

          <SearchableSelect 
              label="Khách hàng"
              required
              options={customers.map(c => ({ value: String(c.id), label: c.company_name }))}
              value={formData.customerId || ''}
              onChange={(val) => handleChange('customerId', val)}
              error={errors.customerId}
              placeholder="Chọn khách hàng"
          />

          <SearchableSelect 
              label="Dự án liên quan"
              options={filteredProjects.map(p => ({ value: String(p.id), label: p.project_name }))}
              value={formData.projectId || ''}
              onChange={(val) => handleChange('projectId', val)}
              disabled={!formData.customerId}
              placeholder={!formData.customerId ? 'Vui lòng chọn KH trước' : 'Chọn dự án (không bắt buộc)'}
          />

          <div className="grid grid-cols-2 gap-4">
            <FormInput 
                label="Ngày hết hạn" 
                type="date"
                value={formData.expiryDate} 
                onChange={(e: any) => handleChange('expiryDate', e.target.value)} 
            />
            <FormSelect 
                label="Trạng thái" 
                value={formData.status} 
                onChange={(e: any) => handleChange('status', e.target.value)} 
                options={DOCUMENT_STATUSES} 
            />
          </div>
        </div>

        {/* Right Column: Attachments */}
        <div className="bg-slate-50 p-5 rounded-xl border border-slate-200">
          <AttachmentManager 
            attachments={formData.attachments || []}
            onUpload={handleUploadFile}
            onDelete={handleDeleteFile}
            isUploading={isUploading}
          />
          
          <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-100 flex items-start gap-3">
            <span className="material-symbols-outlined text-blue-600 text-xl">cloud_done</span>
            <div>
              <p className="text-xs font-bold text-blue-800">Tích hợp Google Drive</p>
              <p className="text-[11px] text-blue-600 mt-0.5 leading-relaxed">
                File được tải trực tiếp lên Google Drive của hệ thống. Đảm bảo bạn có quyền truy cập để xem file.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-50 border-t border-slate-100">
        <button onClick={onClose} className="px-5 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-100 transition-colors">Hủy</button>
        <button onClick={handleSubmit} className="px-6 py-2.5 rounded-lg bg-primary text-white font-bold hover:bg-deep-teal shadow-lg shadow-primary/20 transition-all flex items-center gap-2">
           <span className="material-symbols-outlined text-lg">check</span> {type === 'ADD' ? 'Lưu' : 'Cập nhật'}
        </button>
      </div>
    </ModalWrapper>
  );
};

export const DeleteDocumentModal: React.FC<{ data: AppDocument; onClose: () => void; onConfirm: () => void }> = ({ data, onClose, onConfirm }) => (
  <DeleteConfirmModal 
     title="Xóa Hồ sơ tài liệu" 
     message={<p>Bạn có chắc chắn muốn xóa hồ sơ <span className="font-bold text-slate-900">"{data.name}"</span>? Các file đính kèm liên quan sẽ không bị xóa trên Drive nhưng sẽ mất liên kết.</p>}
     onClose={onClose} 
     onConfirm={onConfirm}
  />
);

// --- Reminder Modals ---

interface ReminderFormModalProps {
  type: 'ADD' | 'EDIT';
  data?: Reminder | null;
  employees: Employee[];
  onClose: () => void;
  onSave: (data: Partial<Reminder>) => void;
}

export const ReminderFormModal: React.FC<ReminderFormModalProps> = ({ 
  type, data, employees, onClose, onSave 
}) => {
  const [formData, setFormData] = useState<Partial<Reminder>>({
    id: data?.id || '',
    title: data?.title || '',
    content: data?.content || '',
    remindDate: data?.remindDate || '',
    assignedToUserId: data?.assignedToUserId || ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.title) newErrors.title = 'Tiêu đề là bắt buộc';
    if (!formData.remindDate) newErrors.remindDate = 'Ngày nhắc là bắt buộc';
    if (!formData.assignedToUserId) newErrors.assignedToUserId = 'Vui lòng chọn người được giao';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) {
      onSave(formData);
    }
  };

  const handleChange = (field: keyof Reminder, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  return (
    <ModalWrapper onClose={onClose} title={type === 'ADD' ? 'Thêm nhắc việc' : 'Cập nhật nhắc việc'} icon="notifications_active" width="max-w-lg">
      <div className="p-6 space-y-5">
        <FormInput 
            label="Tiêu đề nhắc việc" 
            value={formData.title} 
            onChange={(e: any) => handleChange('title', e.target.value)} 
            placeholder="Nhập tiêu đề..." 
            required 
            error={errors.title}
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-slate-700">Nội dung</label>
          <textarea 
            className="w-full px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all min-h-[100px] text-sm"
            value={formData.content}
            onChange={(e) => handleChange('content', e.target.value)}
            placeholder="Chi tiết công việc cần làm..."
          />
        </div>

        <FormInput 
            label="Ngày nhắc" 
            type="date"
            value={formData.remindDate} 
            onChange={(e: any) => handleChange('remindDate', e.target.value)} 
            required
            error={errors.remindDate}
        />

        <SearchableSelect 
            label="Người được giao"
            required
            options={employees.map(e => ({ value: e.id, label: `${e.name} (${e.id})` }))}
            value={formData.assignedToUserId || ''}
            onChange={(val) => handleChange('assignedToUserId', val)}
            error={errors.assignedToUserId}
            placeholder="Chọn nhân viên"
        />
      </div>

      <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-50 border-t border-slate-100">
        <button onClick={onClose} className="px-5 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-100 transition-colors">Hủy</button>
        <button onClick={handleSubmit} className="px-6 py-2.5 rounded-lg bg-primary text-white font-bold hover:bg-deep-teal shadow-lg shadow-primary/20 transition-all flex items-center gap-2">
           <span className="material-symbols-outlined text-lg">check</span> {type === 'ADD' ? 'Lưu' : 'Cập nhật'}
        </button>
      </div>
    </ModalWrapper>
  );
};

export const DeleteReminderModal: React.FC<{ data: Reminder; onClose: () => void; onConfirm: () => void }> = ({ data, onClose, onConfirm }) => (
  <DeleteConfirmModal 
     title="Xóa nhắc việc" 
     message={<p>Bạn có chắc chắn muốn xóa nhắc việc <span className="font-bold text-slate-900">"{data.title}"</span>?</p>}
     onClose={onClose} 
     onConfirm={onConfirm}
  />
);

// --- User Dept History Modals ---

interface UserDeptHistoryFormModalProps {
  type: 'ADD' | 'EDIT';
  data?: UserDeptHistory | null;
  employees: Employee[];
  departments: Department[];
  onClose: () => void;
  onSave: (data: Partial<UserDeptHistory>) => void;
}

export const UserDeptHistoryFormModal: React.FC<UserDeptHistoryFormModalProps> = ({ 
  type, data, employees, departments, onClose, onSave 
}) => {
  const [formData, setFormData] = useState<Partial<UserDeptHistory>>({
    id: data?.id || '',
    userId: data?.userId || '',
    fromDeptId: data?.fromDeptId || '',
    toDeptId: data?.toDeptId || '',
    transferDate: data?.transferDate || new Date().toISOString().split('T')[0],
    reason: data?.reason || ''
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  // Auto-fill fromDeptId when userId changes
  useEffect(() => {
    if (type === 'ADD' && formData.userId) {
      const employee = employees.find(e => e.id === formData.userId);
      if (employee) {
        setFormData(prev => ({ ...prev, fromDeptId: employee.department }));
      }
    }
  }, [formData.userId, employees, type]);

  const validate = () => {
    const newErrors: Record<string, string> = {};
    if (!formData.id) newErrors.id = 'Mã luân chuyển là bắt buộc';
    if (!formData.userId) newErrors.userId = 'Vui lòng chọn nhân sự';
    if (!formData.toDeptId) newErrors.toDeptId = 'Vui lòng chọn phòng ban mới';
    if (!formData.transferDate) newErrors.transferDate = 'Ngày luân chuyển là bắt buộc';
    if (formData.fromDeptId === formData.toDeptId) newErrors.toDeptId = 'Phòng ban mới phải khác phòng ban hiện tại';
    
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = () => {
    if (validate()) {
      onSave(formData);
    }
  };

  const handleChange = (field: keyof UserDeptHistory, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    if (errors[field]) setErrors(prev => ({ ...prev, [field]: '' }));
  };

  return (
    <ModalWrapper onClose={onClose} title={type === 'ADD' ? 'Thêm mới Luân chuyển' : 'Cập nhật Luân chuyển'} icon="history_edu" width="max-w-lg">
      <div className="p-6 space-y-5">
        <FormInput 
            label="Mã luân chuyển" 
            value={formData.id} 
            onChange={(e: any) => handleChange('id', e.target.value)} 
            placeholder="LC001" 
            disabled={type === 'EDIT'} 
            required 
            error={errors.id}
        />

        <SearchableSelect 
            label="Nhân sự"
            required
            options={employees.map(e => ({ value: e.id, label: `${e.name} (${e.id})` }))}
            value={formData.userId || ''}
            onChange={(val) => handleChange('userId', val)}
            error={errors.userId}
            placeholder="Chọn nhân sự"
            disabled={type === 'EDIT'}
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-slate-700">Từ phòng ban</label>
          <input 
            type="text" 
            value={formData.fromDeptId || ''} 
            disabled 
            className="w-full h-11 px-4 rounded-lg border border-slate-200 bg-slate-100 text-slate-500 cursor-not-allowed"
            placeholder="Tự động điền..."
          />
        </div>

        <SearchableSelect 
            label="Đến phòng ban"
            required
            options={departments.map(d => ({ value: d.dept_name, label: d.dept_name }))} // Using name as ID based on mock data structure
            value={formData.toDeptId || ''}
            onChange={(val) => handleChange('toDeptId', val)}
            error={errors.toDeptId}
            placeholder="Chọn phòng ban mới"
        />

        <FormInput 
            label="Ngày luân chuyển" 
            type="date"
            value={formData.transferDate} 
            onChange={(e: any) => handleChange('transferDate', e.target.value)} 
            required
            error={errors.transferDate}
        />

        <div className="flex flex-col gap-1.5">
          <label className="text-sm font-semibold text-slate-700">Lý do / Ghi chú</label>
          <textarea 
            className="w-full px-4 py-2 rounded-lg border border-slate-300 bg-white text-slate-900 focus:ring-2 focus:ring-primary/20 focus:border-primary outline-none transition-all min-h-[100px] text-sm"
            value={formData.reason}
            onChange={(e) => handleChange('reason', e.target.value)}
            placeholder="Nhập lý do điều chuyển..."
          />
        </div>
      </div>

      <div className="flex items-center justify-end gap-3 px-6 py-4 bg-slate-50 border-t border-slate-100">
        <button onClick={onClose} className="px-5 py-2.5 rounded-lg border border-slate-300 text-slate-700 font-medium hover:bg-slate-100 transition-colors">Hủy</button>
        <button onClick={handleSubmit} className="px-6 py-2.5 rounded-lg bg-primary text-white font-bold hover:bg-deep-teal shadow-lg shadow-primary/20 transition-all flex items-center gap-2">
           <span className="material-symbols-outlined text-lg">check</span> {type === 'ADD' ? 'Lưu & Cập nhật' : 'Cập nhật'}
        </button>
      </div>
    </ModalWrapper>
  );
};

export const DeleteUserDeptHistoryModal: React.FC<{ data: UserDeptHistory; onClose: () => void; onConfirm: () => void }> = ({ data, onClose, onConfirm }) => (
  <DeleteConfirmModal 
     title="Xóa lịch sử luân chuyển" 
     message={<p>Bạn có chắc chắn muốn xóa bản ghi <span className="font-bold text-slate-900">"{data.id}"</span>?</p>}
     onClose={onClose} 
     onConfirm={onConfirm}
  />
);
