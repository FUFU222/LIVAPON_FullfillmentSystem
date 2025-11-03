import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'プライバシーポリシー | LIVAPON Fulfillment Console'
};

const sections = [
  {
    heading: '1. 基本方針',
    body: [
      '株式会社CHAIRMAN（以下、「当社」といいます。）は、LIVAPON Fulfillment Console（以下、「本サービス」といいます。）において取り扱う個人情報を保護するため、以下の方針に基づき安全かつ適切な管理を行います。'
    ]
  },
  {
    heading: '2. 取得する情報',
    body: [
      '当社が本サービスで取得・取り扱う情報の主な種類は以下の通りです。',
      '・アカウント情報：氏名、会社名、役職、メールアドレス、電話番号、ベンダーコード等',
      '・Shopifyから同期される注文情報：注文番号、顧客名、配送先住所、SKU情報、数量、ステータス等',
      '・発送情報：追跡番号、配送業者、発送日時、同期状態',
      '・操作ログ：サインイン履歴、主要機能の利用履歴、API通信ログ'
    ]
  },
  {
    heading: '3. 利用目的',
    body: [
      '当社は取得した情報を以下の目的で利用します。',
      '・本サービスの提供、運用、本人認証、サポート対応のため',
      '・発送状況の連携およびShopifyへの同期処理を実施するため',
      '・障害対応、セキュリティ対策、サービス改善のための分析',
      '・法令遵守および不正利用防止、権利保護のため'
    ]
  },
  {
    heading: '4. 第三者提供と委託',
    body: [
      '1. 当社は、以下の場合を除き、あらかじめ利用者の同意を得ることなく個人情報を第三者に提供しません。',
      '   ・法令に基づく場合',
      '   ・人の生命、身体、財産の保護に必要であって、本人の同意を得ることが困難な場合',
      '   ・公衆衛生・児童の健全育成推進のために特に必要な場合',
      '   ・国の機関等への協力が必要な場合',
      '2. 当社は、システム運用やデータ保全を目的として、以下の事業者に業務を委託しています。',
      '   ・Shopify Inc.：注文データおよびFulfillment Order情報の連携',
      '   ・Supabase, Inc.：認証・データベース・ファイルストレージ',
      '   ・その他、必要に応じ契約を締結したクラウドサービス事業者'
    ]
  },
  {
    heading: '5. 個人情報の管理',
    body: [
      '当社は、個人情報の漏えい、滅失またはき損を防止するため、アクセス権限管理、通信の暗号化、ログの監視等、合理的な安全対策を講じます。また、業務委託先に対しても適切な監督を行います。'
    ]
  },
  {
    heading: '6. 保存期間',
    body: [
      '当社は、利用目的の達成に必要な期間、または法令で定められた期間に限り個人情報を保存し、不要となった情報は適切な手段で削除または匿名化します。配送履歴等の業務データは、監査およびトレーサビリティの要請に基づき一定期間保管されます。'
    ]
  },
  {
    heading: '7. 利用者の権利',
    body: [
      '利用者は、当社が保有する自身の個人情報について、開示、訂正、追加、削除、利用停止等を求めることができます。ご希望の際は、下記お問い合わせ窓口までご連絡ください。'
    ]
  },
  {
    heading: '8. クッキー等の利用について',
    body: [
      '本サービスの認証およびセッション管理のため、クッキーやローカルストレージ等を利用します。これらは本サービスの機能提供に不可欠であり、拒否した場合は一部機能が利用できません。分析目的のトラッキングツールを導入する場合は、別途同意を取得します。'
    ]
  },
  {
    heading: '9. 個人情報保護体制の継続的改善',
    body: [
      '当社は、関連法令や社会情勢の変化に応じて本ポリシーの見直し・改善を継続的に行います。重要な変更がある場合は、本サービス上で通知します。'
    ]
  },
  {
    heading: '10. お問い合わせ窓口',
    body: [
      '本ポリシーに関するお問い合わせは、以下の窓口までお願いいたします。',
      'メール：info@chairman.jp',
      '営業時間：平日 10:00-18:00（祝日・年末年始を除く）'
    ]
  },
  {
    heading: '附則',
    body: ['2025年11月3日 制定']
  }
];

export default function PrivacyPage() {
  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-8 py-12">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold text-foreground">プライバシーポリシー</h1>
        <p className="text-sm text-slate-500">
          当社は、個人情報保護の重要性を認識し、適切な取り扱いと保護に努めます。
        </p>
      </header>
      <section className="flex flex-col gap-10">
        {sections.map((section) => (
          <article key={section.heading} className="grid gap-3">
            <h2 className="text-xl font-semibold text-foreground">{section.heading}</h2>
            <div className="grid gap-2 text-sm leading-relaxed text-slate-600">
              {section.body.map((paragraph, index) => (
                <p key={index}>{paragraph}</p>
              ))}
            </div>
          </article>
        ))}
      </section>
      <footer className="text-xs text-slate-400">最終更新日：2025年11月3日</footer>
    </div>
  );
}
