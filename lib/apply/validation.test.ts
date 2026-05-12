import { validateVendorApplicationInput } from './validation';

const baseInput = {
  companyName: 'テスト株式会社',
  contactEmail: 'test@example.com',
  contactPhone: '080-1234-5678',
  password: 'password123',
  passwordConfirm: 'password123',
  acceptTerms: true,
  postal: '107-0062',
  prefecture: '東京都',
  city: '港区南青山',
  address1: '2-2-15',
  address2: ''
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

  it('requires postal code', () => {
    const errors = validateVendorApplicationInput({ ...baseInput, postal: '' });
    expect(errors.postal).toBe('郵便番号を入力してください');
  });

  it('validates postal format', () => {
    const errors = validateVendorApplicationInput({ ...baseInput, postal: '12345' });
    expect(errors.postal).toBe('郵便番号は「123-4567」 または「1234567」 で入力してください');
  });

  it('accepts postal without hyphen', () => {
    const errors = validateVendorApplicationInput({ ...baseInput, postal: '1070062' });
    expect(errors.postal).toBeUndefined();
  });

  it('requires prefecture', () => {
    const errors = validateVendorApplicationInput({ ...baseInput, prefecture: '   ' });
    expect(errors.prefecture).toBe('都道府県を入力してください');
  });

  it('requires city', () => {
    const errors = validateVendorApplicationInput({ ...baseInput, city: '' });
    expect(errors.city).toBe('市区町村を入力してください');
  });

  it('requires address1 (street)', () => {
    const errors = validateVendorApplicationInput({ ...baseInput, address1: '' });
    expect(errors.address1).toBe('番地を入力してください');
  });

  it('allows address2 to be empty (building/room is optional)', () => {
    expect(validateVendorApplicationInput({ ...baseInput, address2: '' })).toEqual({});
  });
});
