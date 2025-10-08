export type AdminActionState = {
  status: 'idle' | 'success' | 'error';
  message: string | null;
  details?: {
    vendorCode?: string;
  } | null;
};

export const initialAdminActionState: AdminActionState = {
  status: 'idle',
  message: null,
  details: null
};
