import { validateVendorApplicationInput } from './validation';

const baseInput = {
  companyName: 'テスト株式会社',
  contactEmail: 'test@example.com',
  password: 'password123',
  passwordConfirm: 'password123',
  acceptTerms: true
};

describe('validateVendorApplicationInput', () => {
  it('returns empty errors for valid input', () => {
    expect(validateVendorApplicationInput(baseInput)).toEqual({});
  });

  it('validates required company name', () => {
    const errors = validateVendorApplicationInput({ ...baseInput, companyName: '   ' });
    expect(errors.companyName).toBe('会社名を入力してください');
  });

  it('validates email format', () => {
    const errors = validateVendorApplicationInput({ ...baseInput, contactEmail: 'invalid' });
    expect(errors.contactEmail).toBe('有効なメールアドレスを入力してください');
  });

  it('requires password length >= 8', () => {
    const errors = validateVendorApplicationInput({ ...baseInput, password: 'short', passwordConfirm: 'short' });
    expect(errors.password).toBe('パスワードは8文字以上で入力してください');
  });

  it('validates password confirmation', () => {
    const errors = validateVendorApplicationInput({ ...baseInput, passwordConfirm: 'different' });
    expect(errors.passwordConfirm).toBe('確認用パスワードが一致しません');
  });

  it('requires terms acceptance', () => {
    const errors = validateVendorApplicationInput({ ...baseInput, acceptTerms: false });
    expect(errors.acceptTerms).toBe('利用規約への同意が必要です');
  });
});
