// 納品書(packing slip)の「発行者」 情報を一元管理する。
//
// LIVAPON は特商法上 CHAIRMAN Co., Ltd. を販売者として運営している
// 委託販売モデルのため、納品書は CHAIRMAN 名義で発行する。
//
// 値は環境変数で上書き可能(法人住所が変わった場合などに対応)。
// 環境変数が未設定の場合は本ファイルの定数を fallback として使う。

export type IssuerInfo = {
  name: string;
  postal: string;
  address: string;
  email: string;
};

const DEFAULT_ISSUER: IssuerInfo = {
  name: '株式会社CHAIRMAN (LIVAPON)',
  postal: '107-0062',
  address: '東京都港区南青山2-2-15',
  email: 'information@chairman.jp'
};

export function getIssuerInfo(): IssuerInfo {
  return {
    name: process.env.PACKING_SLIP_ISSUER_NAME?.trim() || DEFAULT_ISSUER.name,
    postal: process.env.PACKING_SLIP_ISSUER_POSTAL?.trim() || DEFAULT_ISSUER.postal,
    address: process.env.PACKING_SLIP_ISSUER_ADDRESS?.trim() || DEFAULT_ISSUER.address,
    email: process.env.PACKING_SLIP_ISSUER_EMAIL?.trim() || DEFAULT_ISSUER.email
  };
}
