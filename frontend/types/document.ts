import type { Attachment } from './common';

export type DocumentStatus = 'ACTIVE' | 'SUSPENDED' | 'EXPIRED';

export interface DocumentType {
  id: string;
  name: string;
}

export interface Document {
  id: string;
  name: string;
  typeId?: string;
  customerId?: string | null;
  projectId?: string | null;
  productId?: string;
  productIds?: string[];
  commissionPolicyText?: string | null;
  expiryDate?: string;
  releaseDate?: string;
  scope?: 'DEFAULT' | 'PRODUCT_PRICING';
  status: DocumentStatus;
  attachments: Attachment[];
  createdDate?: string;
}

export interface Reminder {
  id: string;
  title: string;
  content: string;
  remindDate: string;
  assignedToUserId: string;
  createdDate?: string;
}
