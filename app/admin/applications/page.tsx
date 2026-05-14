import { redirect } from 'next/navigation';
import { getAuthContext, isAdmin } from '@/lib/auth';
import {
  getPendingVendorApplications,
  getRecentVendorApplications,
  type VendorApplication
} from '@/lib/data/vendors';
import { VendorApplicationCard } from '@/components/admin/vendor-application-card';
import { Alert } from '@/components/ui/alert';
import { PageHeader, Surface } from '@/components/ui/page-shell';

// 申請レコードの住所を 1 行サマリに整形(一覧テーブル用)
// 1 項目でも入っていれば「都道府県+市区町村+番地」 を返す。全部空なら null(=未登録扱い)。
function formatVendorApplicationAddress(application: VendorApplication): string | null {
  const parts = [application.prefecture, application.city, application.address1, application.address2]
    .map((v) => v?.trim())
    .filter((v): v is string => Boolean(v));
  if (parts.length === 0 && !application.postal) return null;
  const street = parts.join(' ');
  if (application.postal && street) return `〒${application.postal} ${street}`;
  if (application.postal) return `〒${application.postal}`;
  return street;
}

export default async function AdminApplicationsPage() {
  const auth = await getAuthContext();

  if (!auth) {
    redirect('/sign-in?redirectTo=/admin/applications');
  }

  if (!isAdmin(auth)) {
    redirect('/orders');
  }

  const [pending, recent] = await Promise.all([
    getPendingVendorApplications(),
    getRecentVendorApplications()
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        eyebrow="Admin"
        title="利用開始依頼"
        description="新しいセラーの利用申請を確認し、承認または差し戻しを行います。発送元住所は納品書にも利用されます。"
      />
      <Surface className="grid gap-4 p-3 sm:p-4">
        <SectionTitle title="対応待ち" description="承認または差し戻しが必要な依頼です。" />
        <div className="grid gap-4">
          {pending.length === 0 ? (
            <Alert variant="success">現在、対応待ちの依頼はありません。</Alert>
          ) : (
            pending.map((application) => (
              <VendorApplicationCard key={application.id} application={application} />
            ))
          )}
        </div>
      </Surface>

      <Surface className="grid gap-4 overflow-hidden p-3 sm:p-4">
        <SectionTitle title="最近対応した依頼" description="直近の承認・差し戻し履歴です。" />
        <div className="grid gap-4">
          {recent.length === 0 ? (
            <p className="text-sm text-slate-500">履歴はまだありません。</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full table-auto text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2">依頼ID</th>
                    <th className="px-3 py-2">会社名</th>
                    <th className="px-3 py-2">セラーコード</th>
                    <th className="px-3 py-2">担当者</th>
                    <th className="px-3 py-2">メール</th>
                    <th className="px-3 py-2">電話</th>
                    <th className="px-3 py-2">発送元住所</th>
                    <th className="px-3 py-2">対応日時</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((application) => {
                    const addressSummary = formatVendorApplicationAddress(application);
                    return (
                      <tr key={application.id} className="border-b border-slate-100 text-slate-600">
                        <td className="px-3 py-2">{application.id}</td>
                        <td className="px-3 py-2">{application.companyName}</td>
                        <td className="px-3 py-2">{application.vendorCode ?? '-'}</td>
                        <td className="px-3 py-2">{application.contactName ?? '-'}</td>
                        <td className="px-3 py-2">{application.contactEmail}</td>
                        <td className="px-3 py-2">{application.contactPhone ?? '-'}</td>
                        <td className="px-3 py-2 text-xs">
                          {addressSummary ?? (
                            <span className="text-amber-700">未登録</span>
                          )}
                        </td>
                        <td className="px-3 py-2 text-xs">{application.reviewedAt ?? '-'}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </Surface>
    </div>
  );
}

function SectionTitle({ title, description }: { title: string; description: string }) {
  return (
    <div>
      <h2 className="text-base font-semibold text-slate-950">{title}</h2>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
    </div>
  );
}
