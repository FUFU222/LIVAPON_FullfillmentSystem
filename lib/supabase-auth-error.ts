export type SupabaseAuthErrorLike = {
  message?: string | null;
  code?: string | null;
  status?: number | null;
};

export type SupabaseAuthErrorContext = 'sign-in' | 'sign-up' | 'profile-update';

type TranslateOptions = {
  context?: SupabaseAuthErrorContext;
  fallback: string;
};

function normalizeText(value: unknown): string {
  return typeof value === 'string' ? value.trim().toLowerCase() : '';
}

function includesAny(text: string, candidates: readonly string[]): boolean {
  return candidates.some((candidate) => text.includes(candidate));
}

export function translateSupabaseAuthError(
  error: SupabaseAuthErrorLike | null | undefined,
  options: TranslateOptions
): string {
  const context = options.context ?? 'sign-in';
  const code = normalizeText(error?.code);
  const message = normalizeText(error?.message);
  const status = typeof error?.status === 'number' ? error.status : null;

  if (
    includesAny(code, ['invalid_credentials', 'invalid_grant']) ||
    includesAny(message, ['invalid login credentials', 'invalid credentials'])
  ) {
    return 'メールアドレスまたはパスワードが正しくありません。';
  }

  if (includesAny(code, ['email_not_confirmed']) || message.includes('email not confirmed')) {
    return 'メール確認が完了していません。受信した確認メールをご確認ください。';
  }

  if (
    includesAny(code, ['user_already_exists', 'email_exists']) ||
    includesAny(message, ['user already registered', 'already registered', 'already exists'])
  ) {
    if (context === 'profile-update') {
      return 'このメールアドレスは既に別のアカウントで使用されています。';
    }
    if (context === 'sign-up') {
      return 'このメールアドレスは既に登録されています。サインインしてご利用ください。';
    }
    return 'このメールアドレスは既に登録されています。';
  }

  if (
    includesAny(code, ['invalid_email']) ||
    includesAny(message, ['unable to validate email address', 'invalid email'])
  ) {
    return 'メールアドレスの形式が正しくありません。';
  }

  if (
    includesAny(code, ['weak_password']) ||
    includesAny(message, ['password should be at least', 'weak password'])
  ) {
    return 'パスワードは8文字以上で設定してください。';
  }

  if (
    status === 429 ||
    includesAny(message, ['rate limit', 'too many requests', 'over request rate limit'])
  ) {
    return '操作が集中しています。時間をおいて再度お試しください。';
  }

  if (
    context === 'sign-up' &&
    (includesAny(code, ['signup_disabled']) || message.includes('signups not allowed'))
  ) {
    return '現在、新規登録は受け付けていません。管理者へお問い合わせください。';
  }

  return options.fallback;
}
