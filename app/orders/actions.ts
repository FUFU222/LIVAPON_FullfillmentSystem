'use server';

import { revalidatePath } from 'next/cache';
import { upsertShipment, updateOrderStatus } from '@/lib/data/orders';

export async function saveShipment(formData: FormData) {
  const lineItemId = Number(formData.get('lineItemId'));
  const shipmentId = formData.get('shipmentId');
  const trackingNumber = String(formData.get('trackingNumber') ?? '');
  const carrier = String(formData.get('carrier') ?? '');
  const status = String(formData.get('status') ?? 'in_transit');
  const redirectTo = String(formData.get('redirectTo') ?? '/orders');
  const orderId = Number(formData.get('orderId'));

  await upsertShipment({
    id: shipmentId ? Number(shipmentId) : undefined,
    lineItemId,
    trackingNumber,
    carrier,
    status
  });

  revalidatePath(redirectTo);
}

export async function changeOrderStatus(orderId: number, status: string) {
  await updateOrderStatus(orderId, status);
  revalidatePath(`/orders/${orderId}`);
  revalidatePath('/orders');
}
