
import { Department, Employee, EmployeeType, EmployeeStatus, Gender, VpnStatus, Business, Vendor, Product, Customer, CustomerPersonnel, Opportunity, Project, InvestmentMode, ProjectStatus, Contract, ContractStatus, Document, DocumentType, DocumentStatus, Attachment, Reminder, UserDeptHistory } from './types';

export const MOCK_DEPARTMENTS: Department[] = [
  { id: 'PB001', name: 'Ban Giám đốc', parent: null, status: 'Active', employeeCount: 5, createdDate: '01/01/2023', createdBy: 'Admin' },
  { id: 'PB002', name: 'Phòng Kinh doanh', parent: 'Ban Giám đốc', status: 'Active', employeeCount: 12, createdDate: '15/02/2023', createdBy: 'Admin' },
  { id: 'PB003', name: 'Phòng Marketing', parent: 'Ban Giám đốc', status: 'Active', employeeCount: 8, createdDate: '20/02/2023', createdBy: 'Admin' },
  { id: 'PB004', name: 'Bộ phận CSKH', parent: 'Phòng Kinh doanh', status: 'Inactive', employeeCount: 0, createdDate: '10/03/2023', createdBy: 'Admin' },
  { id: 'PB005', name: 'Phòng Kỹ thuật', parent: 'Ban Giám đốc', status: 'Active', employeeCount: 20, createdDate: '05/01/2023', createdBy: 'Admin' },
  { id: 'PB006', name: 'Phòng Nhân sự', parent: 'Ban Giám đốc', status: 'Active', employeeCount: 6, createdDate: '12/01/2023', createdBy: 'Admin' },
  { id: 'PB007', name: 'Phòng Kế toán', parent: 'Ban Giám đốc', status: 'Active', employeeCount: 10, createdDate: '15/01/2023', createdBy: 'Admin' },
  { id: 'PB008', name: 'Ban Dự án 1', parent: 'Phòng Kỹ thuật', status: 'Active', employeeCount: 15, createdDate: '20/03/2023', createdBy: 'Admin' },
  { id: 'PB009', name: 'Ban Dự án 2', parent: 'Phòng Kỹ thuật', status: 'Inactive', employeeCount: 0, createdDate: '22/03/2023', createdBy: 'Admin' },
  { id: 'PB010', name: 'Phòng Pháp chế', parent: 'Ban Giám đốc', status: 'Active', employeeCount: 4, createdDate: '01/04/2023', createdBy: 'Admin' },
];

export const MOCK_BUSINESSES: Business[] = [
  { id: 'KD001', name: 'Phần cứng', description: 'Cung cấp thiết bị phần cứng, máy chủ', status: 'Active', createdDate: '01/01/2023' },
  { id: 'KD002', name: 'Phần mềm', description: 'Giải pháp phần mềm, chuyển đổi số', status: 'Active', createdDate: '05/01/2023' },
  { id: 'KD003', name: 'An toàn thông tin', description: 'Dịch vụ bảo mật, an ninh mạng', status: 'Active', createdDate: '10/02/2023' },
  { id: 'KD004', name: 'Dịch vụ Viễn thông', description: 'Thoại, SMS, Data', status: 'Active', createdDate: '15/03/2023' },
  { id: 'KD005', name: 'Hạ tầng số', description: 'Cho thuê chỗ đặt máy chủ, Cloud', status: 'Inactive', createdDate: '20/04/2023' },
  { id: 'KD006', name: 'Y tế số', description: 'Giải pháp Y tế thông minh', status: 'Active', createdDate: '01/05/2023' },
  { id: 'KD007', name: 'Giáo dục số', description: 'Giải pháp Giáo dục thông minh', status: 'Active', createdDate: '01/05/2023' },
  { id: 'KD008', name: 'Doanh nghiệp', description: 'Giải pháp cho doanh nghiệp', status: 'Active', createdDate: '01/05/2023' },
];

export const MOCK_VENDORS: Vendor[] = [
  { id: 'DT001', name: 'Công ty Công nghệ CMC', status: 'Active', createdDate: '01/01/2023' },
  { id: 'DT002', name: 'Tập đoàn FPT', status: 'Active', createdDate: '05/02/2023' },
  { id: 'DT003', name: 'Viettel Solutions', status: 'Active', createdDate: '12/03/2023' },
  { id: 'DT004', name: 'Công ty TNHH Sao Bắc Đẩu', status: 'Inactive', createdDate: '20/04/2023' },
  { id: 'DT005', name: 'HPT Vietnam Corporation', status: 'Active', createdDate: '15/05/2023' },
  { id: 'DT006', name: 'VNPT IT', status: 'Active', createdDate: '01/01/2023' },
  { id: 'DT007', name: 'MICROSOFT', status: 'Active', createdDate: '01/01/2023' },
  { id: 'DT008', name: 'CISCO', status: 'Active', createdDate: '01/01/2023' },
  { id: 'DT009', name: 'VNPT TECH', status: 'Active', createdDate: '01/01/2023' },
];

export const MOCK_PRODUCTS: Product[] = [
  { id: 'VNPT_HIS', name: 'Giải pháp Quản lý Y tế', domain: 'KD006', vendor: 'DT006', price: 50000000, status: 'Active', createdDate: '10/01/2023' },
  { id: 'VNPT_SMAS', name: 'Quản lý nhà trường', domain: 'KD007', vendor: 'DT006', price: 25000000, status: 'Active', createdDate: '12/02/2023' },
  { id: 'VNPT_CA', name: 'Chữ ký số', domain: 'KD003', vendor: 'DT006', price: 1500000, status: 'Active', createdDate: '15/03/2023' },
  { id: 'OFFICE_365', name: 'Microsoft Office 365', domain: 'KD008', vendor: 'DT007', price: 3000000, status: 'Active', createdDate: '20/04/2023' },
  { id: 'CISCO_FIREWALL', name: 'Thiết bị tường lửa', domain: 'KD003', vendor: 'DT008', price: 120000000, status: 'Active', createdDate: '05/05/2023' },
  { id: 'VNPT_VSS', name: 'Camera giám sát số', domain: 'KD003', vendor: 'DT009', price: 5000000, status: 'Active', createdDate: '10/06/2023' },
];

export const MOCK_CUSTOMERS: Customer[] = [
  { id: 'KH001', name: 'Ngân hàng TMCP Ngoại thương Việt Nam (Vietcombank)', taxCode: '0100112437', address: '198 Trần Quang Khải, Hoàn Kiếm, Hà Nội', status: 'Active', createdDate: '01/01/2023' },
  { id: 'KH002', name: 'Tập đoàn Xăng dầu Việt Nam (Petrolimex)', taxCode: '0100107370', address: 'Số 1 Khâm Thiên, Đống Đa, Hà Nội', status: 'Active', createdDate: '05/02/2023' },
  { id: 'KH003', name: 'Công ty Cổ phần Sữa Việt Nam (Vinamilk)', taxCode: '0300588569', address: 'Số 10, Đường Tân Trào, P. Tân Phú, Q.7, TP.HCM', status: 'Active', createdDate: '10/03/2023' },
  { id: 'KH004', name: 'Tổng Công ty Hàng không Việt Nam (Vietnam Airlines)', taxCode: '0100107518', address: 'Số 200 Nguyễn Sơn, Bồ Đề, Long Biên, Hà Nội', status: 'Active', createdDate: '15/04/2023' },
  { id: 'KH005', name: 'Tập đoàn Vingroup', taxCode: '0101245486', address: 'Số 7 Đường Bằng Lăng 1, KĐT Vinhomes Riverside, Long Biên, Hà Nội', status: 'Inactive', createdDate: '20/05/2023' },
  { id: 'KH006', name: 'Công ty Cổ phần Tập đoàn Masan', taxCode: '0303576603', address: 'Tầng 8, Tòa nhà Central Plaza, 17 Lê Duẩn, Q.1, TP.HCM', status: 'Active', createdDate: '25/06/2023' },
  { id: 'KH007', name: 'Tập đoàn Điện lực Việt Nam (EVN)', taxCode: '0100100079', address: '11 Cửa Bắc, Ba Đình, Hà Nội', status: 'Active', createdDate: '01/07/2023' },
];

export const MOCK_CUSTOMER_PERSONNEL: CustomerPersonnel[] = [
  { id: 'CP001', fullName: 'Nguyễn Văn A', birthday: '1980-05-15', positionType: 'GIAM_DOC', phoneNumber: '0912345678', email: 'nguyenvana@vietcombank.com.vn', customerId: 'KH001', status: 'Active' },
  { id: 'CP002', fullName: 'Trần Thị B', birthday: '1985-08-20', positionType: 'P_GIAM_DOC', phoneNumber: '0987654321', email: 'tranthib@vietcombank.com.vn', customerId: 'KH001', status: 'Active' },
  { id: 'CP003', fullName: 'Lê Văn C', birthday: '1990-01-10', positionType: 'TRUONG_PHONG', phoneNumber: '0909123456', email: 'levanc@petrolimex.com.vn', customerId: 'KH002', status: 'Active' },
  { id: 'CP004', fullName: 'Phạm Thị D', birthday: '1992-12-05', positionType: 'DAU_MOI', phoneNumber: '0933456789', email: 'phamtid@vinamilk.com.vn', customerId: 'KH003', status: 'Active' },
  { id: 'CP005', fullName: 'Hoàng Văn E', birthday: '1988-06-25', positionType: 'TRUONG_PHONG', phoneNumber: '0918888999', email: 'hoangvane@vietnamairlines.com', customerId: 'KH004', status: 'Active' },
  { id: 'CP006', fullName: 'Đặng Thị F', birthday: '1995-03-30', positionType: 'DAU_MOI', phoneNumber: '0945678901', email: 'dangthif@vingroup.net', customerId: 'KH005', status: 'Active' },
];

export const POSITION_TYPES = [
  { value: 'GIAM_DOC', label: 'Giám đốc', color: 'bg-purple-100 text-purple-700' },
  { value: 'P_GIAM_DOC', label: 'Phó Giám đốc', color: 'bg-indigo-100 text-indigo-700' },
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
        name: `Triển khai ${product.name} cho ${customer.name.substring(0, 20)}...`,
        customerId: customer.id,
        personnelId: personnel ? personnel.id : '',
        productId: product.id,
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
     const unitPrice = product ? product.price : 0;
     const quantity = 1;
     const discount = 0;

     projects.push({
        id: `DA${(i + 1).toString().padStart(3, '0')}`,
        name: `Dự án: ${opp.name}`,
        customerId: opp.customerId,
        opportunityId: opp.id,
        investmentMode: Math.random() > 0.5 ? 'DAU_TU' : 'THUE_DICH_VU',
        startDate: `2023-${Math.floor(Math.random() * 12 + 1).toString().padStart(2, '0')}-01`,
        expectedEndDate: `2024-${Math.floor(Math.random() * 12 + 1).toString().padStart(2, '0')}-01`,
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
        createdDate: `2023-01-01`
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
  { id: 'HD001', projectId: 'DA001', signDate: '2023-05-15', totalValue: 50000000, status: 'SIGNED', createdDate: '2023-05-10' },
  { id: 'HD002', projectId: 'DA002', signDate: '2023-06-20', totalValue: 120000000, status: 'DRAFT', createdDate: '2023-06-18' },
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
