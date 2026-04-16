import type { Employee, ProductPackage, ProjectItem, ProjectItemMaster, ProjectRACI } from '../../types';
import {
  buildProjectItemIdentityKey,
  buildProjectPackageCatalogValue,
  buildProjectItemHeaderIndex,
  findProjectImportSheet,
  getProjectItemImportCell,
  normalizeProjectItemImportToken,
  normalizeRaciRoleImport,
  withMinimumDelay,
} from './projectImportUtils';
import type { ProjectImportSummary } from './ProjectTabs';
import type {
  ImportPayload,
  ProjectItemImportBatchGroup,
  ProjectItemImportBatchResult,
  ProjectRaciImportBatchGroup,
  ProjectRaciImportBatchResult,
} from './projectImportTypes';

type ProjectImportNotify = (
  type: 'success' | 'error',
  title: string,
  message: string
) => void;

const PROJECT_IMPORT_DELAY_MS = 600;

const buildPayloadSheets = (payload: ImportPayload) =>
  (payload.sheets && payload.sheets.length > 0)
    ? payload.sheets
    : [{
        name: payload.sheetName || 'Sheet1',
        headers: payload.headers || [],
        rows: payload.rows || [],
      }];

const publishSummary = (
  summary: ProjectImportSummary,
  title: string,
  successMessage: string,
  warningMessage: string,
  errorMessage: string,
  onSetSummary: (summary: ProjectImportSummary) => void,
  onNotify?: ProjectImportNotify,
  onCloseModal?: () => void
) => {
  onSetSummary(summary);

  if (summary.success > 0) {
    onNotify?.('success', title, successMessage);
    onCloseModal?.();
  }

  if (summary.warnings.length > 0) {
    onNotify?.('error', title, warningMessage);
  }

  if (summary.errors.length > 0) {
    onNotify?.('error', title, errorMessage);
  }
};

interface ExecuteProjectItemsImportOptions {
  currentProjectCode: string;
  mode: 'ADD' | 'EDIT';
  onCloseModal?: () => void;
  onImportProjectItemsBatch?: (
    groups: ProjectItemImportBatchGroup[]
  ) => Promise<ProjectItemImportBatchResult>;
  onMergeCurrentItems: (importedItems: ProjectItem[]) => void;
  onNotify?: ProjectImportNotify;
  onSetSummary: (summary: ProjectImportSummary) => void;
  parseNumber: (value: string | number) => number;
  payload: ImportPayload;
  productLookupMap: Map<string, ProductPackage>;
  now?: () => number;
}

export const executeProjectItemsImport = async ({
  currentProjectCode,
  mode,
  onCloseModal,
  onImportProjectItemsBatch,
  onMergeCurrentItems,
  onNotify,
  onSetSummary,
  parseNumber,
  payload,
  productLookupMap,
  now = () => Date.now(),
}: ExecuteProjectItemsImportOptions): Promise<void> => {
  await withMinimumDelay(async () => {
    const lowerName = String(payload.fileName || '').toLowerCase();
    if (!lowerName.endsWith('.xlsx') && !lowerName.endsWith('.xls')) {
      const nextSummary = {
        success: 0,
        failed: 1,
        warnings: [],
        errors: ['File nhập chỉ hỗ trợ định dạng Excel (.xlsx, .xls).'],
      };
      onSetSummary(nextSummary);
      onNotify?.('error', 'Nhập hạng mục dự án', nextSummary.errors[0]);
      return;
    }

    const allSheets = buildPayloadSheets(payload);
    const hangMucSheet = findProjectImportSheet(allSheets, ['hangmuc', 'projectitem', 'item'], true) || {
      name: payload.sheetName || 'HangMuc',
      headers: payload.headers || [],
      rows: payload.rows || [],
    };
    const duAnSheet = findProjectImportSheet(allSheets, ['duan', 'project']);

    const projectCodeByToken = new Map<string, string>();
    const projectCodeByNameToken = new Map<string, string>();
    if (duAnSheet && (duAnSheet.headers || []).length > 0) {
      const projectHeaderIndex = buildProjectItemHeaderIndex(duAnSheet.headers || []);
      (duAnSheet.rows || []).forEach((row) => {
        const codeRaw = getProjectItemImportCell(row, projectHeaderIndex, ['mada', 'maduan', 'projectcode', 'code']);
        const nameRaw = getProjectItemImportCell(row, projectHeaderIndex, ['duan', 'project', 'tenduan', 'projectname', 'name']);
        const code = String(codeRaw || '').trim();
        if (!code) {
          return;
        }

        const codeToken = normalizeProjectItemImportToken(code);
        if (!projectCodeByToken.has(codeToken)) {
          projectCodeByToken.set(codeToken, code);
        }

        const nameToken = normalizeProjectItemImportToken(nameRaw);
        if (nameToken && !projectCodeByNameToken.has(nameToken)) {
          projectCodeByNameToken.set(nameToken, code);
        }
      });
    }

    const headerIndex = buildProjectItemHeaderIndex(hangMucSheet.headers || []);
    const normalizedRows = (hangMucSheet.rows || []).filter((row) =>
      (row || []).some((cell) => String(cell || '').trim().length > 0)
    );

    if (normalizedRows.length === 0) {
      const nextSummary = {
        success: 0,
        failed: 1,
        warnings: [],
        errors: ['Không có dòng dữ liệu hợp lệ để nhập.'],
      };
      onSetSummary(nextSummary);
      onNotify?.('error', 'Nhập hạng mục dự án', nextSummary.errors[0]);
      return;
    }

    const warnings: string[] = [];
    const errors: string[] = [];
    const importRowsByProject = new Map<string, {
      project_code: string;
      itemsByProduct: Map<string, ProjectItem>;
    }>();

    normalizedRows.forEach((row, rowIndex) => {
      const lineNumber = rowIndex + 2;
      const projectCodeRaw = getProjectItemImportCell(row, headerIndex, ['mada', 'maduan', 'projectcode', 'code']);
      const projectRefRaw = getProjectItemImportCell(row, headerIndex, ['duan', 'project', 'tenduan', 'projectname', 'name']);
      const productRaw = getProjectItemImportCell(row, headerIndex, [
        'magoicuoc',
        'goicuoc',
        'hangmuc',
        'mahangmuc',
        'mapackage',
        'package',
        'packagecode',
        'packagename',
        'masanpham',
        'sanpham',
        'product',
        'productcode',
        'productname',
        'product_id',
      ]);
      const quantityRaw = getProjectItemImportCell(row, headerIndex, ['soluong', 'sl', 'quantity']);
      const unitPriceRaw = getProjectItemImportCell(row, headerIndex, ['dongia', 'gia', 'unitprice', 'unit_price']);
      const discountPercentRaw = getProjectItemImportCell(row, headerIndex, [
        'ck',
        'chietkhau',
        'discountpercent',
        'discount_percent',
      ]);
      const discountAmountRaw = getProjectItemImportCell(row, headerIndex, [
        'giamgia',
        'discountamount',
        'discount_amount',
      ]);

      if (!projectCodeRaw && !projectRefRaw && !productRaw && !quantityRaw && !unitPriceRaw && !discountPercentRaw && !discountAmountRaw) {
        return;
      }

      const projectCodeToken = normalizeProjectItemImportToken(projectCodeRaw);
      const projectRefToken = normalizeProjectItemImportToken(projectRefRaw);
      let resolvedProjectCode = '';

      if (projectCodeToken && projectCodeByToken.has(projectCodeToken)) {
        resolvedProjectCode = projectCodeByToken.get(projectCodeToken) || '';
      } else if (projectCodeToken) {
        resolvedProjectCode = String(projectCodeRaw || '').trim();
      }

      if (!resolvedProjectCode && projectRefToken && projectCodeByNameToken.has(projectRefToken)) {
        resolvedProjectCode = projectCodeByNameToken.get(projectRefToken) || '';
      }

      if (resolvedProjectCode && projectRefToken && projectCodeByNameToken.has(projectRefToken)) {
        const resolvedByRef = projectCodeByNameToken.get(projectRefToken) || '';
        if (
          resolvedByRef &&
          normalizeProjectItemImportToken(resolvedByRef) !== normalizeProjectItemImportToken(resolvedProjectCode)
        ) {
          errors.push(`Dòng ${lineNumber}: Mã DA và cột Dự án không khớp nhau.`);
          return;
        }
      }

      if (!resolvedProjectCode) {
        errors.push(`Dòng ${lineNumber}: thiếu hoặc không xác định được Mã DA.`);
        return;
      }

      if (!productRaw) {
        errors.push(`Dòng ${lineNumber}: thiếu mã/tên hạng mục.`);
        return;
      }

      const product = productLookupMap.get(normalizeProjectItemImportToken(productRaw));
      if (!product) {
        errors.push(`Dòng ${lineNumber}: không tìm thấy hạng mục "${productRaw}".`);
        return;
      }

      const quantity = parseNumber(quantityRaw);
      if (!Number.isFinite(quantity) || quantity <= 0) {
        errors.push(`Dòng ${lineNumber}: số lượng phải lớn hơn 0.`);
        return;
      }

      const unitPrice = unitPriceRaw === '' ? 0 : parseNumber(unitPriceRaw);
      if (!Number.isFinite(unitPrice) || unitPrice < 0) {
        errors.push(`Dòng ${lineNumber}: đơn giá phải lớn hơn hoặc bằng 0.`);
        return;
      }

      const baseTotal = quantity * unitPrice;
      let discountPercent = discountPercentRaw === '' ? 0 : parseNumber(discountPercentRaw);
      if (!Number.isFinite(discountPercent)) {
        discountPercent = 0;
      }
      if (discountPercent < 0 || discountPercent > 100) {
        const clamped = Math.min(100, Math.max(0, discountPercent));
        warnings.push(`Dòng ${lineNumber}: % CK vượt ngưỡng, đã tự điều chỉnh về ${clamped}.`);
        discountPercent = clamped;
      }

      let discountAmount = discountAmountRaw === '' ? null : parseNumber(discountAmountRaw);
      if (discountAmount !== null && !Number.isFinite(discountAmount)) {
        discountAmount = 0;
      }

      let discountMode: ProjectItem['discountMode'] = undefined;
      if (discountAmount !== null) {
        if (discountAmount < 0 || discountAmount > baseTotal) {
          const clamped = Math.min(baseTotal, Math.max(0, discountAmount));
          warnings.push(`Dòng ${lineNumber}: Giảm giá vượt ngưỡng, đã tự điều chỉnh.`);
          discountAmount = clamped;
        }
        discountPercent = baseTotal > 0 ? Number(((discountAmount / baseTotal) * 100).toFixed(2)) : 0;
        discountMode = discountAmount > 0 ? 'AMOUNT' : undefined;
      } else {
        discountAmount = Math.round(baseTotal * (discountPercent / 100));
        discountMode = discountPercent > 0 ? 'PERCENT' : undefined;
      }

      const lineTotal = Math.max(0, baseTotal - (discountAmount || 0));
      const productKey = buildProjectItemIdentityKey({
        productId: String(product.product_id),
        productPackageId: String(product.id),
        product_id: String(product.product_id),
        product_package_id: String(product.id),
      });
      const normalizedProjectCode = String(resolvedProjectCode).trim().toUpperCase();
      const normalizedProjectToken = normalizeProjectItemImportToken(normalizedProjectCode);
      const projectGroup = importRowsByProject.get(normalizedProjectToken) || {
        project_code: normalizedProjectCode,
        itemsByProduct: new Map<string, ProjectItem>(),
      };

      if (projectGroup.itemsByProduct.has(productKey)) {
        warnings.push(`Dòng ${lineNumber}: hạng mục "${productRaw}" bị trùng trong dự án "${normalizedProjectCode}", hệ thống dùng dòng sau.`);
      }

      projectGroup.itemsByProduct.set(productKey, {
        id: `ITEM_${now()}_${lineNumber}`,
        productId: String(product.product_id),
        productPackageId: String(product.id),
        catalogValue: buildProjectPackageCatalogValue(product.id),
        product_id: String(product.product_id),
        product_package_id: String(product.id),
        quantity,
        unitPrice,
        discountPercent,
        discountAmount: discountAmount || 0,
        lineTotal,
        discountMode,
      });
      importRowsByProject.set(normalizedProjectToken, projectGroup);
    });

    if (importRowsByProject.size === 0) {
      const nextSummary = {
        success: 0,
        failed: errors.length || 1,
        warnings,
        errors: errors.length > 0 ? errors : ['Không có dòng hợp lệ để nhập từ file Excel.'],
      };
      onSetSummary(nextSummary);
      onNotify?.('error', 'Nhập hạng mục dự án', nextSummary.errors[0]);
      return;
    }

    const groupedPayload: ProjectItemImportBatchGroup[] = Array.from(importRowsByProject.values()).map((group) => ({
      project_code: group.project_code,
      items: Array.from(group.itemsByProduct.values()).map((item) => ({
        product_id: Number(item.productId),
        product_package_id: item.productPackageId ? Number(item.productPackageId) : undefined,
        quantity: Number(item.quantity) || 0,
        unit_price: Number(item.unitPrice) || 0,
      })),
    }));

    const currentProjectToken = normalizeProjectItemImportToken(currentProjectCode || '');
    let batchResult: ProjectItemImportBatchResult | null = null;
    if (mode === 'EDIT' && onImportProjectItemsBatch) {
      batchResult = await onImportProjectItemsBatch(groupedPayload);
    }

    const successfulProjectTokens = new Set<string>();
    if (batchResult) {
      (batchResult.success_projects || []).forEach((item) => {
        const token = normalizeProjectItemImportToken(item.project_code);
        if (token) {
          successfulProjectTokens.add(token);
        }
      });
    } else if (mode === 'ADD') {
      if (currentProjectToken && importRowsByProject.has(currentProjectToken)) {
        successfulProjectTokens.add(currentProjectToken);
        const skippedProjects = importRowsByProject.size - 1;
        if (skippedProjects > 0) {
          warnings.push(`Đã bỏ qua ${skippedProjects} dự án khác trong file vì dự án mới chưa được lưu lên hệ thống.`);
        }
      } else if (!currentProjectToken) {
        errors.push('Vui lòng nhập Mã DA ở tab Thông tin chung trước khi nhập hạng mục.');
      } else {
        errors.push('Không tìm thấy dòng hạng mục nào khớp với Mã DA đang tạo.');
      }
    } else {
      groupedPayload.forEach((item) => {
        const token = normalizeProjectItemImportToken(item.project_code);
        if (token) {
          successfulProjectTokens.add(token);
        }
      });
    }

    if (currentProjectToken) {
      const currentProjectGroup = importRowsByProject.get(currentProjectToken);
      const shouldMergeCurrent = Boolean(currentProjectGroup) && (
        mode === 'ADD' || successfulProjectTokens.has(currentProjectToken)
      );

      if (currentProjectGroup && shouldMergeCurrent) {
        onMergeCurrentItems(Array.from(currentProjectGroup.itemsByProduct.values()));
      }
    }

    if (batchResult?.failed_projects?.length) {
      batchResult.failed_projects.forEach((item) => {
        errors.push(`Dự án ${item.project_code}: ${item.message}`);
      });
    }

    if (importRowsByProject.size > 1) {
      warnings.push(`Đã xử lý ${importRowsByProject.size} dự án trong cùng một lần import theo Mã DA.`);
    }

    let successCount = 0;
    if (successfulProjectTokens.size > 0) {
      importRowsByProject.forEach((group, token) => {
        if (successfulProjectTokens.has(token)) {
          successCount += group.itemsByProduct.size;
        }
      });
    }

    const nextSummary = {
      success: successCount,
      failed: errors.length,
      warnings,
      errors,
    };

    publishSummary(
      nextSummary,
      'Nhập hạng mục dự án',
      `Đã áp dụng ${nextSummary.success} dòng hạng mục.`,
      `Có ${nextSummary.warnings.length} cảnh báo. Vui lòng kiểm tra lại danh sách hạng mục.`,
      `Có ${nextSummary.errors.length} dòng lỗi đã được bỏ qua.`,
      onSetSummary,
      onNotify,
      nextSummary.success > 0 ? onCloseModal : undefined
    );
  }, PROJECT_IMPORT_DELAY_MS);
};

interface ExecuteProjectRaciImportOptions {
  currentProjectCode: string;
  employeeLookupMap: Map<string, Employee>;
  mode: 'ADD' | 'EDIT';
  onCloseModal?: () => void;
  onImportProjectRaciBatch?: (
    groups: ProjectRaciImportBatchGroup[]
  ) => Promise<ProjectRaciImportBatchResult>;
  onMergeCurrentRaci: (importedRaci: ProjectRACI[]) => void;
  onNotify?: ProjectImportNotify;
  onSetSummary: (summary: ProjectImportSummary) => void;
  payload: ImportPayload;
  projectItemLookupByCode: Map<string, ProjectItemMaster[]>;
  now?: () => number;
  todayLabel?: string;
}

export const executeProjectRaciImport = async ({
  currentProjectCode,
  employeeLookupMap,
  mode,
  onCloseModal,
  onImportProjectRaciBatch,
  onMergeCurrentRaci,
  onNotify,
  onSetSummary,
  payload,
  projectItemLookupByCode,
  now = () => Date.now(),
  todayLabel = new Date().toLocaleDateString('vi-VN'),
}: ExecuteProjectRaciImportOptions): Promise<void> => {
  await withMinimumDelay(async () => {
    const lowerName = String(payload.fileName || '').toLowerCase();
    if (!lowerName.endsWith('.xlsx') && !lowerName.endsWith('.xls')) {
      const nextSummary = {
        success: 0,
        failed: 1,
        warnings: [],
        errors: ['File nhập chỉ hỗ trợ định dạng Excel (.xlsx, .xls).'],
      };
      onSetSummary(nextSummary);
      onNotify?.('error', 'Nhập đội ngũ dự án', nextSummary.errors[0]);
      return;
    }

    const allSheets = buildPayloadSheets(payload);
    const raciSheet = findProjectImportSheet(allSheets, ['raci', 'doingu', 'nhansu'], true) || {
      name: payload.sheetName || 'RACI',
      headers: payload.headers || [],
      rows: payload.rows || [],
    };
    const maHangMucSheet = findProjectImportSheet(allSheets, ['mahangmuc', 'hangmuc', 'projectitem', 'item']);

    if (!maHangMucSheet || (maHangMucSheet.headers || []).length === 0) {
      const nextSummary = {
        success: 0,
        failed: 1,
        warnings: [],
        errors: ['Thiếu sheet tham chiếu "MaHangMuc". Vui lòng dùng đúng file mẫu đội ngũ dự án.'],
      };
      onSetSummary(nextSummary);
      onNotify?.('error', 'Nhập đội ngũ dự án', nextSummary.errors[0]);
      return;
    }

    const warnings: string[] = [];
    const errors: string[] = [];

    const maHangMucHeaderIndex = buildProjectItemHeaderIndex(maHangMucSheet.headers || []);
    const maHangMucRows = (maHangMucSheet.rows || []).filter((row) =>
      (row || []).some((cell) => String(cell || '').trim().length > 0)
    );
    const maHangMucByToken = new Map<string, { code: string; name: string }>();
    maHangMucRows.forEach((row, rowIndex) => {
      const lineNumber = rowIndex + 2;
      const itemCodeRaw = getProjectItemImportCell(row, maHangMucHeaderIndex, [
        'mahangmucduan',
        'mahangmuc',
        'hangmucduan',
        'projectitemcode',
        'projectitemid',
        'projectitem',
        'itemcode',
        'itemid',
      ]);
      const itemNameRaw = getProjectItemImportCell(row, maHangMucHeaderIndex, [
        'tenhangmucduan',
        'tenhangmuc',
        'hangmucduan',
        'projectitemname',
        'itemname',
        'name',
      ]);

      if (!itemCodeRaw && !itemNameRaw) {
        return;
      }
      if (!itemCodeRaw) {
        errors.push(`Sheet MaHangMuc dòng ${lineNumber}: thiếu Mã hạng mục dự án.`);
        return;
      }

      const itemCode = String(itemCodeRaw || '').trim();
      const token = normalizeProjectItemImportToken(itemCode);
      if (!token) {
        errors.push(`Sheet MaHangMuc dòng ${lineNumber}: Mã hạng mục dự án không hợp lệ.`);
        return;
      }

      if (maHangMucByToken.has(token)) {
        warnings.push(`Sheet MaHangMuc dòng ${lineNumber}: mã hạng mục "${itemCode}" bị trùng, hệ thống dùng dòng sau.`);
      }

      maHangMucByToken.set(token, {
        code: itemCode,
        name: String(itemNameRaw || '').trim(),
      });
    });

    if (maHangMucByToken.size === 0) {
      const nextSummary = {
        success: 0,
        failed: errors.length || 1,
        warnings,
        errors: errors.length > 0 ? errors : ['Sheet MaHangMuc chưa có dữ liệu hợp lệ.'],
      };
      onSetSummary(nextSummary);
      onNotify?.('error', 'Nhập đội ngũ dự án', nextSummary.errors[0]);
      return;
    }

    const headerIndex = buildProjectItemHeaderIndex(raciSheet.headers || []);
    const normalizedRows = (raciSheet.rows || []).filter((row) =>
      (row || []).some((cell) => String(cell || '').trim().length > 0)
    );

    if (normalizedRows.length === 0) {
      const nextSummary = {
        success: 0,
        failed: 1,
        warnings,
        errors: ['Không có dòng dữ liệu hợp lệ để nhập.'],
      };
      onSetSummary(nextSummary);
      onNotify?.('error', 'Nhập đội ngũ dự án', nextSummary.errors[0]);
      return;
    }

    const importRowsByProject = new Map<string, {
      project_code: string;
      raciByIdentity: Map<string, {
        project_item_id: string | number;
        user_id: number;
        raci_role: 'R' | 'A' | 'C' | 'I';
        assignedDate: string;
      }>;
    }>();

    normalizedRows.forEach((row, rowIndex) => {
      const lineNumber = rowIndex + 2;
      const projectItemCodeRaw = getProjectItemImportCell(row, headerIndex, [
        'mahangmucduan',
        'mahangmuc',
        'hangmucduan',
        'projectitemcode',
        'projectitemid',
        'projectitem',
        'itemcode',
        'itemid',
      ]);
      const userRaw = getProjectItemImportCell(row, headerIndex, [
        'manhansu',
        'usercode',
        'userid',
        'nhansu',
        'employee',
        'user',
      ]);
      const roleRaw = getProjectItemImportCell(row, headerIndex, ['vaitroraci', 'vaitro', 'racirole', 'role']);
      const assignedDateRaw = getProjectItemImportCell(row, headerIndex, ['ngayphancong', 'assigneddate', 'ngaygiao']);

      if (!projectItemCodeRaw && !userRaw && !roleRaw && !assignedDateRaw) {
        return;
      }
      if (!projectItemCodeRaw) {
        errors.push(`Dòng ${lineNumber}: thiếu Mã hạng mục dự án.`);
        return;
      }

      const projectItemToken = normalizeProjectItemImportToken(projectItemCodeRaw);
      const referenceItem = maHangMucByToken.get(projectItemToken);
      if (!referenceItem) {
        errors.push(`Dòng ${lineNumber}: mã hạng mục "${projectItemCodeRaw}" không tồn tại trong sheet MaHangMuc.`);
        return;
      }

      const itemCandidates = projectItemLookupByCode.get(projectItemToken) || [];
      if (itemCandidates.length === 0) {
        errors.push(`Dòng ${lineNumber}: không tìm thấy mã hạng mục "${referenceItem.code}" trong hệ thống.`);
        return;
      }
      if (itemCandidates.length > 1) {
        const projectHints = Array.from(new Set(itemCandidates
          .map((candidate) => String(candidate.project_code || '').trim().toUpperCase())
          .filter((value) => value.length > 0)
        ));
        const hintText = projectHints.length > 0 ? ` (${projectHints.slice(0, 3).join(', ')})` : '';
        errors.push(`Dòng ${lineNumber}: mã hạng mục "${referenceItem.code}" bị trùng trên nhiều dự án${hintText}.`);
        return;
      }

      if (!userRaw) {
        errors.push(`Dòng ${lineNumber}: thiếu mã/tên nhân sự.`);
        return;
      }

      const raciRole = normalizeRaciRoleImport(roleRaw);
      if (!raciRole) {
        errors.push(`Dòng ${lineNumber}: vai trò RACI không hợp lệ (chỉ nhận R/A/C/I).`);
        return;
      }

      const employee = employeeLookupMap.get(normalizeProjectItemImportToken(userRaw));
      if (!employee) {
        errors.push(`Dòng ${lineNumber}: không tìm thấy nhân sự "${userRaw}".`);
        return;
      }

      const employeeId = Number(employee.id);
      if (!Number.isFinite(employeeId) || employeeId <= 0) {
        errors.push(`Dòng ${lineNumber}: mã nhân sự "${userRaw}" không hợp lệ.`);
        return;
      }

      const projectItem = itemCandidates[0];
      const source = projectItem as unknown as Record<string, unknown>;
      const resolvedProjectCode = String(projectItem.project_code || '').trim().toUpperCase();
      if (!resolvedProjectCode) {
        errors.push(`Dòng ${lineNumber}: không xác định được dự án từ mã hạng mục "${referenceItem.code}".`);
        return;
      }

      const referenceNameToken = normalizeProjectItemImportToken(referenceItem.name);
      const systemItemName = String(
        source.project_item_name ||
        source.item_name ||
        projectItem.display_name ||
        projectItem.product_name ||
        ''
      ).trim();
      const systemItemNameToken = normalizeProjectItemImportToken(systemItemName);
      if (referenceNameToken && systemItemNameToken && referenceNameToken !== systemItemNameToken) {
        warnings.push(`Dòng ${lineNumber}: tên hạng mục "${referenceItem.name}" khác dữ liệu hệ thống "${systemItemName}".`);
      }

      const assignedDate = String(assignedDateRaw || '').trim() || todayLabel;
      const normalizedProjectToken = normalizeProjectItemImportToken(resolvedProjectCode);
      const group = importRowsByProject.get(normalizedProjectToken) || {
        project_code: resolvedProjectCode,
        raciByIdentity: new Map<string, {
          project_item_id: string | number;
          user_id: number;
          raci_role: 'R' | 'A' | 'C' | 'I';
          assignedDate: string;
        }>(),
      };
      const identity = `${employeeId}|${raciRole}`;

      if (group.raciByIdentity.has(identity)) {
        warnings.push(`Dòng ${lineNumber}: nhân sự "${userRaw}" trùng vai trò "${raciRole}" trong dự án "${resolvedProjectCode}", hệ thống dùng dòng sau.`);
      }

      group.raciByIdentity.set(identity, {
        project_item_id: projectItem.id,
        user_id: employeeId,
        raci_role: raciRole,
        assignedDate,
      });
      importRowsByProject.set(normalizedProjectToken, group);
    });

    if (importRowsByProject.size === 0) {
      const nextSummary = {
        success: 0,
        failed: errors.length || 1,
        warnings,
        errors: errors.length > 0 ? errors : ['Không có dòng hợp lệ để nhập từ file Excel.'],
      };
      onSetSummary(nextSummary);
      onNotify?.('error', 'Nhập đội ngũ dự án', nextSummary.errors[0]);
      return;
    }

    const groupedPayload: ProjectRaciImportBatchGroup[] = Array.from(importRowsByProject.values()).map((group) => ({
      project_code: group.project_code,
      raci: Array.from(group.raciByIdentity.values()).map((entry) => ({
        project_item_id: entry.project_item_id,
        user_id: entry.user_id,
        raci_role: entry.raci_role,
      })),
    }));

    const currentProjectToken = normalizeProjectItemImportToken(currentProjectCode || '');
    let batchResult: ProjectRaciImportBatchResult | null = null;
    if (mode === 'EDIT' && onImportProjectRaciBatch) {
      batchResult = await onImportProjectRaciBatch(groupedPayload);
    }

    const successfulProjectTokens = new Set<string>();
    if (batchResult) {
      (batchResult.success_projects || []).forEach((item) => {
        const token = normalizeProjectItemImportToken(item.project_code);
        if (token) {
          successfulProjectTokens.add(token);
        }
      });
    } else if (mode === 'ADD') {
      if (currentProjectToken && importRowsByProject.has(currentProjectToken)) {
        successfulProjectTokens.add(currentProjectToken);
        const skippedProjects = importRowsByProject.size - 1;
        if (skippedProjects > 0) {
          warnings.push(`Đã bỏ qua ${skippedProjects} dự án khác trong file vì dự án mới chưa được lưu lên hệ thống.`);
        }
      } else if (!currentProjectToken) {
        errors.push('Vui lòng nhập Mã DA ở tab Thông tin chung trước khi nhập đội ngũ dự án.');
      } else {
        errors.push('Không tìm thấy dòng đội ngũ nào khớp với Mã DA đang tạo.');
      }
    } else {
      groupedPayload.forEach((item) => {
        const token = normalizeProjectItemImportToken(item.project_code);
        if (token) {
          successfulProjectTokens.add(token);
        }
      });
    }

    if (currentProjectToken) {
      const currentProjectGroup = importRowsByProject.get(currentProjectToken);
      const shouldMergeCurrent = Boolean(currentProjectGroup) && (
        mode === 'ADD' || successfulProjectTokens.has(currentProjectToken)
      );

      if (currentProjectGroup && shouldMergeCurrent) {
        const importedRaci = Array.from(currentProjectGroup.raciByIdentity.values()).map((entry) => ({
          id: `RACI_${now()}_${entry.user_id}_${entry.raci_role}`,
          userId: String(entry.user_id),
          roleType: entry.raci_role,
          assignedDate: entry.assignedDate,
        } as ProjectRACI));
        onMergeCurrentRaci(importedRaci);
      }
    }

    if (batchResult?.failed_projects?.length) {
      batchResult.failed_projects.forEach((item) => {
        errors.push(`Dự án ${item.project_code}: ${item.message}`);
      });
    }

    if (importRowsByProject.size > 1) {
      warnings.push(`Đã xử lý ${importRowsByProject.size} dự án trong cùng một lần import theo Mã hạng mục dự án.`);
    }

    let successCount = 0;
    if (successfulProjectTokens.size > 0) {
      importRowsByProject.forEach((group, token) => {
        if (successfulProjectTokens.has(token)) {
          successCount += group.raciByIdentity.size;
        }
      });
    }

    const nextSummary = {
      success: successCount,
      failed: errors.length,
      warnings,
      errors,
    };

    publishSummary(
      nextSummary,
      'Nhập đội ngũ dự án',
      `Đã áp dụng ${nextSummary.success} dòng phân công RACI.`,
      `Có ${nextSummary.warnings.length} cảnh báo. Vui lòng kiểm tra lại dữ liệu.`,
      `Có ${nextSummary.errors.length} dòng lỗi đã được bỏ qua.`,
      onSetSummary,
      onNotify,
      nextSummary.success > 0 ? onCloseModal : undefined
    );
  }, PROJECT_IMPORT_DELAY_MS);
};
