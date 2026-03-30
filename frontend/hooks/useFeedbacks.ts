import { useState, useCallback } from 'react';
import {
  createFeedback,
  deleteFeedback,
  fetchFeedbackDetail,
  fetchFeedbacksPage,
  updateFeedback,
} from '../services/api/adminApi';
import type { FeedbackRequest } from '../types/admin';
import type { Attachment } from '../types/customerRequest';
import type { PaginatedQuery, PaginationMeta } from '../types/common';

interface UseFeedbacksReturn {
  feedbacks: FeedbackRequest[];
  feedbacksPageRows: FeedbackRequest[];
  feedbacksPageMeta: PaginationMeta | undefined;
  selectedFeedback: FeedbackRequest | null;
  isSaving: boolean;
  isLoading: boolean;
  isPageLoading: boolean;
  isDetailLoading: boolean;
  error: string | null;
  loadFeedbacksPage: (query?: PaginatedQuery) => Promise<void>;
  loadFeedbackDetail: (feedbackId: string | number) => Promise<FeedbackRequest | null>;
  handleSaveFeedback: (data: {
    title: string;
    description: string | null;
    priority: FeedbackRequest['priority'];
    status?: FeedbackRequest['status'];
    attachments: Attachment[];
  }, modalType: 'ADD_FEEDBACK' | 'EDIT_FEEDBACK', selectedFeedback: FeedbackRequest | null) => Promise<boolean>;
  handleDeleteFeedback: (selectedFeedback: FeedbackRequest) => Promise<boolean>;
  setFeedbacksPageRows: (rows: FeedbackRequest[]) => void;
  setFeedbacksPageMeta: (meta: PaginationMeta | undefined) => void;
  setSelectedFeedback: (feedback: FeedbackRequest | null) => void;
}

export function useFeedbacks(addToast?: (type: 'success' | 'error', title: string, message: string) => void): UseFeedbacksReturn {
  const [feedbacks, setFeedbacks] = useState<FeedbackRequest[]>([]);
  const [feedbacksPageRows, setFeedbacksPageRows] = useState<FeedbackRequest[]>([]);
  const [feedbacksPageMeta, setFeedbacksPageMeta] = useState<PaginationMeta | undefined>(undefined);
  const [selectedFeedback, setSelectedFeedbackState] = useState<FeedbackRequest | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [isPageLoading, setIsPageLoading] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFeedbacksPage = useCallback(async (query?: PaginatedQuery) => {
    setIsPageLoading(true);
    setError(null);
    try {
      const result = await fetchFeedbacksPage(query);
      setFeedbacksPageRows(result.data || []);
      setFeedbacksPageMeta(result.meta || undefined);
      setFeedbacks(result.data || []);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Không thể tải danh sách góp ý.';
      setError(message);
      addToast?.('error', 'Tải dữ liệu thất bại', message);
    } finally {
      setIsPageLoading(false);
    }
  }, [addToast]);

  const loadFeedbackDetail = useCallback(async (feedbackId: string | number): Promise<FeedbackRequest | null> => {
    setIsDetailLoading(true);
    setError(null);
    try {
      const detail = await fetchFeedbackDetail(feedbackId);
      setSelectedFeedbackState(detail);
      return detail;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Không thể tải chi tiết góp ý.';
      setError(message);
      addToast?.('error', 'Tải chi tiết góp ý thất bại', message);
      return null;
    } finally {
      setIsDetailLoading(false);
    }
  }, [addToast]);

  const handleSaveFeedback = useCallback(async (
    data: {
      title: string;
      description: string | null;
      priority: FeedbackRequest['priority'];
      status?: FeedbackRequest['status'];
      attachments: Attachment[];
    },
    modalType: 'ADD_FEEDBACK' | 'EDIT_FEEDBACK',
    selectedFeedbackItem: FeedbackRequest | null
  ): Promise<boolean> => {
    setIsSaving(true);
    setError(null);
    try {
      const attachmentIds = (data.attachments ?? [])
        .map((a) => Number(a.id))
        .filter((id) => Number.isFinite(id) && id > 0);

      const payload = {
        title: data.title,
        description: data.description,
        priority: data.priority,
        ...(data.status ? { status: data.status } : {}),
        ...(attachmentIds.length > 0 ? { attachment_ids: attachmentIds } : {}),
      };

      if (modalType === 'ADD_FEEDBACK') {
        const created = await createFeedback(payload);
        setFeedbacksPageRows((prev) => [created, ...(prev || [])]);
        setFeedbacks((prev) => [created, ...(prev || [])]);
        addToast?.('success', 'Thành công', 'Thêm góp ý thành công!');
      } else if (modalType === 'EDIT_FEEDBACK' && selectedFeedbackItem) {
        const updated = await updateFeedback(selectedFeedbackItem.id, payload);
        setFeedbacksPageRows((prev) =>
          prev.map((fb) => String(fb.id) === String(updated.id) ? updated : fb)
        );
        setFeedbacks((prev) =>
          prev.map((fb) => String(fb.id) === String(updated.id) ? updated : fb)
        );
        addToast?.('success', 'Thành công', 'Cập nhật góp ý thành công!');
      }
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Lỗi không xác định';
      setError(message);
      addToast?.('error', 'Lưu thất bại', `Không thể lưu góp ý. ${message}`);
      return false;
    } finally {
      setIsSaving(false);
    }
  }, [addToast]);

  const handleDeleteFeedback = useCallback(async (selectedFeedbackItem: FeedbackRequest): Promise<boolean> => {
    setError(null);
    try {
      await deleteFeedback(selectedFeedbackItem.id);
      setFeedbacksPageRows((prev) => prev.filter((fb) => String(fb.id) !== String(selectedFeedbackItem.id)));
      setFeedbacks((prev) => prev.filter((fb) => String(fb.id) !== String(selectedFeedbackItem.id)));
      addToast?.('success', 'Thành công', 'Đã xóa góp ý.');
      return true;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Lỗi không xác định';
      setError(message);
      addToast?.('error', 'Xóa thất bại', `Không thể xóa góp ý. ${message}`);
      return false;
    }
  }, [addToast]);

  return {
    feedbacks,
    feedbacksPageRows,
    feedbacksPageMeta,
    selectedFeedback,
    isSaving,
    isLoading,
    isPageLoading,
    isDetailLoading,
    error,
    loadFeedbacksPage,
    loadFeedbackDetail,
    handleSaveFeedback,
    handleDeleteFeedback,
    setFeedbacksPageRows,
    setFeedbacksPageMeta,
    setSelectedFeedback: setSelectedFeedbackState,
  };
}
