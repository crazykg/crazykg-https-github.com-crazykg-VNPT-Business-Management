import { useState, useCallback } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  createDocument,
  deleteDocument,
  fetchDocuments,
  fetchDocumentsPage,
  updateDocument,
} from '../services/api/documentApi';
import { DEFAULT_PAGINATION_META } from '../services/api/_infra';
import { queryKeys } from '../shared/queryKeys';
import type { PaginatedQuery, PaginationMeta } from '../types';
import type { Document } from '../types/document';

interface UseDocumentsOptions {
  enabled?: boolean;
}

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
  setDocuments: Dispatch<SetStateAction<Document[]>>;
  handleSaveDocument: (
    data: Partial<Document>,
    modalType: 'ADD_DOCUMENT' | 'EDIT_DOCUMENT' | 'UPLOAD_PRODUCT_DOCUMENT',
    selectedDocument: Document | null
  ) => Promise<boolean>;
  handleDeleteDocument: (selectedDocument: Document) => Promise<boolean>;
  setDocumentsPageRows: (rows: Document[]) => void;
  setDocumentsPageMeta: (meta: PaginationMeta) => void;
}

const extractErrorMessage = (error: unknown, fallback: string): string =>
  error instanceof Error ? error.message : fallback;

const resolveCollectionUpdate = <T,>(
  nextValue: SetStateAction<T[]>,
  previousValue: T[],
): T[] => (typeof nextValue === 'function'
  ? (nextValue as (currentValue: T[]) => T[])(previousValue)
  : nextValue);

export function useDocuments(
  addToast?: (type: 'success' | 'error', title: string, message: string) => void,
  options: UseDocumentsOptions = {},
): UseDocumentsReturn {
  const enabled = options.enabled ?? true;
  const queryClient = useQueryClient();
  const [documentsPageRows, setDocumentsPageRows] = useState<Document[]>([]);
  const [documentsPageMeta, setDocumentsPageMeta] = useState<PaginationMeta>(DEFAULT_PAGINATION_META);
  const [isPageLoading, setIsPageLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const documentsQuery = useQuery({
    queryKey: queryKeys.documents.all,
    queryFn: fetchDocuments,
    enabled,
  });
  const { refetch: refetchDocuments } = documentsQuery;

  const createDocumentMutation = useMutation({
    mutationFn: createDocument,
  });

  const updateDocumentMutation = useMutation({
    mutationFn: ({ id, payload }: { id: string | number; payload: Partial<Document> }) =>
      updateDocument(id, payload),
  });

  const deleteDocumentMutation = useMutation({
    mutationFn: (id: string | number) => deleteDocument(id),
  });

  const loadDocuments = useCallback(async () => {
    setError(null);
    try {
      await refetchDocuments();
    } catch (err) {
      const message = extractErrorMessage(err, 'Không thể tải danh sách tài liệu.');
      setError(message);
      addToast?.('error', 'Tải dữ liệu thất bại', message);
    }
  }, [addToast, refetchDocuments]);

  const setDocuments: Dispatch<SetStateAction<Document[]>> = useCallback((value) => {
    queryClient.setQueryData<Document[]>(queryKeys.documents.all, (previous = []) =>
      resolveCollectionUpdate(value, previous)
    );
  }, [queryClient]);

  const loadDocumentsPage = useCallback(async (query?: PaginatedQuery) => {
    setIsPageLoading(true);
    setError(null);
    try {
      const result = await fetchDocumentsPage(query ?? {});
      setDocumentsPageRows(result.data || []);
      setDocumentsPageMeta(result.meta || DEFAULT_PAGINATION_META);
    } catch (err) {
      const message = extractErrorMessage(err, 'Không thể tải danh sách tài liệu.');
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
    setError(null);
    try {
      if (modalType === 'ADD_DOCUMENT') {
        const created = await createDocumentMutation.mutateAsync({ ...data, scope: 'DEFAULT' });
        queryClient.setQueryData<Document[]>(queryKeys.documents.all, (prev = []) => [
          created,
          ...prev.filter((item) => String(item.id) !== String(created.id)),
        ]);
        addToast?.('success', 'Thành công', 'Thêm mới hồ sơ tài liệu thành công!');
      } else if (modalType === 'UPLOAD_PRODUCT_DOCUMENT') {
        const created = await createDocumentMutation.mutateAsync({ ...data, scope: 'PRODUCT_PRICING' });
        queryClient.setQueryData<Document[]>(queryKeys.documents.all, (prev = []) => [
          created,
          ...prev.filter((item) => String(item.id) !== String(created.id)),
        ]);
        addToast?.('success', 'Thành công', 'Đã lưu tài liệu minh chứng giá sản phẩm.');
      } else if (modalType === 'EDIT_DOCUMENT' && selectedDocumentItem) {
        const updated = await updateDocumentMutation.mutateAsync({
          id: selectedDocumentItem.id,
          payload: { ...data, scope: 'DEFAULT' },
        });
        queryClient.setQueryData<Document[]>(queryKeys.documents.all, (prev = []) =>
          prev.map((item) => (String(item.id) === String(selectedDocumentItem.id) ? updated : item))
        );
        addToast?.('success', 'Thành công', 'Cập nhật hồ sơ tài liệu thành công!');
      }
      void loadDocumentsPage();
      return true;
    } catch (err) {
      const message = extractErrorMessage(err, 'Lỗi không xác định');
      setError(message);
      addToast?.('error', 'Lưu thất bại', `Không thể lưu hồ sơ tài liệu vào cơ sở dữ liệu. ${message}`);
      return false;
    }
  }, [addToast, createDocumentMutation, loadDocumentsPage, queryClient, updateDocumentMutation]);

  const handleDeleteDocument = useCallback(async (selectedDocumentItem: Document): Promise<boolean> => {
    setError(null);
    try {
      await deleteDocumentMutation.mutateAsync(selectedDocumentItem.id);
      queryClient.setQueryData<Document[]>(queryKeys.documents.all, (prev = []) =>
        prev.filter((item) => String(item.id) !== String(selectedDocumentItem.id))
      );
      addToast?.('success', 'Thành công', 'Đã xóa hồ sơ tài liệu.');
      void loadDocumentsPage();
      return true;
    } catch (err) {
      const message = extractErrorMessage(err, 'Lỗi không xác định');
      setError(message);
      addToast?.('error', 'Xóa thất bại', `Không thể xóa hồ sơ tài liệu. ${message}`);
      return false;
    }
  }, [addToast, deleteDocumentMutation, loadDocumentsPage, queryClient]);

  return {
    documents: documentsQuery.data ?? [],
    documentsPageRows,
    documentsPageMeta,
    isSaving:
      createDocumentMutation.isPending
      || updateDocumentMutation.isPending
      || deleteDocumentMutation.isPending,
    isLoading: documentsQuery.isLoading || documentsQuery.isFetching,
    isPageLoading,
    error: error || (documentsQuery.error instanceof Error ? documentsQuery.error.message : null),
    loadDocuments,
    loadDocumentsPage,
    setDocuments,
    handleSaveDocument,
    handleDeleteDocument,
    setDocumentsPageRows,
    setDocumentsPageMeta,
  };
}
