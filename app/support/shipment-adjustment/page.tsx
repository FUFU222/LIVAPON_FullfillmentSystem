import { Metadata } from 'next';
import { redirect } from 'next/navigation';
import { getAuthContext, assertAuthorizedVendor } from '@/lib/auth';
import { getVendorProfile } from '@/lib/data/vendors';
import { ShipmentAdjustmentForm } from '@/components/support/shipment-adjustment-form';

export const metadata: Metadata = {
  title: '発送修正申請 | LIVAPON 配送管理コンソール',
  description: '発送済みの内容を修正する際の管理者申請フォーム'
};

export default async function ShipmentAdjustmentPage() {
  const auth = await getAuthContext();

  if (!auth) {
    redirect(`/sign-in?redirectTo=${encodeURIComponent('/support/shipment-adjustment')}`);
  }

  if (auth.role === 'pending_vendor') {
    redirect('/pending');
  }

  assertAuthorizedVendor(auth.vendorId);

  const vendorProfile = await getVendorProfile(auth.vendorId).catch((error) => {
    console.error('Failed to fetch vendor profile for shipment adjustment page', error);
    return null;
  });

  return (
    <div className="mx-auto flex w-full max-w-4xl flex-col gap-6 p-4 sm:p-8">
      <div className="space-y-2">
        <p className="text-sm font-semibold text-slate-900">発送修正申請</p>
        <p className="text-sm text-slate-500">
          発送済みの注文内容を変更する際は、下記フォームから管理者に依頼してください。Console 上での直接取消はできません。
        </p>
      </div>
      <ShipmentAdjustmentForm
        defaultContactName={vendorProfile?.contactName ?? auth.user.user_metadata?.contact_name ?? ''}
        defaultContactEmail={vendorProfile?.contactEmail ?? auth.user.email}
        vendorName={vendorProfile?.name ?? undefined}
        vendorCode={vendorProfile?.code ?? undefined}
      />
    </div>
  );
}
