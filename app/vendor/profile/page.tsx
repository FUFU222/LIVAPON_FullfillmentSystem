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

  if (auth.role === 'admin') {
    redirect('/admin');
  }

  if (auth.vendorId === null) {
    redirect('/pending');
  }

  assertAuthorizedVendor(auth.vendorId);

  const supabase = await getServerComponentClient();
  const { data: vendor, error } = await supabase
    .from('vendors')
    .select('name, code, contact_email, contact_name, contact_phone, notify_new_orders')
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
  const notifyNewOrders = vendor.notify_new_orders ?? true;

  return (
    <OrdersRealtimeProvider>
      <OrdersRealtimeListener vendorId={auth.vendorId} />
      <div className="mx-auto w-full max-w-4xl px-4 py-6 sm:px-6 lg:px-10">
        <Card className="shadow-sm">
          <CardHeader className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
              <GradientAvatar seed={vendor.name ?? email} label={vendor.name ?? email} size="lg" />
              <div className="space-y-1 text-sm text-slate-500">
                <CardTitle className="text-2xl font-semibold text-foreground">
                  {vendor.name}
                </CardTitle>
              </div>
            </div>
          </CardHeader>
          <CardContent className="pt-0">
            <VendorProfileForm
              initial={{
                companyName: vendor.name,
                contactName,
                email,
                vendorCode: vendor.code,
                contactPhone: vendor.contact_phone ?? null,
                notifyNewOrders
              }}
            />
          </CardContent>
        </Card>
      </div>
    </OrdersRealtimeProvider>
  );
}
