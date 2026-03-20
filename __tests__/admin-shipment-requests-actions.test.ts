jest.mock('next/cache', () => ({
  revalidatePath: jest.fn()
}));

jest.mock('@/lib/auth', () => ({
  requireAuthContext: jest.fn()
}));

jest.mock('@/lib/data/shipment-adjustments', () => ({
  updateShipmentAdjustmentRequestByAdmin: jest.fn(),
  SHIPMENT_ADJUSTMENT_STATUSES: ['pending', 'in_review', 'needs_info', 'resolved']
}));

jest.mock('@/lib/notifications/shipment-adjustment-update', () => ({
  sendShipmentAdjustmentUpdateEmail: jest.fn(),
  isShipmentAdjustmentUpdateEmailRetryableError: jest.fn()
}));

import { revalidatePath } from 'next/cache';
import { requireAuthContext } from '@/lib/auth';
import { updateShipmentAdjustmentRequestByAdmin } from '@/lib/data/shipment-adjustments';
import {
  sendShipmentAdjustmentUpdateEmail,
  isShipmentAdjustmentUpdateEmailRetryableError
} from '@/lib/notifications/shipment-adjustment-update';
import { handleShipmentAdjustmentAdminAction } from '@/app/admin/shipment-requests/actions';

function buildFormData(overrides?: {
  requestId?: string;
  responseNote?: string;
  nextStatus?: string;
}) {
  const formData = new FormData();
  formData.set('requestId', overrides?.requestId ?? '44');
  if (typeof overrides?.responseNote === 'string') {
    formData.set('responseNote', overrides.responseNote);
  }
  if (typeof overrides?.nextStatus === 'string') {
    formData.set('nextStatus', overrides.nextStatus);
  }
  return formData;
}

describe('handleShipmentAdjustmentAdminAction', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.useRealTimers();
    (requireAuthContext as jest.Mock).mockResolvedValue({
      role: 'admin',
      user: {
        id: 'admin-1',
        email: 'admin@example.com',
        user_metadata: { name: '管理者' }
      }
    });
    (updateShipmentAdjustmentRequestByAdmin as jest.Mock).mockResolvedValue({
      previousStatus: 'pending',
      nextStatus: 'pending',
      contactEmail: null,
      contactName: null
    });
    (sendShipmentAdjustmentUpdateEmail as jest.Mock).mockResolvedValue(undefined);
    (isShipmentAdjustmentUpdateEmailRetryableError as jest.Mock).mockReturnValue(false);
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('returns an authorization error for non-admin users', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    (requireAuthContext as jest.Mock).mockResolvedValue({
      role: 'vendor',
      user: { id: 'vendor-1', email: 'vendor@example.com', user_metadata: {} }
    });

    const result = await handleShipmentAdjustmentAdminAction(
      { status: 'idle', message: null },
      buildFormData({ responseNote: '更新しました' })
    );

    expect(result).toEqual({
      status: 'error',
      message: '管理者のみ操作できます'
    });
    expect(updateShipmentAdjustmentRequestByAdmin).not.toHaveBeenCalled();

    consoleErrorSpy.mockRestore();
  });

  it('returns an error when requestId is invalid', async () => {
    const result = await handleShipmentAdjustmentAdminAction(
      { status: 'idle', message: null },
      buildFormData({ requestId: 'NaN', responseNote: '更新しました' })
    );

    expect(result).toEqual({
      status: 'error',
      message: '依頼IDが不正です。'
    });
    expect(updateShipmentAdjustmentRequestByAdmin).not.toHaveBeenCalled();
  });

  it('requires either a response note or a status change', async () => {
    const result = await handleShipmentAdjustmentAdminAction(
      { status: 'idle', message: null },
      buildFormData()
    );

    expect(result).toEqual({
      status: 'error',
      message: '対応内容またはステータスを入力してください。'
    });
    expect(updateShipmentAdjustmentRequestByAdmin).not.toHaveBeenCalled();
  });

  it('stores a vendor-visible admin comment when updating without resolving', async () => {
    const result = await handleShipmentAdjustmentAdminAction(
      { status: 'idle', message: null },
      buildFormData({ responseNote: '進捗を共有します' })
    );

    expect(updateShipmentAdjustmentRequestByAdmin).toHaveBeenCalledWith({
      requestId: 44,
      status: undefined,
      resolutionSummary: undefined,
      assignedAdminId: 'admin-1',
      assignedAdminEmail: 'admin@example.com',
      comment: {
        body: '進捗を共有します',
        visibility: 'vendor',
        authorId: 'admin-1',
        authorName: 'admin@example.com',
        authorRole: 'admin'
      }
    });
    expect(sendShipmentAdjustmentUpdateEmail).not.toHaveBeenCalled();
    expect(revalidatePath).toHaveBeenCalledWith('/admin/shipment-requests');
    expect(revalidatePath).toHaveBeenCalledWith('/support/shipment-adjustment');
    expect(result).toEqual({
      status: 'success',
      message: '依頼を更新しました。'
    });
  });

  it('sends a notification when resolving a request with a contact email', async () => {
    (updateShipmentAdjustmentRequestByAdmin as jest.Mock).mockResolvedValue({
      previousStatus: 'pending',
      nextStatus: 'resolved',
      contactEmail: 'vendor@example.com',
      contactName: '山田花子'
    });

    const result = await handleShipmentAdjustmentAdminAction(
      { status: 'idle', message: null },
      buildFormData({ responseNote: '対応が完了しました', nextStatus: 'resolved' })
    );

    expect(updateShipmentAdjustmentRequestByAdmin).toHaveBeenCalledWith({
      requestId: 44,
      status: 'resolved',
      resolutionSummary: '対応が完了しました',
      assignedAdminId: 'admin-1',
      assignedAdminEmail: 'admin@example.com',
      comment: null
    });
    expect(sendShipmentAdjustmentUpdateEmail).toHaveBeenCalledWith({
      to: 'vendor@example.com',
      contactName: '山田花子'
    });
    expect(result).toEqual({
      status: 'success',
      message: '依頼を更新し、通知メールを送信しました。'
    });
  });

  it('retries once when the notification failure is retryable', async () => {
    jest.useFakeTimers();
    (updateShipmentAdjustmentRequestByAdmin as jest.Mock).mockResolvedValue({
      previousStatus: 'pending',
      nextStatus: 'resolved',
      contactEmail: 'vendor@example.com',
      contactName: '山田花子'
    });
    (sendShipmentAdjustmentUpdateEmail as jest.Mock)
      .mockRejectedValueOnce(new Error('smtp timeout'))
      .mockResolvedValueOnce(undefined);
    (isShipmentAdjustmentUpdateEmailRetryableError as jest.Mock).mockReturnValue(true);

    const resultPromise = handleShipmentAdjustmentAdminAction(
      { status: 'idle', message: null },
      buildFormData({ responseNote: '再送対応', nextStatus: 'resolved' })
    );

    await jest.advanceTimersByTimeAsync(700);
    const result = await resultPromise;

    expect(sendShipmentAdjustmentUpdateEmail).toHaveBeenCalledTimes(2);
    expect(result).toEqual({
      status: 'success',
      message: '依頼を更新し、通知メールを送信しました。'
    });
  });

  it('keeps the update successful when the notification fails without retry', async () => {
    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    (updateShipmentAdjustmentRequestByAdmin as jest.Mock).mockResolvedValue({
      previousStatus: 'pending',
      nextStatus: 'resolved',
      contactEmail: 'vendor@example.com',
      contactName: '山田花子'
    });
    (sendShipmentAdjustmentUpdateEmail as jest.Mock).mockRejectedValueOnce(new Error('mail down'));
    (isShipmentAdjustmentUpdateEmailRetryableError as jest.Mock).mockReturnValue(false);

    const result = await handleShipmentAdjustmentAdminAction(
      { status: 'idle', message: null },
      buildFormData({ responseNote: '通知失敗ケース', nextStatus: 'resolved' })
    );

    expect(sendShipmentAdjustmentUpdateEmail).toHaveBeenCalledTimes(1);
    expect(result).toEqual({
      status: 'success',
      message: '依頼を更新しましたが、通知メールの送信に失敗しました。'
    });
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      'Failed to send shipment adjustment update email',
      expect.any(Error)
    );

    consoleErrorSpy.mockRestore();
  });
});
