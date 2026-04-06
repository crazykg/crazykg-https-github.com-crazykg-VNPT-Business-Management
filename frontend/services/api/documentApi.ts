import type { SendReminderEmailPayload, SendReminderEmailResult } from '../../types';
import type { Attachment, PaginatedQuery, PaginatedResult } from '../../types/common';
import type { Document, Reminder } from '../../types/document';
import {
  apiFetch,
  fetchList,
  fetchPaginatedList,
  JSON_ACCEPT_HEADER,
  JSON_HEADERS,
  normalizeNullableNumber,
  normalizeNullableText,
  normalizeNumber,
  parseErrorMessage,
  parseItemJson,
} from './_infra';

export const fetchDocuments = async (): Promise<Document[]> => fetchList<Document>('/api/v5/documents');

export const fetchDocumentsPage = async (query: PaginatedQuery): Promise<PaginatedResult<Document>> =>
  fetchPaginatedList<Document>('/api/v5/documents', query);

export const fetchReminders = async (): Promise<Reminder[]> => fetchList<Reminder>('/api/v5/reminders');

export const fetchRemindersPage = async (query: PaginatedQuery): Promise<PaginatedResult<Reminder>> =>
  fetchPaginatedList<Reminder>('/api/v5/reminders', query);

export const createReminder = async (payload: Partial<Reminder>): Promise<Reminder> => {
  const res = await apiFetch('/api/v5/reminders', {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      id: payload.id,
      reminder_title: payload.title,
      content: payload.content,
      remind_date: payload.remindDate,
      assigned_to: payload.assignedToUserId,
      created_at: payload.createdDate,
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'CREATE_REMINDER_FAILED'));
  }

  return parseItemJson<Reminder>(res);
};

export const updateReminder = async (id: string, payload: Partial<Reminder>): Promise<Reminder> => {
  const res = await apiFetch(`/api/v5/reminders/${id}`, {
    method: 'PUT',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      reminder_title: payload.title,
      content: payload.content,
      remind_date: payload.remindDate,
      assigned_to: payload.assignedToUserId,
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'UPDATE_REMINDER_FAILED'));
  }

  return parseItemJson<Reminder>(res);
};

export const deleteReminder = async (id: string): Promise<void> => {
  const res = await apiFetch(`/api/v5/reminders/${id}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'DELETE_REMINDER_FAILED'));
  }
};

export const sendReminderEmail = async (
  reminderId: string,
  payload: SendReminderEmailPayload
): Promise<SendReminderEmailResult> => {
  const res = await apiFetch(`/api/v5/reminders/${encodeURIComponent(reminderId)}/send-email`, {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({ recipient_email: normalizeNullableText(payload.recipient_email) }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'SEND_REMINDER_EMAIL_FAILED'));
  }

  return res.json() as Promise<SendReminderEmailResult>;
};

export const createDocument = async (payload: Partial<Document>): Promise<Document> => {
  const normalizedProductIds = Array.from(
    new Set(
      (payload.productIds && payload.productIds.length > 0
        ? payload.productIds
        : payload.productId
          ? [payload.productId]
          : []
      )
        .map((item) => normalizeNullableNumber(item))
        .filter((item): item is number => item !== null)
    )
  );

  const res = await apiFetch('/api/v5/documents', {
    method: 'POST',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      scope: normalizeNullableText(payload.scope) ?? 'DEFAULT',
      id: payload.id,
      name: payload.name,
      typeId: normalizeNullableText(payload.typeId),
      customerId: normalizeNullableNumber(payload.customerId),
      projectId: normalizeNullableNumber(payload.projectId),
      commissionPolicyText: normalizeNullableText(payload.commissionPolicyText),
      expiryDate: normalizeNullableText(payload.expiryDate),
      releaseDate: normalizeNullableText(payload.releaseDate),
      status: payload.status,
      productIds: normalizedProductIds,
      attachments: (payload.attachments || []).map((attachment) => ({
        id: normalizeNullableText(attachment.id),
        fileName: attachment.fileName,
        fileUrl: normalizeNullableText(attachment.fileUrl),
        driveFileId: normalizeNullableText(attachment.driveFileId),
        fileSize: normalizeNumber(attachment.fileSize, 0),
        mimeType: normalizeNullableText(attachment.mimeType),
        createdAt: normalizeNullableText(attachment.createdAt),
        storagePath: normalizeNullableText(attachment.storagePath),
        storageDisk: normalizeNullableText(attachment.storageDisk),
        storageVisibility: normalizeNullableText(attachment.storageVisibility),
        storageProvider: normalizeNullableText(attachment.storageProvider),
      })),
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'CREATE_DOCUMENT_FAILED'));
  }

  return parseItemJson<Document>(res);
};

export const updateDocument = async (id: string | number, payload: Partial<Document>): Promise<Document> => {
  const normalizedProductIds = Array.from(
    new Set(
      (payload.productIds && payload.productIds.length > 0
        ? payload.productIds
        : payload.productId
          ? [payload.productId]
          : []
      )
        .map((item) => normalizeNullableNumber(item))
        .filter((item): item is number => item !== null)
    )
  );

  const res = await apiFetch(`/api/v5/documents/${encodeURIComponent(String(id))}`, {
    method: 'PUT',
    credentials: 'include',
    headers: JSON_HEADERS,
    body: JSON.stringify({
      scope: normalizeNullableText(payload.scope) ?? 'DEFAULT',
      id: payload.id,
      name: payload.name,
      typeId: normalizeNullableText(payload.typeId),
      customerId: normalizeNullableNumber(payload.customerId),
      projectId: normalizeNullableNumber(payload.projectId),
      commissionPolicyText: normalizeNullableText(payload.commissionPolicyText),
      expiryDate: normalizeNullableText(payload.expiryDate),
      releaseDate: normalizeNullableText(payload.releaseDate),
      status: payload.status,
      productIds: normalizedProductIds,
      attachments: payload.attachments
        ? payload.attachments.map((attachment) => ({
            id: normalizeNullableText(attachment.id),
            fileName: attachment.fileName,
            fileUrl: normalizeNullableText(attachment.fileUrl),
            driveFileId: normalizeNullableText(attachment.driveFileId),
            fileSize: normalizeNumber(attachment.fileSize, 0),
            mimeType: normalizeNullableText(attachment.mimeType),
            createdAt: normalizeNullableText(attachment.createdAt),
            storagePath: normalizeNullableText(attachment.storagePath),
            storageDisk: normalizeNullableText(attachment.storageDisk),
            storageVisibility: normalizeNullableText(attachment.storageVisibility),
            storageProvider: normalizeNullableText(attachment.storageProvider),
          }))
        : undefined,
    }),
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'UPDATE_DOCUMENT_FAILED'));
  }

  return parseItemJson<Document>(res);
};

export const deleteDocument = async (id: string | number): Promise<void> => {
  const res = await apiFetch(`/api/v5/documents/${encodeURIComponent(String(id))}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'DELETE_DOCUMENT_FAILED'));
  }
};

export const uploadDocumentAttachment = async (file: File): Promise<Attachment> => {
  const formData = new FormData();
  formData.append('file', file);

  const res = await apiFetch('/api/v5/documents/upload-attachment', {
    method: 'POST',
    credentials: 'include',
    body: formData,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'UPLOAD_DOCUMENT_ATTACHMENT_FAILED'));
  }

  return parseItemJson<Attachment>(res);
};

export const deleteUploadedDocumentAttachment = async (payload: {
  attachmentId?: number | string | null;
  driveFileId?: string | null;
  fileUrl?: string | null;
  storagePath?: string | null;
  storageDisk?: string | null;
}): Promise<void> => {
  const query = new URLSearchParams();
  const attachmentId = normalizeNullableNumber(payload.attachmentId);
  if (attachmentId !== null) {
    query.set('attachmentId', String(attachmentId));
  }
  if (payload.driveFileId) {
    query.set('driveFileId', payload.driveFileId);
  }
  if (payload.fileUrl) {
    query.set('fileUrl', payload.fileUrl);
  }
  if (payload.storagePath) {
    query.set('storagePath', payload.storagePath);
  }
  if (payload.storageDisk) {
    query.set('storageDisk', payload.storageDisk);
  }

  const suffix = query.toString() ? `?${query.toString()}` : '';
  const res = await apiFetch(`/api/v5/documents/upload-attachment${suffix}`, {
    method: 'DELETE',
    credentials: 'include',
    headers: JSON_ACCEPT_HEADER,
  });

  if (!res.ok) {
    throw new Error(await parseErrorMessage(res, 'DELETE_DOCUMENT_ATTACHMENT_FAILED'));
  }
};
