export const APPLY_GENERIC_ERROR_MESSAGE =
  '申請の送信中にエラーが発生しました。時間をおいて再度お試しください。';

export const APPLY_DUPLICATE_EMAIL_MESSAGE =
  'このメールアドレスは既に登録されています。サインインしてご利用ください。';

export const APPLY_PENDING_APPLICATION_MESSAGE =
  'このメールアドレスで審査中の利用申請が既にあります。';

const APPLY_INVALID_EMAIL_MESSAGE = 'メールアドレスの形式が正しくありません。';
const APPLY_WEAK_PASSWORD_MESSAGE = 'パスワードは8文字以上で設定してください。';

export function resolveApplySubmissionErrorMessage(error: unknown): string {
  if (!(error instanceof Error)) {
    return APPLY_GENERIC_ERROR_MESSAGE;
  }

  const rawMessage = error.message.trim();
  if (rawMessage.length === 0) {
    return APPLY_GENERIC_ERROR_MESSAGE;
  }

  if (rawMessage.includes(APPLY_PENDING_APPLICATION_MESSAGE)) {
    return APPLY_PENDING_APPLICATION_MESSAGE;
  }

  const normalized = rawMessage.toLowerCase();
  if (
    normalized.includes('duplicate key value') ||
    normalized.includes('unique constraint') ||
    normalized.includes('already exists')
  ) {
    return APPLY_DUPLICATE_EMAIL_MESSAGE;
  }

  return APPLY_GENERIC_ERROR_MESSAGE;
}

export function resolveApplySubmissionFieldErrors(
  message: string
): Record<string, string> | null {
  switch (message) {
    case APPLY_DUPLICATE_EMAIL_MESSAGE:
    case APPLY_PENDING_APPLICATION_MESSAGE:
    case APPLY_INVALID_EMAIL_MESSAGE:
      return { contactEmail: message };
    case APPLY_WEAK_PASSWORD_MESSAGE:
      return { password: message };
    default:
      return null;
  }
}
