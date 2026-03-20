jest.mock('next/cache', () => ({
  revalidatePath: jest.fn()
}));

jest.mock('@/lib/auth', () => ({
  requireAuthContext: jest.fn(),
  assertAuthorizedVendor: jest.fn()
}));

jest.mock('@/lib/supabase/server', () => ({
  getServerActionClient: jest.fn()
}));

jest.mock('@/lib/notifications/shipment-adjustment-submission', () => ({
  sendShipmentAdjustmentSubmissionAdminEmail: jest.fn(),
  isShipmentAdjustmentSubmissionAdminEmailRetryableError: jest.fn(() => false)
}));

import { revalidatePath } from 'next/cache';
import { requireAuthContext, assertAuthorizedVendor } from '@/lib/auth';
import { getServerActionClient } from '@/lib/supabase/server';
import {
  isShipmentAdjustmentSubmissionAdminEmailRetryableError,
  sendShipmentAdjustmentSubmissionAdminEmail
} from '@/lib/notifications/shipment-adjustment-submission';
import { submitShipmentAdjustmentRequest } from '@/app/support/shipment-adjustment/actions';

type QueryResult = { data: unknown; error: unknown };

function buildValidFormData() {
  const formData = new FormData();
  formData.set('orderNumber', '#1234');
  formData.set('issueType', 'tracking_update');
  formData.set('issueSummary', '配送会社と追跡番号の登録内容を修正したいです。');
  formData.set('desiredChange', '追跡番号を正しい内容に差し替えてください。');
  formData.set('contactName', '山田花子');
  formData.set('contactEmail', 'ops-vendor@example.com');
  formData.set('contactPhone', '03-1234-5678');
  return formData;
}

function buildSupabaseClient(results: {
  orders: QueryResult;
  insert: QueryResult;
}) {
  const limit = jest.fn().mockResolvedValue(results.orders);
  const inQuery = jest.fn(() => ({ limit }));
  const eq = jest.fn(() => ({ in: inQuery }));
  const selectOrders = jest.fn(() => ({ eq }));
  const ordersTable = { select: selectOrders };

  const single = jest.fn().mockResolvedValue(results.insert);
  const selectInserted = jest.fn(() => ({ single }));
  const insert = jest.fn(() => ({ select: selectInserted }));
  const shipmentAdjustmentRequestsTable = { insert };

  const from = jest.fn((table: string) => {
    if (table === 'orders') {
      return ordersTable;
    }

    if (table === 'shipment_adjustment_requests') {
      return shipmentAdjustmentRequestsTable;
    }

    throw new Error(`Unexpected table: ${table}`);
  });

  return {
    client: { from },
    spies: {
      from,
      eq,
      inQuery,
      limit,
      insert,
      selectInserted,
      single
    }
  };
}

describe('submitShipmentAdjustmentRequest', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    (requireAuthContext as jest.Mock).mockResolvedValue({
      vendorId: 10,
      user: {
        id: 'user-1',
        email: 'seller@example.com'
      }
    });
  });

  it('creates the request and notifies the admin inbox', async () => {
    const { client, spies } = buildSupabaseClient({
      orders: {
        data: [{ id: 555, order_number: '#1234', shopify_order_id: 999 }],
        error: null
      },
      insert: {
        data: { id: 77 },
        error: null
      }
    });

    (getServerActionClient as jest.Mock).mockResolvedValue(client);

    const result = await submitShipmentAdjustmentRequest(
      { status: 'idle', message: null, requestId: null },
      buildValidFormData()
    );

    expect(assertAuthorizedVendor).toHaveBeenCalledWith(10);
    expect(spies.insert).toHaveBeenCalledWith(
      expect.objectContaining({
        vendor_id: 10,
        order_id: 555,
        order_number: '#1234',
        shopify_order_id: 999,
        status: 'pending',
        contact_name: '山田花子',
        contact_email: 'ops-vendor@example.com'
      })
    );
    expect(sendShipmentAdjustmentSubmissionAdminEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        requestId: 77,
        vendorId: 10,
        vendorUserEmail: 'seller@example.com',
        orderNumber: '#1234',
        issueTypeLabel: '追跡番号・配送会社の修正',
        contactEmail: 'ops-vendor@example.com'
      })
    );
    expect(revalidatePath).toHaveBeenCalledWith('/orders/shipments');
    expect(revalidatePath).toHaveBeenCalledWith('/support/shipment-adjustment');
    expect(result).toMatchObject({
      status: 'success',
      message: '発送修正依頼を送信しました。',
      requestId: 77
    });
  });

  it('keeps the submission successful even if admin notification fails', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    const { client } = buildSupabaseClient({
      orders: {
        data: [{ id: 555, order_number: '#1234', shopify_order_id: 999 }],
        error: null
      },
      insert: {
        data: { id: 78 },
        error: null
      }
    });

    (getServerActionClient as jest.Mock).mockResolvedValue(client);
    (sendShipmentAdjustmentSubmissionAdminEmail as jest.Mock).mockRejectedValueOnce(
      new Error('mail down')
    );
    (isShipmentAdjustmentSubmissionAdminEmailRetryableError as jest.Mock).mockReturnValue(false);

    const result = await submitShipmentAdjustmentRequest(
      { status: 'idle', message: null, requestId: null },
      buildValidFormData()
    );

    expect(result).toMatchObject({
      status: 'success',
      requestId: 78
    });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to send shipment adjustment submission admin email',
      expect.objectContaining({ requestId: 78 })
    );

    consoleErrorSpy.mockRestore();
  });
});
