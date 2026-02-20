import { translateSupabaseAuthError } from '@/lib/supabase-auth-error';

describe('translateSupabaseAuthError', () => {
  it('returns localized message for invalid sign-in credentials', () => {
    const message = translateSupabaseAuthError(
      { message: 'Invalid login credentials', status: 400, code: 'invalid_credentials' },
      { context: 'sign-in', fallback: 'fallback' }
    );

    expect(message).toBe('メールアドレスまたはパスワードが正しくありません。');
  });

  it('returns localized message for already registered email at sign-up', () => {
    const message = translateSupabaseAuthError(
      { message: 'User already registered', status: 422, code: 'user_already_exists' },
      { context: 'sign-up', fallback: 'fallback' }
    );

    expect(message).toBe('このメールアドレスは既に登録されています。サインインしてご利用ください。');
  });

  it('returns localized message for already registered email at profile update', () => {
    const message = translateSupabaseAuthError(
      { message: 'User already registered', status: 422, code: 'user_already_exists' },
      { context: 'profile-update', fallback: 'fallback' }
    );

    expect(message).toBe('このメールアドレスは既に別のアカウントで使用されています。');
  });

  it('returns localized message for email-not-confirmed error', () => {
    const message = translateSupabaseAuthError(
      { message: 'Email not confirmed', status: 400, code: 'email_not_confirmed' },
      { context: 'sign-in', fallback: 'fallback' }
    );

    expect(message).toBe('メール確認が完了していません。受信した確認メールをご確認ください。');
  });

  it('returns fallback when no known mapping exists', () => {
    const message = translateSupabaseAuthError(
      { message: 'Unexpected backend condition', status: 500 },
      { context: 'sign-in', fallback: 'サインインに失敗しました。' }
    );

    expect(message).toBe('サインインに失敗しました。');
  });
});
