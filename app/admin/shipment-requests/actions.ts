'use server';

import { revalidatePath } from 'next/cache';
import { requireAuthContext } from '@/lib/auth';
import {
  updateShipmentAdjustmentRequestByAdmin,
  SHIPMENT_ADJUSTMENT_STATUSES,
  type ShipmentAdjustmentStatus
} from '@/lib/data/shipment-adjustments';

export type ShipmentAdjustmentAdminActionState = {
  status: 'idle' | 'success' | 'error';
  message: string | null;
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null;

  try {
    return await Promise.race([
      promise,
      new Promise<T>((_, reject) => {
        timer = setTimeout(() => reject(new Error('通知メールの送信がタイムアウトしました。')), ms);
      })
    ]);
  } finally {
    if (timer) {
      clearTimeout(timer);
    }
  }
}

async function sendShipmentAdjustmentResolvedNotification(params: {
  to: string;
  contactName: string | null;
}) {
  const notificationModule = await import('@/lib/notifications/shipment-adjustment-update');

  await withTimeout(
    notificationModule.sendShipmentAdjustmentUpdateEmail({
      to: params.to,
      contactName: params.contactName
    }),
    5000
  );

  return {
    isRetryableEmailError: notificationModule.isShipmentAdjustmentUpdateEmailRetryableError
  };
}

function assertAdmin(role: string | null) {
  if (role !== 'admin') {
    throw new Error('管理者のみ操作できます');
  }
}

function parseStatus(value: string | null): ShipmentAdjustmentStatus | undefined {
  if (!value) return undefined;
  return SHIPMENT_ADJUSTMENT_STATUSES.includes(value as ShipmentAdjustmentStatus)
    ? (value as ShipmentAdjustmentStatus)
    : undefined;
}

export async function handleShipmentAdjustmentAdminAction(
  _prevState: ShipmentAdjustmentAdminActionState,
  formData: FormData
): Promise<ShipmentAdjustmentAdminActionState> {
  try {
    const auth = await requireAuthContext();
    assertAdmin(auth.role);

    const requestId = Number(formData.get('requestId'));
    if (!Number.isFinite(requestId)) {
      return { status: 'error', message: '依頼IDが不正です。' };
    }

    const responseNote = (formData.get('responseNote') as string | null)?.trim() ?? '';
    const nextStatus = parseStatus((formData.get('nextStatus') as string | null) ?? null);
    const resolutionSummary = nextStatus === 'resolved' ? responseNote : undefined;

    if (!responseNote && !nextStatus && !resolutionSummary) {
      return { status: 'error', message: '対応内容またはステータスを入力してください。' };
    }

    if (nextStatus === 'resolved' && !(responseNote && responseNote.length > 0)) {
      return { status: 'error', message: '解決済みにする場合は処置内容を入力してください。' };
    }

    const result = await updateShipmentAdjustmentRequestByAdmin({
      requestId,
      status: nextStatus,
      resolutionSummary,
      assignedAdminId: auth.user.id,
      assignedAdminEmail: auth.user.email ?? null,
      comment: responseNote && nextStatus !== 'resolved'
        ? {
            body: responseNote,
            visibility: 'vendor',
            authorId: auth.user.id,
            authorName: auth.user.email ?? auth.user.user_metadata?.name ?? 'Admin',
            authorRole: 'admin'
          }
        : null
    });

    let notificationStatus: 'sent' | 'failed' | 'skipped' = 'skipped';

    if (
      result.previousStatus !== 'resolved' &&
      result.nextStatus === 'resolved' &&
      result.contactEmail
    ) {
      try {
        await sendShipmentAdjustmentResolvedNotification({
          to: result.contactEmail,
          contactName: result.contactName
        });
        notificationStatus = 'sent';
      } catch (error) {
        const notificationModule = await import('@/lib/notifications/shipment-adjustment-update').catch(
          () => null
        );
        const isRetryable = notificationModule?.isShipmentAdjustmentUpdateEmailRetryableError(error) ?? false;

        if (isRetryable) {
          await sleep(700);
          try {
            await sendShipmentAdjustmentResolvedNotification({
              to: result.contactEmail,
              contactName: result.contactName
            });
            notificationStatus = 'sent';
          } catch (retryError) {
            notificationStatus = 'failed';
            console.error('Failed to send shipment adjustment update email after retry', retryError);
          }
        } else {
          notificationStatus = 'failed';
          console.error('Failed to send shipment adjustment update email', error);
        }
      }
    }

    revalidatePath('/admin/shipment-requests');
    revalidatePath('/support/shipment-adjustment');

    return {
      status: 'success',
      message:
        notificationStatus === 'sent'
          ? '依頼を更新し、通知メールを送信しました。'
          : notificationStatus === 'failed'
            ? '依頼を更新しましたが、通知メールの送信に失敗しました。'
            : '依頼を更新しました。'
    };
  } catch (error) {
    console.error('Failed to update shipment adjustment request', error);
    return {
      status: 'error',
      message: error instanceof Error ? error.message : '更新に失敗しました。時間を置いて再試行してください。'
    };
  }
}
