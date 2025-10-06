export type AdminActionState = {
  status: 'idle' | 'success' | 'error';
  message: string | null;
};

export const initialAdminActionState: AdminActionState = {
  status: 'idle',
  message: null
};
