import { useState, useCallback } from 'react';
import {
  fetchDocuments,
  fetchDocumentsPage,
  createDocument,
  updateDocument,
  deleteDocument,
  DEFAULT_PAGINATION_META,
} from '../services/v5Api';
import type { Document, PaginatedQuery, PaginationMeta } from '../types';

interface UseDocumentsReturn {
  documents: Document[];
  documentsPageRows: Document[];
  documentsPageMeta: PaginationMeta;
  isSaving: boolean;
  isLoading: boolean;
  isPageLoading: boolean;
  error: string | null;
  loadDocuments: () => Promise<void>;
  loadDocumentsPage: (query?: PaginatedQuery) => Promise<void>;
  handleSaveDocument: (
    data: Partial<Document>,
    modalType: 'ADD_DOCUMENT' | 'EDIT_DOCUMENT' | 'UPLOAD_PRODUCT_DOCUMENT',
    selectedDocument: Document | null
  ) => Promise<boolean>;
  handleDeleteDocument: (selectedDocument: Document) => Promise<boolean>;
  setDocumentsPageRows: (rows: Document[]) => void;
  setDocumentsPageMeta: (meta: PaginationMeta) => void;
}

export function useDocuments(addToast?: (type: 'success' | 'error', title: string, message: string) => void): UseDocumentsReturn {
  const [documents, setDocuments] = useState<Document[]>([]);
  const [documentsPageRows, setDocumentsPageRows] = useState<Document[]>([]);
  const [documentsPageMeta, setDocumentsPageMeta] = useState<PaginationMeta>(DEFAULT_PAGINATION_META);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadDocuments = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const rows = await fetchDocuments();
      setDocuments(rows || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Không thể tải danh sách tài liệu.';
      setError(message);
      addToast?.('error', 'Tải dữ liệu thất bại', message);
    } finally {
      setIsLoading(false);
    }
  }, [addToast]);

  const loadDocumentsPage = useCallback(async (query?: PaginatedQuery) => {
    setIsPageLoading(true);
    setError(null);
    try {
      const result = await fetchDocumentsPage(query);
      setDocumentsPageRows(result.data || []);
      setDocumentsPageMeta(result.meta || DEFAULT_PAGINATION_META);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Không thể tải danh sách tài liệu.';
      setError(message);
      addToast?.('error', 'Tải dữ liệu thất bại', message);
    } finally {
      setIsPageLoading(false);
    }
  }, [addToast]);

  const handleSaveDocument = useCallback(async (
    data: Partial<Document>,
    modalType: 'ADD_DOCUMENT' | 'EDIT_DOCUMENT' | 'UPLOAD_PRODUCT_DOCUMENT',
    selectedDocumentItem: Document | null
  ): Promise<boolean> => {
    setIsSaving(true);
    setError(null);
    try {
      if (modalType === 'ADD_DOCUMENT') {
        const created = await createDocument({ ...data, scope: 'DEFAULT' });
        setDocuments((prev) => [created, ...(prev || [])]);
        addToast?.('success', 'Thành công', 'Thêm mới hồ sơ tài liệu thành công!');
      } else if (modalType === 'UPLOAD_PRODUCT_DOCUMENT') {
        const created = await createDocument({ ...data, scope: 'PRODUCT_PRICING' });
        setDocuments((prev) => [created, ...(prev || [])]);
        addToast?.('success', 'Thành công', 'Đã lưu tài liệu minh chứng giá sản phẩm.');
      } else if (modalType === 'EDIT_DOCUMENT' && selectedDocumentItem) {
        const updated = await updateDocument(selectedDocumentItem.id, { ...data, scope: 'DEFAULT' });
        setDocuments((prev) =>
          prev.map((document) =>
            String(document.id) === String(selectedDocumentItem.id) ? updated : document
          )
        );
        addToast?.('success', 'Thành công', 'Cập nhật hồ sơ tài liệu thành công!');
      }
      void loadDocumentsPage();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Lỗi không xác định';
      setError(message);
      addToast?.('error', 'Lưu thất bại', `Không thể lưu hồ sơ tài liệu vào cơ sở dữ liệu. ${message}`);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [addToast, loadDocumentsPage]);

  const handleDeleteDocument = useCallback(async (selectedDocumentItem: Document): Promise<boolean> => {
    setIsSaving(true);
    setError(null);
    try {
      await deleteDocument(selectedDocumentItem.id);
      setDocuments((prev) =>
        prev.filter((document) => String(document.id) !== String(selectedDocumentItem.id))
      );
      addToast?.('success', 'Thành công', 'Đã xóa hồ sơ tài liệu.');
      void loadDocumentsPage();
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Lỗi không xác định';
      setError(message);
      addToast?.('error', 'Xóa thất bại', `Không thể xóa hồ sơ tài liệu. ${message}`);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [addToast, loadDocumentsPage]);

  return {
    documents,
    documentsPageRows,
    documentsPageMeta,
    isSaving,
    isLoading,
    isPageLoading,
    error,
    loadDocuments,
    loadDocumentsPage,
    handleSaveDocument,
    handleDeleteDocument,
    setDocumentsPageRows,
    setDocumentsPageMeta,
  };
}