import { redirect } from 'next/navigation';
import { getAuthContext, isAdmin } from '@/lib/auth';
import { getPendingVendorApplications, getRecentVendorApplications } from '@/lib/data/vendors';
import { VendorApplicationCard } from '@/components/admin/vendor-application-card';
import { Alert } from '@/components/ui/alert';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

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
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-semibold">利用申請の審査</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-6">
          {pending.length === 0 ? (
            <Alert variant="success">現在、審査待ちの申請はありません。</Alert>
          ) : (
            pending.map((application) => (
              <VendorApplicationCard key={application.id} application={application} />
            ))
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-xl font-semibold">最近審査した申請</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4">
          {recent.length === 0 ? (
            <p className="text-sm text-slate-500">履歴はまだありません。</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full table-auto text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2">申請ID</th>
                    <th className="px-3 py-2">会社名</th>
                    <th className="px-3 py-2">ベンダーコード</th>
                    <th className="px-3 py-2">担当者</th>
                    <th className="px-3 py-2">メール</th>
                    <th className="px-3 py-2">ステータス</th>
                    <th className="px-3 py-2">審査日時</th>
                  </tr>
                </thead>
                <tbody>
                  {recent.map((application) => (
                    <tr key={application.id} className="border-b border-slate-100 text-slate-600">
                      <td className="px-3 py-2">{application.id}</td>
                      <td className="px-3 py-2">{application.companyName}</td>
                      <td className="px-3 py-2">{application.vendorCode ?? '-'}</td>
                      <td className="px-3 py-2">{application.contactName ?? '-'}</td>
                      <td className="px-3 py-2">{application.contactEmail}</td>
                      <td className="px-3 py-2">{application.status}</td>
                      <td className="px-3 py-2 text-xs">{application.reviewedAt ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
