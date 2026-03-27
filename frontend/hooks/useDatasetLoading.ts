import { useState, useCallback, useRef } from 'react';
import type { AuthUser, Product } from '../types';
import {
  fetchDepartments,
  fetchEmployees,
  fetchBusinesses,
  fetchVendors,
  fetchProducts,
  fetchCustomers,
  fetchCustomerPersonnel,
  fetchProjects,
  fetchProjectItems,
  fetchContracts,
  fetchPaymentSchedules,
  fetchDocuments,
  fetchReminders,
  fetchUserDeptHistory,
  fetchAuditLogs,
  fetchSupportServiceGroups,
  fetchSupportContactPositions,
  fetchSupportRequestStatuses,
  fetchProjectTypes,
  fetchWorklogActivityTypes,
  fetchSupportSlaConfigs,
  fetchRoles,
  fetchPermissions,
  fetchUserAccess,
  fetchBackblazeB2IntegrationSettings,
  fetchGoogleDriveIntegrationSettings,
  fetchContractExpiryAlertSettings,
  fetchContractPaymentAlertSettings,
} from '../services/v5Api';
import { normalizeProductUnitForSave } from '../utils/productUnit';
import { DEFAULT_PRODUCT_SERVICE_GROUP, normalizeProductServiceGroup } from '../utils/productServiceGroup';
import { hasPermission } from '../utils/authorization';

interface UseDatasetLoadingReturn {
  datasetLoadingByKey: Record<string, boolean>;
  ensureDatasetLoaded: (datasetKey: string, forceReload?: boolean) => Promise<void>;
  loadDatasets: (datasetKeys: string[], forceReloadTargets?: Set<string>) => Promise<void>;
  resetDatasetLoading: () => void;
}

export function useDatasetLoading(
  authUser: AuthUser | null,
  passwordChangeRequired: boolean,
  setters: {
    setDepartments: (depts: any[]) => void;
    setEmployees: (emps: any[]) => void;
    setBusinesses: (bizs: any[]) => void;
    setVendors: (vends: any[]) => void;
    setProducts: (prods: any[]) => void;
    setCustomers: (custs: any[]) => void;
    setCusPersonnel: (personnel: any[]) => void;
    setProjects: (projs: any[]) => void;
    setProjectItems: (items: any[]) => void;
    setContracts: (contracts: any[]) => void;
    setPaymentSchedules: (schedules: any[]) => void;
    setDocuments: (docs: any[]) => void;
    setReminders: (rems: any[]) => void;
    setUserDeptHistory: (history: any[]) => void;
    setAuditLogs: (logs: any[]) => void;
    setSupportServiceGroups: (groups: any[]) => void;
    setSupportContactPositions: (positions: any[]) => void;
    setSupportRequestStatuses: (statuses: any[]) => void;
    setProjectTypes: (types: any[]) => void;
    setWorklogActivityTypes: (types: any[]) => void;
    setSupportSlaConfigs: (configs: any[]) => void;
    setRoles: (roles: any[]) => void;
    setPermissions: (perms: any[]) => void;
    setUserAccessRecords: (records: any[]) => void;
    setBackblazeB2Settings: (settings: any) => void;
    setGoogleDriveSettings: (settings: any) => void;
    setContractExpiryAlertSettings: (settings: any) => void;
    setContractPaymentAlertSettings: (settings: any) => void;
  }
): UseDatasetLoadingReturn {
  const [datasetLoadingByKey, setDatasetLoadingByKey] = useState<Record<string, boolean>>({});
  const loadedModulesRef = useRef<Set<string>>(new Set());
  const datasetLoadInFlightRef = useRef<Record<string, Promise<void>>>({});

  const updateDatasetLoadingState = useCallback((datasetKey: string, isLoading: boolean) => {
    setDatasetLoadingByKey((prev) => {
      const currentValue = Boolean(prev[datasetKey]);
      if (currentValue === isLoading) {
        return prev;
      }

      if (isLoading) {
        return {
          ...prev,
          [datasetKey]: true,
        };
      }

      const next = { ...prev };
      delete next[datasetKey];
      return next;
    });
  }, []);

  const ensureDatasetLoaded = useCallback(async (datasetKey: string, forceReload = false): Promise<void> => {
    if (!authUser || passwordChangeRequired) {
      return;
    }

    if (!forceReload && loadedModulesRef.current.has(datasetKey)) {
      return;
    }

    const inFlightPromise = datasetLoadInFlightRef.current[datasetKey];
    if (inFlightPromise) {
      updateDatasetLoadingState(datasetKey, true);
      try {
        await inFlightPromise;
      } finally {
        if (!datasetLoadInFlightRef.current[datasetKey]) {
          updateDatasetLoadingState(datasetKey, false);
        }
      }
      return;
    }

    updateDatasetLoadingState(datasetKey, true);

    const loaderPromise = (async () => {
      if (!forceReload) {
        loadedModulesRef.current.add(datasetKey);
      }

      try {
        switch (datasetKey) {
          case 'departments': {
            const rows = await fetchDepartments();
            setters.setDepartments(rows || []);
            break;
          }
          case 'employees': {
            const rows = await fetchEmployees();
            setters.setEmployees(rows || []);
            break;
          }
          case 'businesses': {
            const rows = await fetchBusinesses();
            setters.setBusinesses(rows || []);
            break;
          }
          case 'vendors': {
            const rows = await fetchVendors();
            setters.setVendors(rows || []);
            break;
          }
          case 'products': {
            const rows = await fetchProducts();
            setters.setProducts((rows || []).map(normalizeProductRecord));
            break;
          }
          case 'customers': {
            const rows = await fetchCustomers();
            setters.setCustomers(rows || []);
            break;
          }
          case 'customerPersonnel': {
            const rows = await fetchCustomerPersonnel();
            setters.setCusPersonnel(
              (rows || []).map((item) => ({
                ...item,
                birthday: normalizeImportDate(String(item?.birthday || '')) || String(item?.birthday || '').trim(),
              }))
            );
            break;
          }
          case 'projects': {
            const rows = await fetchProjects();
            setters.setProjects(rows || []);
            break;
          }
          case 'projectItems': {
            const rows = await fetchProjectItems();
            setters.setProjectItems(rows || []);
            break;
          }
          case 'contracts': {
            const rows = await fetchContracts();
            setters.setContracts(rows || []);
            break;
          }
          case 'paymentSchedules': {
            const rows = await fetchPaymentSchedules();
            setters.setPaymentSchedules(rows || []);
            break;
          }
          case 'documents': {
            const rows = await fetchDocuments();
            setters.setDocuments(rows || []);
            break;
          }
          case 'reminders': {
            const rows = await fetchReminders();
            setters.setReminders(rows || []);
            break;
          }
          case 'userDeptHistory': {
            const rows = await fetchUserDeptHistory();
            setters.setUserDeptHistory(rows || []);
            break;
          }
          case 'auditLogs': {
            const rows = await fetchAuditLogs();
            setters.setAuditLogs(rows || []);
            break;
          }
          case 'supportServiceGroups': {
            const rows = await fetchSupportServiceGroups(true);
            setters.setSupportServiceGroups(rows || []);
            break;
          }
          case 'supportContactPositions': {
            const rows = await fetchSupportContactPositions(true);
            setters.setSupportContactPositions(rows || []);
            break;
          }
          case 'supportRequestStatuses': {
            const rows = await fetchSupportRequestStatuses(true);
            setters.setSupportRequestStatuses(rows || []);
            break;
          }
          case 'projectTypes': {
            const rows = await fetchProjectTypes(true);
            setters.setProjectTypes(rows || []);
            break;
          }
          case 'worklogActivityTypes': {
            const rows = await fetchWorklogActivityTypes(true);
            setters.setWorklogActivityTypes(rows || []);
            break;
          }
          case 'supportSlaConfigs': {
            const rows = await fetchSupportSlaConfigs(true);
            setters.setSupportSlaConfigs(rows || []);
            break;
          }
          case 'roles': {
            const rows = await fetchRoles();
            setters.setRoles(rows || []);
            break;
          }
          case 'permissions': {
            const rows = await fetchPermissions();
            setters.setPermissions(rows || []);
            break;
          }
          case 'userAccess': {
            const rows = await fetchUserAccess();
            setters.setUserAccessRecords(rows || []);
            break;
          }
          case 'backblazeB2Settings': {
            const settings = await fetchBackblazeB2IntegrationSettings().catch(() => null);
            setters.setBackblazeB2Settings(settings);
            break;
          }
          case 'googleDriveSettings': {
            const settings = await fetchGoogleDriveIntegrationSettings().catch(() => null);
            setters.setGoogleDriveSettings(settings);
            break;
          }
          case 'contractExpiryAlertSettings': {
            const settings = await fetchContractExpiryAlertSettings().catch(() => null);
            setters.setContractExpiryAlertSettings(settings);
            break;
          }
          case 'contractPaymentAlertSettings': {
            const settings = await fetchContractPaymentAlertSettings().catch(() => null);
            setters.setContractPaymentAlertSettings(settings);
            break;
          }
          default:
            return;
        }
      } catch (err) {
        if (!forceReload) {
          loadedModulesRef.current.delete(datasetKey);
        }
        throw err;
      }
    })();

    datasetLoadInFlightRef.current[datasetKey] = loaderPromise;
    try {
      await loaderPromise;
    } finally {
      if (datasetLoadInFlightRef.current[datasetKey] === loaderPromise) {
        delete datasetLoadInFlightRef.current[datasetKey];
      }
      if (!datasetLoadInFlightRef.current[datasetKey]) {
        updateDatasetLoadingState(datasetKey, false);
      }
    }
  }, [authUser, passwordChangeRequired, setters, updateDatasetLoadingState]);

  const loadDatasets = useCallback(async (datasetKeys: string[], forceReloadTargets: Set<string> = new Set()): Promise<void> => {
    const uniqueTargets = Array.from(new Set(datasetKeys.filter(Boolean)));
    if (uniqueTargets.length === 0) {
      return;
    }

    await Promise.allSettled(uniqueTargets.map((key) => ensureDatasetLoaded(key, forceReloadTargets.has(key))));
  }, [ensureDatasetLoaded]);

  const resetDatasetLoading = useCallback(() => {
    loadedModulesRef.current = new Set();
    datasetLoadInFlightRef.current = {};
    setDatasetLoadingByKey({});
  }, []);

  return {
    datasetLoadingByKey,
    ensureDatasetLoaded,
    loadDatasets,
    resetDatasetLoading,
  };
}

/**
 * Normalizes a product record with proper typing and formatting.
 */
function normalizeProductRecord(product: Product): Product {
  return {
    ...product,
    service_group: normalizeProductServiceGroup(product.service_group),
    package_name: typeof product.package_name === 'string'
      ? product.package_name
      : (product.package_name ?? null),
    unit: normalizeProductUnitForSave(product.unit),
    description: typeof product.description === 'string'
      ? product.description
      : (product.description ?? null),
    attachments: Array.isArray(product.attachments)
      ? product.attachments.map((attachment) => ({
        ...attachment,
        id: String(attachment.id ?? ''),
        fileName: String(attachment.fileName ?? ''),
        mimeType: String(attachment.mimeType ?? 'application/octet-stream'),
        fileSize: Number.isFinite(Number(attachment.fileSize)) ? Number(attachment.fileSize) : 0,
        fileUrl: String(attachment.fileUrl ?? ''),
        driveFileId: String(attachment.driveFileId ?? ''),
        createdAt: String(attachment.createdAt ?? ''),
        storagePath: typeof attachment.storagePath === 'string' ? attachment.storagePath : (attachment.storagePath ?? null),
        storageDisk: typeof attachment.storageDisk === 'string' ? attachment.storageDisk : (attachment.storageDisk ?? null),
        storageVisibility: typeof attachment.storageVisibility === 'string' ? attachment.storageVisibility : (attachment.storageVisibility ?? null),
        warningMessage: typeof attachment.warningMessage === 'string' ? attachment.warningMessage : (attachment.warningMessage ?? null),
      }))
      : [],
    is_active: product.is_active !== false,
  };
}

/**
 * Normalizes an import date string to ISO format (YYYY-MM-DD).
 */
function normalizeImportDate(value: string): string | null {
  const text = String(value || '').trim();
  if (!text) return null;

  const isoPrefixMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (isoPrefixMatch) {
    const year = Number(isoPrefixMatch[1]);
    const month = Number(isoPrefixMatch[2]);
    const day = Number(isoPrefixMatch[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() + 1 === month &&
      date.getUTCDate() === day
    ) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  const isoMatch = text.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) {
    const year = Number(isoMatch[1]);
    const month = Number(isoMatch[2]);
    const day = Number(isoMatch[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() + 1 === month &&
      date.getUTCDate() === day
    ) {
      return text;
    }
    return null;
  }

  const dmyMatch = text.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})$/);
  if (dmyMatch) {
    const day = Number(dmyMatch[1]);
    const month = Number(dmyMatch[2]);
    const year = Number(dmyMatch[3]);
    const date = new Date(Date.UTC(year, month - 1, day));
    if (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() + 1 === month &&
      date.getUTCDate() === day
    ) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  const numeric = Number(text);
  if (Number.isFinite(numeric) && numeric > 0) {
    const excelEpoch = new Date(Date.UTC(1899, 11, 30));
    const date = new Date(excelEpoch.getTime() + numeric * 86400000);
    const year = date.getUTCFullYear();
    const month = date.getUTCMonth() + 1;
    const day = date.getUTCDate();
    if (year >= 1900 && year <= 9999) {
      return `${year}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    }
  }

  return null;
}