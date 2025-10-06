export type ApplyFormState = {
  status: 'idle' | 'success' | 'error';
  message: string | null;
  errors: Record<string, string>;
};

export const initialApplyFormState: ApplyFormState = {
  status: 'idle',
  message: null,
  errors: {}
};
