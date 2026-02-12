export type AdminActionState = {
  status: 'idle' | 'success' | 'error';
  message: string | null;
  details?: {
    vendorCode?: string;
    companyName?: string;
    contactName?: string | null;
    contactEmail?: string;
    approvedAt?: string;
    notificationStatus?: 'sent' | 'failed' | 'skipped';
    notificationError?: string | null;
  } | null;
};

export const initialAdminActionState: AdminActionState = {
  status: 'idle',
  message: null,
  details: null
};
