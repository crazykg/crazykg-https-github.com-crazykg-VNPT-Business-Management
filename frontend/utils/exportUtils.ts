import type { AuthUser, PaginatedQuery, Project, Contract, ProjectRaciRow } from '../types';
import { fetchProjectsPage, fetchContractsPage, fetchProjectRaciAssignments } from '../services/v5Api';
import { downloadExcelWorkbook } from './excelTemplate';
import { hasPermission } from './authorization';

/**
 * Formats a date to ISO format for export.
 */
export function isoDateStamp(): string {
  return new Date().toISOString().slice(0, 10).replace(/-/g, '');
}

/**
 * Exports data to CSV file.
 */
export function exportCsv(fileName: string, headers: string[], rows: any[][]): void {
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(','))
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${fileName}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

/**
 * Exports data to Excel file.
 */
export function exportExcel(fileName: string, sheetName: string, headers: string[], rows: any[][]): void {
  downloadExcelWorkbook(fileName, [
    {
      name: sheetName,
      headers,
      rows,
    },
  ]);
}

/**
 * Exports data to PDF file.
 * Returns true if print was successful, false if blocked by browser.
 */
export function exportPdfTable(options: {
  fileName: string;
  title: string;
  headers: string[];
  rows: any[][];
  subtitle?: string;
  landscape?: boolean;
}): boolean {
  // Open print dialog
  const printWindow = window.open('', '_blank');
  if (!printWindow) {
    return false;
  }

  const orientation = options.landscape ? 'landscape' : 'portrait';
  
  printWindow.document.write(`
    <!DOCTYPE html>
    <html>
    <head>
      <title>${options.title}</title>
      <style>
        @page { size: ${orientation}; margin: 20mm; }
        body { font-family: Arial, sans-serif; }
        h1 { color: #006699; }
        table { width: 100%; border-collapse: collapse; }
        th, td { border: 1px solid #ddd; padding: 8px; text-align: left; }
        th { background-color: #006699; color: white; }
        tr:nth-child(even) { background-color: #f2f2f2; }
      </style>
    </head>
    <body>
      <h1>${options.title}</h1>
      ${options.subtitle ? `<p>${options.subtitle}</p>` : ''}
      <table>
        <thead>
          <tr>
            ${options.headers.map(h => `<th>${h}</th>`).join('')}
          </tr>
        </thead>
        <tbody>
          ${options.rows.map(row => `<tr>${row.map(cell => `<td>${cell ?? ''}</td>`).join('')}</tr>`).join('')}
        </tbody>
      </table>
      <script>window.onload = function() { window.print(); }</script>
    </body>
    </html>
  `);
  
  printWindow.document.close();
  return true;
}

/**
 * Exports all projects by current query filters.
 * Fetches all pages if needed (up to 200 items per page).
 */
export async function exportProjectsByCurrentQuery(
  authUser: AuthUser,
  currentQuery: PaginatedQuery
): Promise<Project[]> {
  if (!hasPermission(authUser, 'projects.read')) {
    throw new Error('Bạn không có quyền xuất dữ liệu dự án.');
  }

  const seedQuery = {
    ...(currentQuery || {}),
    page: 1,
    per_page: 200,
  } as PaginatedQuery;

  const rows: Project[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const result = await fetchProjectsPage({
      ...seedQuery,
      page,
    });
    rows.push(...(result.data || []));
    totalPages = Math.max(1, result.meta?.total_pages || 1);
    page += 1;
  } while (page <= totalPages);

  const seen = new Set<string>();
  return rows.filter((item) => {
    const key = String(item.id ?? '');
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

/**
 * Exports all contracts by current query filters.
 * Fetches all pages if needed (up to 200 items per page).
 */
export async function exportContractsByCurrentQuery(
  authUser: AuthUser,
  currentQuery: PaginatedQuery
): Promise<Contract[]> {
  if (!hasPermission(authUser, 'contracts.read')) {
    throw new Error('Bạn không có quyền xuất dữ liệu hợp đồng.');
  }

  const seedQuery = {
    ...(currentQuery || {}),
    page: 1,
    per_page: 200,
  } as PaginatedQuery;

  const rows: Contract[] = [];
  let page = 1;
  let totalPages = 1;

  do {
    const result = await fetchContractsPage({
      ...seedQuery,
      page,
    });
    rows.push(...(result.data || []));
    totalPages = Math.max(1, result.meta?.total_pages || 1);
    page += 1;
  } while (page <= totalPages);

  const seen = new Set<string>();
  return rows.filter((item) => {
    const key = String(item.id ?? '');
    if (!key || seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

/**
 * Exports RACI assignments for given project IDs.
 * Handles chunking for large project ID lists (200 IDs per chunk).
 */
export async function exportProjectRaciByProjectIds(
  authUser: AuthUser,
  projectIds: Array<string | number>
): Promise<ProjectRaciRow[]> {
  if (!hasPermission(authUser, 'projects.read')) {
    throw new Error('Bạn không có quyền xuất phân công RACI dự án.');
  }

  const normalizedProjectIds = (projectIds || [])
    .map((value) => Number(value))
    .filter((value) => Number.isFinite(value) && value > 0);

  if (normalizedProjectIds.length === 0) {
    return [];
  }

  const chunkSize = 200;
  const chunks: number[][] = [];
  for (let index = 0; index < normalizedProjectIds.length; index += chunkSize) {
    chunks.push(normalizedProjectIds.slice(index, index + chunkSize));
  }

  const result: ProjectRaciRow[] = [];
  for (const chunk of chunks) {
    const rows = await fetchProjectRaciAssignments(chunk);
    result.push(...rows);
  }

  return result;
}

/**
 * Downloads exported projects as Excel file.
 */
export async function downloadProjectsExport(
  authUser: AuthUser,
  currentQuery: PaginatedQuery,
  fileName?: string
): Promise<void> {
  const projects = await exportProjectsByCurrentQuery(authUser, currentQuery);
  
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\..+/, '')
    .replace('T', '_');
  
  const name = fileName || `projects_export_${timestamp}`;
  
  downloadExcelWorkbook(name, [
    {
      name: 'Projects',
      headers: [
        'ID',
        'Mã DA',
        'Tên DA',
        'Khách hàng',
        'Trạng thái',
        'Ngày bắt đầu',
        'Ngày kết thúc (dự kiến)',
        'Ngày kết thúc (thực tế)',
      ],
      rows: projects.map((p) => [
        p.id,
        p.project_code,
        p.project_name,
        p.customer_id,
        p.status,
        p.start_date,
        p.expected_end_date,
        p.actual_end_date,
      ]),
    },
  ]);
}

/**
 * Downloads exported contracts as Excel file.
 */
export async function downloadContractsExport(
  authUser: AuthUser,
  currentQuery: PaginatedQuery,
  fileName?: string
): Promise<void> {
  const contracts = await exportContractsByCurrentQuery(authUser, currentQuery);
  
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\..+/, '')
    .replace('T', '_');
  
  const name = fileName || `contracts_export_${timestamp}`;
  
  downloadExcelWorkbook(name, [
    {
      name: 'Contracts',
      headers: [
        'ID',
        'Mã HĐ',
        'Tên HĐ',
        'Khách hàng',
        'Dự án',
        'Giá trị',
        'Trạng thái',
        'Ngày ký',
        'Ngày hết hạn',
      ],
      rows: contracts.map((c) => [
        c.id,
        c.contract_code,
        c.contract_name,
        c.customer_id,
        c.project_id,
        c.value,
        c.status,
        c.sign_date,
        c.expiry_date,
      ]),
    },
  ]);
}

/**
 * Downloads exported RACI assignments as Excel file.
 */
export async function downloadProjectRaciExport(
  authUser: AuthUser,
  projectIds: Array<string | number>,
  fileName?: string
): Promise<void> {
  const raciRows = await exportProjectRaciByProjectIds(authUser, projectIds);
  
  const timestamp = new Date()
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\..+/, '')
    .replace('T', '_');
  
  const name = fileName || `raci_export_${timestamp}`;
  
  downloadExcelWorkbook(name, [
    {
      name: 'RACI',
      headers: [
        'ID',
        'Dự án ID',
        'Nhân sự ID',
        'Username',
        'Vai trò',
        'Ngày phân công',
      ],
      rows: raciRows.map((r) => [
        r.id,
        r.project_id,
        r.user_id,
        r.username,
        r.raci_role,
        r.assigned_date,
      ]),
    },
  ]);
}
