const emailPattern = /.+@.+\..+/;

export type VendorApplicationInput = {
  companyName: string;
  contactEmail: string;
  password: string;
  passwordConfirm: string;
  acceptTerms: boolean;
};

export type VendorApplicationErrors = Record<string, string>;

export function validateVendorApplicationInput(input: VendorApplicationInput): VendorApplicationErrors {
  const errors: VendorApplicationErrors = {};

  if (!input.companyName.trim()) {
    errors.companyName = '会社名を入力してください';
  }

  if (!input.contactEmail.trim() || !emailPattern.test(input.contactEmail)) {
    errors.contactEmail = '有効なメールアドレスを入力してください';
  }

  if (input.password.length < 8) {
    errors.password = 'パスワードは8文字以上で入力してください';
  }

  if (input.password !== input.passwordConfirm) {
    errors.passwordConfirm = '確認用パスワードが一致しません';
  }

  if (!input.acceptTerms) {
    errors.acceptTerms = '利用規約への同意が必要です';
  }

  return errors;
}
