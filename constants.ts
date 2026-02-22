
import { Department, Employee, EmployeeType, EmployeeStatus, Gender, VpnStatus, Business, Vendor, Product, Customer, CustomerPersonnel, Opportunity, Project, InvestmentMode, ProjectStatus, Contract, ContractStatus, Document, DocumentType, DocumentStatus, Attachment, Reminder, UserDeptHistory } from './types';

export const MOCK_DEPARTMENTS: Department[] = [
  { dept_code: 'PB001', dept_name: 'Ban Giám đốc', parent_id: null, status: 'ACTIVE', employeeCount: 5, createdDate: '01/01/2023', createdBy: 'Admin' },
  { dept_code: 'PB002', dept_name: 'Phòng Kinh doanh', parent_id: 'PB001', status: 'ACTIVE', employeeCount: 12, createdDate: '15/02/2023', createdBy: 'Admin' },
  { dept_code: 'PB003', dept_name: 'Phòng Marketing', parent_id: 'PB001', status: 'ACTIVE', employeeCount: 8, createdDate: '20/02/2023', createdBy: 'Admin' },
  { dept_code: 'PB004', dept_name: 'Bộ phận CSKH', parent_id: 'PB002', status: 'INACTIVE', employeeCount: 0, createdDate: '10/03/2023', createdBy: 'Admin' },
  { dept_code: 'PB005', dept_name: 'Phòng Kỹ thuật', parent_id: 'PB001', status: 'ACTIVE', employeeCount: 20, createdDate: '05/01/2023', createdBy: 'Admin' },
  { dept_code: 'PB006', dept_name: 'Phòng Nhân sự', parent_id: 'PB001', status: 'ACTIVE', employeeCount: 6, createdDate: '12/01/2023', createdBy: 'Admin' },
  { dept_code: 'PB007', dept_name: 'Phòng Kế toán', parent_id: 'PB001', status: 'ACTIVE', employeeCount: 10, createdDate: '15/01/2023', createdBy: 'Admin' },
  { dept_code: 'PB008', dept_name: 'Ban Dự án 1', parent_id: 'PB005', status: 'ACTIVE', employeeCount: 15, createdDate: '20/03/2023', createdBy: 'Admin' },
  { dept_code: 'PB009', dept_name: 'Ban Dự án 2', parent_id: 'PB005', status: 'INACTIVE', employeeCount: 0, createdDate: '22/03/2023', createdBy: 'Admin' },
  { dept_code: 'PB010', dept_name: 'Phòng Pháp chế', parent_id: 'PB001', status: 'ACTIVE', employeeCount: 4, createdDate: '01/04/2023', createdBy: 'Admin' },
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
  { id: 'DT001', vendor_code: 'DT001', vendor_name: 'Công ty Công nghệ CMC', created_at: '2023-01-01' },
  { id: 'DT002', vendor_code: 'DT002', vendor_name: 'Tập đoàn FPT', created_at: '2023-02-05' },
  { id: 'DT003', vendor_code: 'DT003', vendor_name: 'Viettel Solutions', created_at: '2023-03-12' },
  { id: 'DT004', vendor_code: 'DT004', vendor_name: 'Công ty TNHH Sao Bắc Đẩu', created_at: '2023-04-20' },
  { id: 'DT005', vendor_code: 'DT005', vendor_name: 'HPT Vietnam Corporation', created_at: '2023-05-15' },
  { id: 'DT006', vendor_code: 'DT006', vendor_name: 'VNPT IT', created_at: '2023-01-01' },
  { id: 'DT007', vendor_code: 'DT007', vendor_name: 'MICROSOFT', created_at: '2023-01-01' },
  { id: 'DT008', vendor_code: 'DT008', vendor_name: 'CISCO', created_at: '2023-01-01' },
  { id: 'DT009', vendor_code: 'DT009', vendor_name: 'VNPT TECH', created_at: '2023-01-01' },
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
  { id: 'KH001', customer_code: 'KH001', company_name: 'Ngân hàng TMCP Ngoại thương Việt Nam (Vietcombank)', tax_code: '0100112437', address: '198 Trần Quang Khải, Hoàn Kiếm, Hà Nội', created_at: '2023-01-01' },
  { id: 'KH002', customer_code: 'KH002', company_name: 'Tập đoàn Xăng dầu Việt Nam (Petrolimex)', tax_code: '0100107370', address: 'Số 1 Khâm Thiên, Đống Đa, Hà Nội', created_at: '2023-02-05' },
  { id: 'KH003', customer_code: 'KH003', company_name: 'Công ty Cổ phần Sữa Việt Nam (Vinamilk)', tax_code: '0300588569', address: 'Số 10, Đường Tân Trào, P. Tân Phú, Q.7, TP.HCM', created_at: '2023-03-10' },
  { id: 'KH004', customer_code: 'KH004', company_name: 'Tổng Công ty Hàng không Việt Nam (Vietnam Airlines)', tax_code: '0100107518', address: 'Số 200 Nguyễn Sơn, Bồ Đề, Long Biên, Hà Nội', created_at: '2023-04-15' },
  { id: 'KH005', customer_code: 'KH005', company_name: 'Tập đoàn Vingroup', tax_code: '0101245486', address: 'Số 7 Đường Bằng Lăng 1, KĐT Vinhomes Riverside, Long Biên, Hà Nội', created_at: '2023-05-20' },
  { id: 'KH006', customer_code: 'KH006', company_name: 'Công ty Cổ phần Tập đoàn Masan', tax_code: '0303576603', address: 'Tầng 8, Tòa nhà Central Plaza, 17 Lê Duẩn, Q.1, TP.HCM', created_at: '2023-06-25' },
  { id: 'KH007', customer_code: 'KH007', company_name: 'Tập đoàn Điện lực Việt Nam (EVN)', tax_code: '0100100079', address: '11 Cửa Bắc, Ba Đình, Hà Nội', created_at: '2023-07-01' },
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
  { value: 'TIEM_NANG', label: 'Tiềm năng', color: 'bg-slate-100 text-slate-700' },
  { value: 'DANG_TIEP_CAN', label: 'Đang tiếp cận', color: 'bg-blue-100 text-blue-700' },
  { value: 'CHAO_GIA', label: 'Chào giá', color: 'bg-indigo-100 text-indigo-700' },
  { value: 'DU_THAU', label: 'Dự thầu', color: 'bg-purple-100 text-purple-700' },
  { value: 'THUONG_THAO', label: 'Thương thảo', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'TRUNG_THAU', label: 'Trúng thầu', color: 'bg-green-100 text-green-700' },
  { value: 'THAT_THAU', label: 'Thất thầu', color: 'bg-red-100 text-red-700' },
];

export const PROJECT_STATUSES = [
  { value: 'ACTIVE', label: 'Hoạt động', color: 'bg-green-100 text-green-700' },
  { value: 'SUSPENDED', label: 'Tạm dừng', color: 'bg-orange-100 text-orange-700' },
  { value: 'COMPLETED', label: 'Hoàn thành', color: 'bg-blue-100 text-blue-700' },
  { value: 'TERMINATED', label: 'Chấm dứt', color: 'bg-red-100 text-red-700' },
];

export const INVESTMENT_MODES = [
  { value: 'DAU_TU', label: 'Đầu tư' },
  { value: 'THUE_DICH_VU', label: 'Thuê dịch vụ CNTT' },
];

const firstNames = ['Nguyễn', 'Trần', 'Lê', 'Phạm', 'Hoàng', 'Huỳnh', 'Phan', 'Vũ', 'Võ', 'Đặng'];
const middleNames = ['Văn', 'Thị', 'Minh', 'Thanh', 'Quang', 'Đức', 'Hồng', 'Ngọc', 'Gia', 'Xuân'];
const lastNames = ['An', 'Bình', 'Cường', 'Dũng', 'Em', 'Giang', 'Hương', 'Hùng', 'Khánh', 'Long', 'My', 'Nam', 'Oanh', 'Phúc', 'Quân', 'Sơn', 'Tuấn', 'Uyên', 'Vy', 'Yến'];

const departments = ['Phòng Nhân sự', 'Phòng Kỹ thuật', 'Phòng Kinh doanh', 'Phòng Marketing', 'Phòng Kế toán', 'Ban Giám đốc'];

const generateEmployees = (count: number): Employee[] => {
  const employees: Employee[] = [];
  for (let i = 1; i <= count; i++) {
    const firstName = firstNames[Math.floor(Math.random() * firstNames.length)];
    const middleName = middleNames[Math.floor(Math.random() * middleNames.length)];
    const lastName = lastNames[Math.floor(Math.random() * lastNames.length)];
    const fullName = `${firstName} ${middleName} ${lastName}`;
    
    // Generate simplified Vietnamese alias for email
    const removeAccents = (str: string) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/đ/g, "d").replace(/Đ/g, "D").toLowerCase();
    const emailPrefix = removeAccents(`${lastName}${firstName.substring(0, 1)}${middleName.substring(0, 1)}`); // e.g., annv
    
    const year = 1980 + Math.floor(Math.random() * 20); // 1980 - 2000
    const month = 1 + Math.floor(Math.random() * 12);
    const day = 1 + Math.floor(Math.random() * 28);
    const dob = `${day < 10 ? '0' + day : day}/${month < 10 ? '0' + month : month}/${year}`;
    const age = 2024 - year;
    
    const gender: Gender = Math.random() > 0.4 ? 'Male' : 'Female';
    const type: EmployeeType = Math.random() > 0.2 ? 'Official' : 'Collaborator';
    const status: EmployeeStatus = Math.random() > 0.9 ? 'Suspended' : 'Active';
    const dept = departments[Math.floor(Math.random() * departments.length)];
    const id = `NV${i.toString().padStart(3, '0')}`;
    
    const hasIp = Math.random() > 0.3;
    const ipAddress = hasIp ? `192.168.1.${10 + i}` : '';
    const vpnStatus: VpnStatus = hasIp ? (Math.random() > 0.1 ? 'Granted' : 'Not_Granted') : 'Not_Granted';

    employees.push({
      id,
      name: fullName,
      email: `${emailPrefix}${i}@vnpt.vn`,
      dob,
      age,
      gender,
      department: dept,
      type,
      status,
      phone: `09${Math.floor(Math.random() * 90000000 + 10000000)}`,
      position: type === 'Official' ? 'Chuyên viên' : 'CTV',
      ipAddress,
      vpnStatus
    });
  }
  return employees;
};

export const MOCK_EMPLOYEES: Employee[] = generateEmployees(50);

// Generate Mock Opportunities
const generateOpportunities = (count: number): Opportunity[] => {
  const opportunities: Opportunity[] = [];
  const salesEmployees = (MOCK_EMPLOYEES || []).filter(e => e.department === 'Phòng Kinh doanh').slice(0, 5);
  
  for(let i = 1; i <= count; i++) {
     const customer = MOCK_CUSTOMERS[Math.floor(Math.random() * MOCK_CUSTOMERS.length)];
     const personnelList = (MOCK_CUSTOMER_PERSONNEL || []).filter(cp => cp.customerId === customer.id);
     const personnel = personnelList.length > 0 ? personnelList[Math.floor(Math.random() * personnelList.length)] : null;
     const product = MOCK_PRODUCTS[Math.floor(Math.random() * MOCK_PRODUCTS.length)];
     const sales = salesEmployees.length > 0 ? salesEmployees[Math.floor(Math.random() * salesEmployees.length)] : MOCK_EMPLOYEES[0];
     
     const statuses = OPPORTUNITY_STATUSES.map(s => s.value);
     const status = statuses[Math.floor(Math.random() * statuses.length)] as any;

     opportunities.push({
        id: `OPP${i.toString().padStart(3, '0')}`,
        name: `Triển khai ${product.product_name} cho ${customer.company_name.substring(0, 20)}...`,
        customerId: String(customer.id),
        personnelId: personnel ? personnel.id : '',
        productId: String(product.id),
        estimatedValue: Math.floor(Math.random() * 500) * 1000000 + 50000000,
        probability: Math.floor(Math.random() * 100),
        status: status,
        salesId: sales.id,
        createdDate: `2023-${Math.floor(Math.random() * 12 + 1).toString().padStart(2, '0')}-15`
     });
  }
  return opportunities;
}

export const MOCK_OPPORTUNITIES: Opportunity[] = generateOpportunities(15);

// Generate Mock Projects
const generateProjects = (count: number): Project[] => {
  const projects: Project[] = [];
  const wonOpportunities = (MOCK_OPPORTUNITIES || []).filter(o => o.status === 'TRUNG_THAU');
  
  // Use opportunities to create projects, or random if not enough
  const loopCount = Math.min(count, wonOpportunities.length);

  for(let i = 0; i < loopCount; i++) {
     const opp = wonOpportunities[i];
     const product = (MOCK_PRODUCTS || []).find(p => p.id === opp.productId);
     const unitPrice = product ? product.standard_price : 0;
     const quantity = 1;
     const discount = 0;
     const projectCode = `DA${(i + 1).toString().padStart(3, '0')}`;

     projects.push({
        id: projectCode,
        project_code: projectCode,
        project_name: `Dự án: ${opp.name}`,
        customer_id: opp.customerId,
        opportunity_id: opp.id,
        investment_mode: Math.random() > 0.5 ? 'DAU_TU' : 'THUE_DICH_VU',
        start_date: `2023-${Math.floor(Math.random() * 12 + 1).toString().padStart(2, '0')}-01`,
        expected_end_date: `2024-${Math.floor(Math.random() * 12 + 1).toString().padStart(2, '0')}-01`,
        status: Math.random() > 0.8 ? 'COMPLETED' : (Math.random() > 0.1 ? 'ACTIVE' : 'SUSPENDED'),
        items: [
            { 
              id: `ITEM${i}1`, 
              productId: opp.productId, 
              quantity: quantity, 
              unitPrice: unitPrice, 
              discountPercent: 0,
              discountAmount: discount,
              lineTotal: (quantity * unitPrice) - discount 
            }
        ],
        raci: [
            { id: `RACI${i}1`, userId: 'NV001', roleType: 'A', assignedDate: '01/01/2023' },
            { id: `RACI${i}2`, userId: 'NV002', roleType: 'R', assignedDate: '01/01/2023' }
        ],
        created_at: `2023-01-01`
     });
  }
  return projects;
}

export const MOCK_PROJECTS: Project[] = generateProjects(5);

export const CONTRACT_STATUSES = [
  { value: 'DRAFT', label: 'Nháp', color: 'bg-yellow-100 text-yellow-700' },
  { value: 'SIGNED', label: 'Đã ký', color: 'bg-green-100 text-green-700' },
  { value: 'TERMINATED', label: 'Chấm dứt', color: 'bg-red-100 text-red-700' },
  { value: 'EXPIRED', label: 'Hết hạn', color: 'bg-slate-100 text-slate-700' },
];

export const MOCK_CONTRACTS: Contract[] = [
  { id: 'HD001', contract_number: 'HD001', project_id: 'DA001', sign_date: '2023-05-15', total_value: 50000000, status: 'SIGNED', created_at: '2023-05-10' },
  { id: 'HD002', contract_number: 'HD002', project_id: 'DA002', sign_date: '2023-06-20', total_value: 120000000, status: 'DRAFT', created_at: '2023-06-18' },
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
    expiryDate: '2025-12-31',
    status: 'ACTIVE',
    attachments: [
      {
        id: 'ATT001',
        fileName: 'hop_dong_his_vcb.pdf',
        mimeType: 'application/pdf',
        fileSize: 2048576,
        fileUrl: 'https://docs.google.com/viewer?url=https://www.w3.org/WAI/ER/tests/xhtml/testfiles/resources/pdf/dummy.pdf',
        driveFileId: 'drive_123',
        createdAt: '2023-05-15'
      }
    ],
    createdDate: '2023-05-15'
  }
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
    remindDate: '2024-02-20',
    assignedToUserId: 'NV001',
    createdDate: '2024-02-15'
  },
  {
    id: 'REM002',
    title: 'Gia hạn bảo lãnh ngân hàng',
    content: 'Liên hệ ngân hàng BIDV để làm thủ tục gia hạn bảo lãnh cho dự án HIS.',
    remindDate: '2024-02-18', // Overdue
    assignedToUserId: 'NV002',
    createdDate: '2024-02-10'
  }
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
    transferDate: '2023-03-20',
    reason: 'Điều chuyển nhân sự theo yêu cầu dự án.',
    createdDate: '2023-03-15'
  },
  {
    id: 'LC002',
    userId: 'NV012',
    fromDeptId: 'Phòng Kinh doanh',
    toDeptId: 'Bộ phận CSKH',
    transferDate: '2023-04-01',
    reason: 'Tăng cường nhân sự cho bộ phận CSKH.',
    createdDate: '2023-03-28'
  }
];
