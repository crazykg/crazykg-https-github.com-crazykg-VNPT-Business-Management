import {
  Department,
  Employee,
  EmployeeStatus,
  Business,
  Vendor,
  Product,
  Customer,
  CustomerPersonnel,
  Opportunity,
  OpportunityStage,
  Project,
  InvestmentMode,
  ProjectStatus,
  Contract,
  ContractStatus,
  Document,
  DocumentType,
  Reminder,
  UserDeptHistory,
} from './types';

export const MOCK_DEPARTMENTS: Department[] = [
  { id: 1, dept_code: 'PB001', dept_name: 'Ban Giám đốc', parent_id: null, dept_path: '1/', is_active: true },
  { id: 2, dept_code: 'PB002', dept_name: 'Phòng Kinh doanh', parent_id: 1, dept_path: '1/2/', is_active: true },
  { id: 3, dept_code: 'PB003', dept_name: 'Phòng Marketing', parent_id: 1, dept_path: '1/3/', is_active: true },
  { id: 4, dept_code: 'PB004', dept_name: 'Bộ phận CSKH', parent_id: 2, dept_path: '1/2/4/', is_active: false },
  { id: 5, dept_code: 'PB005', dept_name: 'Phòng Kỹ thuật', parent_id: 1, dept_path: '1/5/', is_active: true },
  { id: 6, dept_code: 'PB006', dept_name: 'Phòng Nhân sự', parent_id: 1, dept_path: '1/6/', is_active: true },
  { id: 7, dept_code: 'PB007', dept_name: 'Phòng Kế toán', parent_id: 1, dept_path: '1/7/', is_active: true },
  { id: 8, dept_code: 'PB008', dept_name: 'Ban Dự án 1', parent_id: 5, dept_path: '1/5/8/', is_active: true },
  { id: 9, dept_code: 'PB009', dept_name: 'Ban Dự án 2', parent_id: 5, dept_path: '1/5/9/', is_active: false },
  { id: 10, dept_code: 'PB010', dept_name: 'Phòng Pháp chế', parent_id: 1, dept_path: '1/10/', is_active: true },
];

export const MOCK_BUSINESSES: Business[] = [
  { id: 'KD001', domain_code: 'KD001', domain_name: 'Phần cứng', created_at: '2023-01-01' },
  { id: 'KD002', domain_code: 'KD002', domain_name: 'Phần mềm', created_at: '2023-01-05' },
  { id: 'KD003', domain_code: 'KD003', domain_name: 'An toàn thông tin', created_at: '2023-02-10' },
  { id: 'KD004', domain_code: 'KD004', domain_name: 'Dịch vụ Viễn thông', created_at: '2023-03-15' },
  { id: 'KD005', domain_code: 'KD005', domain_name: 'Hạ tầng số', created_at: '2023-04-20' },
  { id: 'KD006', domain_code: 'KD006', domain_name: 'Y tế số', created_at: '2023-05-01' },
  { id: 'KD007', domain_code: 'KD007', domain_name: 'Giáo dục số', created_at: '2023-05-01' },
  { id: 'KD008', domain_code: 'KD008', domain_name: 'Doanh nghiệp', created_at: '2023-05-01' },
];

export const MOCK_VENDORS: Vendor[] = [
  { id: 'DT001', uuid: 'vdr-001', vendor_code: 'DT001', vendor_name: 'Công ty Công nghệ CMC', created_at: '2023-01-01' },
  { id: 'DT002', uuid: 'vdr-002', vendor_code: 'DT002', vendor_name: 'Tập đoàn FPT', created_at: '2023-02-05' },
  { id: 'DT003', uuid: 'vdr-003', vendor_code: 'DT003', vendor_name: 'Viettel Solutions', created_at: '2023-03-12' },
  { id: 'DT004', uuid: 'vdr-004', vendor_code: 'DT004', vendor_name: 'Công ty TNHH Sao Bắc Đẩu', created_at: '2023-04-20' },
  { id: 'DT005', uuid: 'vdr-005', vendor_code: 'DT005', vendor_name: 'HPT Vietnam Corporation', created_at: '2023-05-15' },
  { id: 'DT006', uuid: 'vdr-006', vendor_code: 'DT006', vendor_name: 'VNPT IT', created_at: '2023-01-01' },
  { id: 'DT007', uuid: 'vdr-007', vendor_code: 'DT007', vendor_name: 'MICROSOFT', created_at: '2023-01-01' },
  { id: 'DT008', uuid: 'vdr-008', vendor_code: 'DT008', vendor_name: 'CISCO', created_at: '2023-01-01' },
  { id: 'DT009', uuid: 'vdr-009', vendor_code: 'DT009', vendor_name: 'VNPT TECH', created_at: '2023-01-01' },
];

export const MOCK_PRODUCTS: Product[] = [
  { id: 'VNPT_HIS', product_code: 'VNPT_HIS', product_name: 'Giải pháp Quản lý Y tế', domain_id: 'KD006', vendor_id: 'DT006', standard_price: 50000000, unit: 'Gói', created_at: '2023-01-10' },
  { id: 'VNPT_SMAS', product_code: 'VNPT_SMAS', product_name: 'Quản lý nhà trường', domain_id: 'KD007', vendor_id: 'DT006', standard_price: 25000000, unit: 'Gói', created_at: '2023-02-12' },
  { id: 'VNPT_CA', product_code: 'VNPT_CA', product_name: 'Chữ ký số', domain_id: 'KD003', vendor_id: 'DT006', standard_price: 1500000, unit: 'Gói', created_at: '2023-03-15' },
  { id: 'OFFICE_365', product_code: 'OFFICE_365', product_name: 'Microsoft Office 365', domain_id: 'KD008', vendor_id: 'DT007', standard_price: 3000000, unit: 'Gói', created_at: '2023-04-20' },
  { id: 'CISCO_FIREWALL', product_code: 'CISCO_FIREWALL', product_name: 'Thiết bị tường lửa', domain_id: 'KD003', vendor_id: 'DT008', standard_price: 120000000, unit: 'Cái', created_at: '2023-05-05' },
  { id: 'VNPT_VSS', product_code: 'VNPT_VSS', product_name: 'Camera giám sát số', domain_id: 'KD003', vendor_id: 'DT009', standard_price: 5000000, unit: 'Cái', created_at: '2023-06-10' },
];

export const MOCK_CUSTOMERS: Customer[] = [
  { id: 'KH001', uuid: 'cst-001', customer_code: 'KH001', customer_name: 'Ngân hàng TMCP Ngoại thương Việt Nam (Vietcombank)', tax_code: '0100112437', address: '198 Trần Quang Khải, Hoàn Kiếm, Hà Nội', created_at: '2023-01-01' },
  { id: 'KH002', uuid: 'cst-002', customer_code: 'KH002', customer_name: 'Tập đoàn Xăng dầu Việt Nam (Petrolimex)', tax_code: '0100107370', address: 'Số 1 Khâm Thiên, Đống Đa, Hà Nội', created_at: '2023-02-05' },
  { id: 'KH003', uuid: 'cst-003', customer_code: 'KH003', customer_name: 'Công ty Cổ phần Sữa Việt Nam (Vinamilk)', tax_code: '0300588569', address: 'Số 10, Đường Tân Trào, P. Tân Phú, Q.7, TP.HCM', created_at: '2023-03-10' },
  { id: 'KH004', uuid: 'cst-004', customer_code: 'KH004', customer_name: 'Tổng Công ty Hàng không Việt Nam (Vietnam Airlines)', tax_code: '0100107518', address: 'Số 200 Nguyễn Sơn, Bồ Đề, Long Biên, Hà Nội', created_at: '2023-04-15' },
  { id: 'KH005', uuid: 'cst-005', customer_code: 'KH005', customer_name: 'Tập đoàn Vingroup', tax_code: '0101245486', address: 'Số 7 Đường Bằng Lăng 1, KĐT Vinhomes Riverside, Long Biên, Hà Nội', created_at: '2023-05-20' },
  { id: 'KH006', uuid: 'cst-006', customer_code: 'KH006', customer_name: 'Công ty Cổ phần Tập đoàn Masan', tax_code: '0303576603', address: 'Tầng 8, Tòa nhà Central Plaza, 17 Lê Duẩn, Q.1, TP.HCM', created_at: '2023-06-25' },
  { id: 'KH007', uuid: 'cst-007', customer_code: 'KH007', customer_name: 'Tập đoàn Điện lực Việt Nam (EVN)', tax_code: '0100100079', address: '11 Cửa Bắc, Ba Đình, Hà Nội', created_at: '2023-07-01' },
];

export const MOCK_CUSTOMER_PERSONNEL: CustomerPersonnel[] = [
  { id: 'CP001', fullName: 'Nguyễn Văn A', birthday: '1980-05-15', positionType: 'GIAM_DOC', phoneNumber: '0912345678', email: 'nguyenvana@vietcombank.com.vn', customerId: 'KH001', status: 'Active' },
  { id: 'CP002', fullName: 'Trần Thị B', birthday: '1985-08-20', positionType: 'TRUONG_PHONG', phoneNumber: '0987654321', email: 'tranthib@vietcombank.com.vn', customerId: 'KH001', status: 'Active' },
  { id: 'CP003', fullName: 'Lê Văn C', birthday: '1990-01-10', positionType: 'TRUONG_PHONG', phoneNumber: '0909123456', email: 'levanc@petrolimex.com.vn', customerId: 'KH002', status: 'Active' },
  { id: 'CP004', fullName: 'Phạm Thị D', birthday: '1992-12-05', positionType: 'DAU_MOI', phoneNumber: '0933456789', email: 'phamtid@vinamilk.com.vn', customerId: 'KH003', status: 'Active' },
  { id: 'CP005', fullName: 'Hoàng Văn E', birthday: '1988-06-25', positionType: 'TRUONG_PHONG', phoneNumber: '0918888999', email: 'hoangvane@vietnamairlines.com', customerId: 'KH004', status: 'Active' },
  { id: 'CP006', fullName: 'Đặng Thị F', birthday: '1995-03-30', positionType: 'DAU_MOI', phoneNumber: '0945678901', email: 'dangthif@vingroup.net', customerId: 'KH005', status: 'Active' },
];

export const POSITION_TYPES = [
  { value: 'GIAM_DOC', label: 'Giám đốc', color: 'bg-purple-100 text-purple-700' },
  { value: 'TRUONG_PHONG', label: 'Trưởng phòng', color: 'bg-blue-100 text-blue-700' },
  { value: 'DAU_MOI', label: 'Đầu mối', color: 'bg-slate-100 text-slate-700' },
];

export const OPPORTUNITY_STATUSES = [
  { value: 'NEW', label: 'Mới', color: 'bg-slate-100 text-slate-700' },
  { value: 'PROPOSAL', label: 'Đề xuất', color: 'bg-indigo-100 text-indigo-700' },
  { value: 'NEGOTIATION', label: 'Đàm phán', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'WON', label: 'Thắng', color: 'bg-green-100 text-green-700' },
  { value: 'LOST', label: 'Thất bại', color: 'bg-red-100 text-red-700' },
];

export const PROJECT_STATUSES = [
  { value: 'TRIAL', label: 'Dùng thử', color: 'bg-amber-100 text-amber-700' },
  { value: 'ONGOING', label: 'Đang triển khai theo hợp đồng', color: 'bg-green-100 text-green-700' },
  { value: 'WARRANTY', label: 'Đã kết thúc - còn Bảo hành, bảo trì', color: 'bg-cyan-100 text-cyan-700' },
  { value: 'COMPLETED', label: 'Đã kết thúc', color: 'bg-blue-100 text-blue-700' },
  { value: 'CANCELLED', label: 'Đã Huỷ', color: 'bg-red-100 text-red-700' },
];

export const INVESTMENT_MODES: { value: InvestmentMode; label: string }[] = [
  { value: 'DAU_TU', label: 'Đầu tư' },
  { value: 'THUE_DICH_VU', label: 'Thuê dịch vụ CNTT' },
];

const firstNames = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng'];
const middleNames = ['Văn', 'Thị', 'Minh', 'Thanh', 'Quang', 'Đức', 'Hồng', 'Ngọc', 'Gia', 'Xuân'];
const lastNames = ['An', 'Bình', 'Cường', 'Dũng', 'Em', 'Giang', 'Hương', 'Hùng', 'Khánh', 'Long', 'My', 'Nam', 'Oanh', 'Phúc', 'Quân', 'Sơn', 'Tuấn', 'Uyên', 'Vy', 'Yến'];

const generateEmployees = (count: number): Employee[] => {
  const generated: Employee[] = [];
  const statuses: EmployeeStatus[] = ['ACTIVE', 'INACTIVE', 'SUSPENDED'];

  for (let i = 1; i <= count; i++) {
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const middleName = middleNames[Math.floor(Math.random() * middleNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    const fullName = `${firstName} ${middleName} ${lastName}`;

    const removeAccents = (str: string) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/đ/g, 'd').replace(/Đ/g, 'D').toLowerCase();
    const username = `${removeAccents(lastName)}.${removeAccents(firstName)}${i}`;
    const emailPrefix = removeAccents(`${lastName}${firstName.substring(0, 1)}${middleName.substring(0, 1)}`);

    const dept = MOCK_DEPARTMENTS[Math.floor(Math.random() * MOCK_DEPARTMENTS.length)];
    const statusRand = Math.random();
    const status: EmployeeStatus = statusRand > 0.9 ? statuses[2] : statusRand > 0.2 ? statuses[0] : statuses[1];

    const id = `NV${i.toString().padStart(3, '0')}`;
    generated.push({
      id,
      uuid: `emp-${i.toString().padStart(3, '0')}`,
      username,
      full_name: fullName,
      email: `${emailPrefix}${i}@vnpt.vn`,
      status,
      department_id: dept.id,
      position_id: `POS${((i % 8) + 1).toString().padStart(3, '0')}`,
    });
  }

  return generated;
};

export const MOCK_EMPLOYEES: Employee[] = generateEmployees(50);

const generateOpportunities = (count: number): Opportunity[] => {
  const generated: Opportunity[] = [];
  const stages: OpportunityStage[] = ['NEW', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST'];

  for (let i = 1; i <= count; i++) {
    const customer = MOCK_CUSTOMERS[Math.floor(Math.random() * MOCK_CUSTOMERS.length)];
    const product = MOCK_PRODUCTS[Math.floor(Math.random() * MOCK_PRODUCTS.length)];
    const stage = stages[Math.floor(Math.random() * stages.length)];
    const amount = Math.floor(Math.random() * 500) * 1000000 + 50000000;

    generated.push({
      id: `OPP${i.toString().padStart(3, '0')}`,
      opp_name: `Triển khai ${product.product_name} cho ${customer.customer_name.substring(0, 24)}...`,
      customer_id: customer.id,
      amount,
      stage,
    });
  }

  return generated;
};

export const MOCK_OPPORTUNITIES: Opportunity[] = generateOpportunities(15);

const generateProjects = (count: number): Project[] => {
  const generated: Project[] = [];
  const sourceOpps = (MOCK_OPPORTUNITIES || []).filter((o) => o.stage === 'WON');
  const statuses: ProjectStatus[] = ['TRIAL', 'ONGOING', 'WARRANTY', 'COMPLETED', 'CANCELLED'];
  const modes: InvestmentMode[] = ['DAU_TU', 'THUE_DICH_VU'];

  for (let i = 0; i < count; i++) {
    const opp = sourceOpps[i] || MOCK_OPPORTUNITIES[i % MOCK_OPPORTUNITIES.length];
    const projectCode = `DA${(i + 1).toString().padStart(3, '0')}`;
    const status = statuses[Math.floor(Math.random() * statuses.length)];

    generated.push({
      id: projectCode,
      project_code: projectCode,
      project_name: `Dự án: ${opp.opp_name}`,
      customer_id: opp.customer_id,
      status,
      investment_mode: modes[i % modes.length],
    });
  }

  return generated;
};

export const MOCK_PROJECTS: Project[] = generateProjects(8);

export const CONTRACT_STATUSES: { value: ContractStatus; label: string; color: string }[] = [
  { value: 'DRAFT', label: 'Đang soạn', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'SIGNED', label: 'Đã ký', color: 'bg-green-100 text-green-700' },
  { value: 'RENEWED', label: 'Đã gia hạn HĐ', color: 'bg-blue-100 text-blue-700' },
];

export const MOCK_CONTRACTS: Contract[] = [
  {
    id: 'HD001',
    contract_code: 'HD001',
    contract_name: 'Hợp đồng triển khai HIS Vietcombank',
    customer_id: 'KH001',
    project_id: 'DA001',
    value: 50000000,
    payment_cycle: 'ONCE',
    status: 'SIGNED',
    created_at: '2025-05-10',
  },
  {
    id: 'HD002',
    contract_code: 'HD002',
    contract_name: 'Hợp đồng Office 365 cho Petrolimex',
    customer_id: 'KH002',
    project_id: 'DA002',
    value: 120000000,
    payment_cycle: 'MONTHLY',
    status: 'DRAFT',
    created_at: '2025-06-18',
  },
];

export const DOCUMENT_TYPES: DocumentType[] = [
  { id: 'DT001', name: 'Hợp đồng kinh tế' },
  { id: 'DT002', name: 'Biên bản nghiệm thu' },
  { id: 'DT003', name: 'Bảo lãnh ngân hàng' },
  { id: 'DT004', name: 'Chứng chỉ chất lượng' },
  { id: 'DT005', name: 'Hồ sơ năng lực' },
];

export const DOCUMENT_STATUSES = [
  { value: 'ACTIVE', label: 'Hiệu lực', color: 'bg-green-100 text-green-700' },
  { value: 'SUSPENDED', label: 'Tạm dừng', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'EXPIRED', label: 'Hết hạn', color: 'bg-red-100 text-red-700' },
];

export const MOCK_DOCUMENTS: Document[] = [
  {
    id: 'DOC001',
    name: 'Hợp đồng triển khai HIS - Vietcombank',
    typeId: 'DT001',
    customerId: 'KH001',
    projectId: 'DA001',
    expiryDate: '2026-12-31',
    status: 'ACTIVE',
    attachments: [
      {
        id: 'ATT001',
        fileName: 'hop_dong_his_vcb.pdf',
        mimeType: 'application/pdf',
        fileSize: 2048576,
        fileUrl: 'https://docs.google.com/viewer?url=https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
        driveFileId: 'drive_123',
        createdAt: '2025-05-15',
      },
    ],
    createdDate: '2025-05-15',
  },
];

export const RACI_ROLES = [
  { value: 'A', label: 'A - Accountable', color: 'bg-red-100 text-red-700' },
  { value: 'R', label: 'R - Responsible', color: 'bg-blue-100 text-blue-700' },
  { value: 'C', label: 'C - Consulted', color: 'bg-amber-100 text-amber-700' },
  { value: 'I', label: 'I - Informed', color: 'bg-slate-100 text-slate-700' },
];

export const MOCK_REMINDERS: Reminder[] = [
  {
    id: 'REM001',
    title: 'Gửi báo cáo tuần cho khách hàng',
    content: 'Tổng hợp các task đã hoàn thành và gửi email báo cáo cho anh Nam (Vietcombank).',
    remindDate: '2026-02-20',
    assignedToUserId: 'NV001',
    createdDate: '2026-02-15',
  },
  {
    id: 'REM002',
    title: 'Gia hạn bảo lãnh ngân hàng',
    content: 'Liên hệ ngân hàng BIDV để làm thủ tục gia hạn bảo lãnh cho dự án HIS.',
    remindDate: '2026-02-18',
    assignedToUserId: 'NV002',
    createdDate: '2026-02-10',
  },
];

export const PARENT_OPTIONS = [
  { value: '1', label: 'Ban Giám đốc' },
  { value: '2', label: 'Khối Kỹ thuật' },
  { value: '3', label: 'Khối Kinh doanh' },
  { value: '4', label: 'Phòng Nhân sự' },
];

export const MOCK_USER_DEPT_HISTORY: UserDeptHistory[] = [
  {
    id: 'LC001',
    userId: 'NV005',
    fromDeptId: 'Phòng Kỹ thuật',
    toDeptId: 'Ban Dự án 1',
    transferDate: '2025-03-20',
    reason: 'Điều chuyển nhân sự theo yêu cầu dự án.',
    createdDate: '2025-03-15',
  },
  {
    id: 'LC002',
    userId: 'NV012',
    fromDeptId: 'Phòng Kinh doanh',
    toDeptId: 'Bộ phận CSKH',
    transferDate: '2025-04-01',
    reason: 'Tăng cường nhân sự cho bộ phận CSKH.',
    createdDate: '2025-03-28',
  },
];
