jest.mock('next/cache', () => ({
  revalidatePath: jest.fn()
}));

jest.mock('@/lib/auth', () => ({
  requireAuthContext: jest.fn(),
  isAdmin: jest.fn()
}));

jest.mock('@/lib/data/orders', () => ({
  getOrderDetailForAdmin: jest.fn(),
  resyncShipmentByAdmin: jest.fn(),
  markShipmentManualResolved: jest.fn(),
  linkShopifyFulfillmentToShipment: jest.fn()
}));

import {
  linkShopifyFulfillmentAction,
  markShipmentManualResolvedAction,
  resyncShipmentByAdminAction
} from '@/app/admin/orders/actions';
import { revalidatePath } from 'next/cache';

const { requireAuthContext, isAdmin } = jest.requireMock<{
  requireAuthContext: jest.Mock;
  isAdmin: jest.Mock;
}>('@/lib/auth');

const ordersData = jest.requireMock<{
  resyncShipmentByAdmin: jest.Mock;
  markShipmentManualResolved: jest.Mock;
  linkShopifyFulfillmentToShipment: jest.Mock;
}>('@/lib/data/orders');

describe('admin shipment sync actions', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    requireAuthContext.mockResolvedValue({
      role: 'admin',
      user: { id: '1e4f7569-d03b-47f9-a85f-d0d20f558071', email: 'admin@example.com' }
    });
    isAdmin.mockReturnValue(true);
  });

  it('runs a shipment resync as the signed-in admin', async () => {
    ordersData.resyncShipmentByAdmin.mockResolvedValue({
      shipmentId: 7001,
      syncStatus: 'synced',
      syncError: null
    });

    const result = await resyncShipmentByAdminAction(7001);

    expect(result).toEqual({
      status: 'success',
      message: 'Shopifyへ再同期しました。'
    });
    expect(ordersData.resyncShipmentByAdmin).toHaveBeenCalledWith(7001, {
      actorUserId: '1e4f7569-d03b-47f9-a85f-d0d20f558071'
    });
    expect(revalidatePath).toHaveBeenCalledWith('/admin/orders');
  });

  it('marks a shipment as manually resolved as the signed-in admin', async () => {
    ordersData.markShipmentManualResolved.mockResolvedValue(undefined);

    const result = await markShipmentManualResolvedAction(7001);

    expect(result).toEqual({
      status: 'success',
      message: '手動対応済みにしました。'
    });
    expect(ordersData.markShipmentManualResolved).toHaveBeenCalledWith(7001, {
      actorUserId: '1e4f7569-d03b-47f9-a85f-d0d20f558071'
    });
  });

  it('links a Shopify fulfillment id as the signed-in admin', async () => {
    ordersData.linkShopifyFulfillmentToShipment.mockResolvedValue(undefined);

    const result = await linkShopifyFulfillmentAction(7001, '987654321');

    expect(result).toEqual({
      status: 'success',
      message: 'Shopify Fulfillment IDを紐付けました。'
    });
    expect(ordersData.linkShopifyFulfillmentToShipment).toHaveBeenCalledWith(7001, 987654321, {
      actorUserId: '1e4f7569-d03b-47f9-a85f-d0d20f558071'
    });
  });

  it('rejects non-admin users before running shipment operations', async () => {
    isAdmin.mockReturnValue(false);

    const result = await resyncShipmentByAdminAction(7001);

    expect(result.status).toBe('error');
    expect(ordersData.resyncShipmentByAdmin).not.toHaveBeenCalled();
  });
});
