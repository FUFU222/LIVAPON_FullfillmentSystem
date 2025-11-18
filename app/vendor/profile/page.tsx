import { redirect } from 'next/navigation';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { GradientAvatar } from '@/components/ui/avatar';
import { VendorProfileForm } from '@/components/vendor/profile-form';
import { OrdersRealtimeProvider } from '@/components/orders/orders-realtime-context';
import { OrdersRealtimeListener } from '@/components/orders/orders-realtime-listener';
import { getAuthContext, assertAuthorizedVendor } from '@/lib/auth';
import { getServerComponentClient } from '@/lib/supabase/server';

export default async function VendorProfilePage() {
  const auth = await getAuthContext();

  if (!auth) {
    redirect('/sign-in?redirectTo=/vendor/profile');
  }

  if (auth.role === 'pending_vendor') {
    redirect('/pending');
  }

  assertAuthorizedVendor(auth.vendorId);

  const supabase = getServerComponentClient();
  const { data: vendor, error } = await supabase
    .from('vendors')
    .select('name, code, contact_email, contact_name')
    .eq('id', auth.vendorId)
    .maybeSingle();

  if (error) {
    console.error('Failed to load vendor profile', error);
  }

  if (!vendor) {
    redirect('/orders');
  }

  const contactName =
    (vendor.contact_name ?? (auth.session.user.user_metadata?.contact_name ?? null)) as string | null;
  const email = auth.session.user.email ?? vendor.contact_email ?? '';

  return (
    <OrdersRealtimeProvider>
      <OrdersRealtimeListener vendorId={auth.vendorId} />
      <div className="mx-auto flex w-full max-w-3xl flex-col gap-6">
      <Card>
        <CardHeader className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <GradientAvatar seed={vendor.name ?? email} label={vendor.name ?? email} size="lg" />
            <div className="flex flex-col gap-1">
              <CardTitle className="text-2xl font-semibold">{vendor.name}</CardTitle>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <VendorProfileForm
            initial={{
              companyName: vendor.name,
              contactName,
              email,
              vendorCode: vendor.code
            }}
          />
        </CardContent>
      </Card>
      </div>
    </OrdersRealtimeProvider>
  );
}
