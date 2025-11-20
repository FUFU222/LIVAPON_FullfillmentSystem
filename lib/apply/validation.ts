const emailPattern = /.+@.+\..+/;

const phonePattern = /^[0-9()+\-\s]{8,}$/;

export type VendorApplicationInput = {
  companyName: string;
  contactEmail: string;
  contactPhone: string;
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

  if (!input.contactPhone.trim()) {
    errors.contactPhone = '電話番号を入力してください';
  } else if (!phonePattern.test(input.contactPhone.trim())) {
    errors.contactPhone = '電話番号の形式が正しくありません';
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
