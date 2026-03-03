'use server';

import { revalidatePath } from 'next/cache';
import { requireAuthContext } from '@/lib/auth';
import {
  updateShipmentAdjustmentRequestByAdmin,
  SHIPMENT_ADJUSTMENT_STATUSES,
  type ShipmentAdjustmentStatus
} from '@/lib/data/shipment-adjustments';
import {
  isShipmentAdjustmentUpdateEmailRetryableError,
  sendShipmentAdjustmentUpdateEmail
} from '@/lib/notifications/shipment-adjustment-update';

export type ShipmentAdjustmentAdminActionState = {
  status: 'idle' | 'success' | 'error';
  message: string | null;
};

export const INITIAL_SHIPMENT_ADJUSTMENT_ADMIN_STATE: ShipmentAdjustmentAdminActionState = {
  status: 'idle',
  message: null
};

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
      return { status: 'error', message: '申請IDが不正です。' };
    }

    const commentBody = (formData.get('commentBody') as string | null)?.trim() ?? '';
    const visibilityInput = (formData.get('visibility') as string | null) ?? 'vendor';
    const nextStatus = parseStatus((formData.get('nextStatus') as string | null) ?? null);
    const resolutionSummary = (formData.get('resolutionSummary') as string | null)?.trim();

    if (!commentBody && !nextStatus && !resolutionSummary) {
      return { status: 'error', message: 'コメントまたは更新内容を入力してください。' };
    }

    if (nextStatus === 'resolved' && !(resolutionSummary && resolutionSummary.length > 0)) {
      return { status: 'error', message: '解決済みにする場合は処置内容を入力してください。' };
    }

    const result = await updateShipmentAdjustmentRequestByAdmin({
      requestId,
      status: nextStatus,
      resolutionSummary,
      assignedAdminId: auth.user.id,
      assignedAdminEmail: auth.user.email ?? null,
      comment: commentBody
        ? {
            body: commentBody,
            visibility: visibilityInput === 'internal' ? 'internal' : 'vendor',
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
        await sendShipmentAdjustmentUpdateEmail({
          to: result.contactEmail,
          contactName: result.contactName
        });
        notificationStatus = 'sent';
      } catch (error) {
        if (isShipmentAdjustmentUpdateEmailRetryableError(error)) {
          await sleep(700);
          try {
            await sendShipmentAdjustmentUpdateEmail({
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
          ? '申請を更新し、通知メールを送信しました。'
          : notificationStatus === 'failed'
            ? '申請を更新しましたが、通知メールの送信に失敗しました。'
            : '申請を更新しました。'
    };
  } catch (error) {
    console.error('Failed to update shipment adjustment request', error);
    return {
      status: 'error',
      message: error instanceof Error ? error.message : '更新に失敗しました。時間を置いて再試行してください。'
    };
  }
}
