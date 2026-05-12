const emailPattern = /.+@.+\..+/;

const phonePattern = /^[0-9()+\-\s]{8,}$/;

// 日本の郵便番号: 123-4567 / 1234567 のどちらでも許容
const postalPattern = /^[0-9]{3}-?[0-9]{4}$/;

export type VendorApplicationInput = {
  companyName: string;
  contactEmail: string;
  contactPhone: string;
  password: string;
  passwordConfirm: string;
  acceptTerms: boolean;
  // 発送元住所(納品書に印字される。新規申請では必須)
  postal: string;
  prefecture: string;
  city: string;
  address1: string;
  address2: string;
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

  // 発送元住所(納品書出力に必須)。address2 だけ任意。
  if (!input.postal.trim()) {
    errors.postal = '郵便番号を入力してください';
  } else if (!postalPattern.test(input.postal.trim())) {
    errors.postal = '郵便番号は「123-4567」 または「1234567」 で入力してください';
  }

  if (!input.prefecture.trim()) {
    errors.prefecture = '都道府県を入力してください';
  }

  if (!input.city.trim()) {
    errors.city = '市区町村を入力してください';
  }

  if (!input.address1.trim()) {
    errors.address1 = '番地を入力してください';
  }

  return errors;
}
