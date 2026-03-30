import { useCallback } from 'react';
import type * as React from 'react';
import type { EmployeePartyProfile } from '../types';
import type { ImportPayload } from '../components/Modals';
import { buildHeaderIndex, exportImportFailureFile, getImportCell, summarizeImportResult } from '../utils/importValidation';
import { bulkUpsertEmployeePartyProfiles } from '../services/v5Api';

interface UseImportEmployeePartyProfilesResult {
  handleImportEmployeePartyProfiles: (
    payload: ImportPayload,
    addToast: (type: 'success' | 'error', title: string, message: string) => void,
    setImportLoadingText: (text: string) => void,
    setIsSaving: (saving: boolean) => void,
    setPartyProfiles: React.Dispatch<React.SetStateAction<EmployeePartyProfile[]>>,
    loadPartyProfilesPage: () => Promise<void>,
    handleCloseModal: () => void
  ) => Promise<void>;
}

export function useImportEmployeePartyProfiles(): UseImportEmployeePartyProfilesResult {
  const handleImportEmployeePartyProfiles = useCallback(async (
    payload: ImportPayload,
    addToast: (type: 'success' | 'error', title: string, message: string) => void,
    setImportLoadingText: (text: string) => void,
    setIsSaving: (saving: boolean) => void,
    setPartyProfiles: React.Dispatch<React.SetStateAction<EmployeePartyProfile[]>>,
    loadPartyProfilesPage: () => Promise<void>,
    handleCloseModal: () => void
  ) => {
    const headerIndex = buildHeaderIndex(payload.headers || []);
    const rows = payload.rows || [];
    const failures: string[] = [];
    const importItems: Array<Partial<EmployeePartyProfile> & { employee_code: string }> = [];
    const seenEmployeeCodes = new Set<string>();

    for (let rowIndex = 0; rowIndex < rows.length; rowIndex += 1) {
      const row = rows[rowIndex];
      const rowNumber = rowIndex + 2;

      const employeeCode = getImportCell(row, headerIndex, ['manv', 'manhanvien', 'usercode', 'employeecode', 'code']);
      const fileFullName = getImportCell(row, headerIndex, ['hovaten', 'hoten', 'fullname', 'name']);
      const partyCardNumber = getImportCell(row, headerIndex, ['sothedang', 'partycardnumber', 'sothe']);
      const hometown = getImportCell(row, headerIndex, ['quequan', 'hometown']);
      const ethnicity = getImportCell(row, headerIndex, ['dantoc', 'ethnicity']);
      const religion = getImportCell(row, headerIndex, ['tongiao', 'religion']);
      const professionalQualification = getImportCell(row, headerIndex, ['trinhdochuyenmon', 'trinhdo', 'professionalqualification']);
      const politicalTheoryLevel = getImportCell(row, headerIndex, ['llct', 'lyluanchinhtri', 'politicaltheorylevel']);
      const notes = getImportCell(row, headerIndex, ['ghichu', 'notes']);

      if (
        !employeeCode &&
        !fileFullName &&
        !partyCardNumber &&
        !hometown &&
        !ethnicity &&
        !religion &&
        !professionalQualification &&
        !politicalTheoryLevel &&
        !notes
      ) {
        continue;
      }

      if (!employeeCode) {
        failures.push(`Dòng ${rowNumber}: thiếu Mã NV.`);
        continue;
      }

      const normalizedEmployeeCode = employeeCode.trim().toUpperCase();
      if (seenEmployeeCodes.has(normalizedEmployeeCode)) {
        failures.push(`Dòng ${rowNumber}: Mã NV "${employeeCode}" bị trùng trong file.`);
        continue;
      }
      seenEmployeeCodes.add(normalizedEmployeeCode);

      importItems.push({
        employee_code: normalizedEmployeeCode,
        party_card_number: partyCardNumber || null,
        hometown: hometown || null,
        ethnicity: ethnicity || null,
        religion: religion || null,
        professional_qualification: professionalQualification || null,
        political_theory_level: politicalTheoryLevel || null,
        notes: notes || null,
      });
    }

    if (importItems.length === 0) {
      summarizeImportResult('Đảng viên', 0, failures.length > 0 ? failures : ['Không có dòng dữ liệu hợp lệ để nhập.'], addToast);
      exportImportFailureFile(payload, 'Đảng viên', failures, addToast);
      return;
    }

    setIsSaving(true);
    setImportLoadingText(`Đang nhập Đảng viên: 0/${importItems.length}`);
    try {
      const result = await bulkUpsertEmployeePartyProfiles(importItems);
      const createdItems = result.created || [];
      const rowResults = result.results || [];

      rowResults.forEach((rowResult) => {
        if (rowResult.success) {
          return;
        }
        const rowNumber = Number(rowResult.index) + 2;
        failures.push(`Dòng ${rowNumber}: ${rowResult.message || 'Dữ liệu không hợp lệ.'}`);
      });

      setImportLoadingText(`Đang nhập Đảng viên: ${createdItems.length}/${importItems.length}`);
      if (createdItems.length > 0) {
        setPartyProfiles((prev) => [...createdItems, ...(prev || [])]);
        await loadPartyProfilesPage();
      }

      summarizeImportResult('Đảng viên', createdItems.length, failures, addToast);
      exportImportFailureFile(payload, 'Đảng viên', failures, addToast);
      if (createdItems.length > 0 && failures.length === 0) {
        handleCloseModal();
      }
    } finally {
      setIsSaving(false);
      setImportLoadingText('');
    }
  }, []);

  return { handleImportEmployeePartyProfiles };
}
