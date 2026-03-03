'use server';

import { revalidatePath } from 'next/cache';
import {
  createVendorApplication,
  getVendorApplicationEmailConflict
} from '@/lib/data/vendors';
import { getServerActionClient } from '@/lib/supabase/server';
import {
  resolveApplySubmissionErrorMessage,
  resolveApplySubmissionFieldErrors
} from '@/lib/apply/submission-errors';
import { validateVendorApplicationInput } from '@/lib/apply/validation';
import { translateSupabaseAuthError } from '@/lib/supabase-auth-error';
import type { ApplyFormState } from './state';

export async function submitVendorApplication(
  _prevState: ApplyFormState,
  formData: FormData
): Promise<ApplyFormState> {
  const companyName = (formData.get('companyName') as string | null)?.trim() ?? '';
  const contactName = (formData.get('contactName') as string | null)?.trim() ?? '';
  const contactEmail = (formData.get('contactEmail') as string | null)?.trim() ?? '';
  const contactPhone = (formData.get('contactPhone') as string | null)?.trim() ?? '';
  const message = (formData.get('message') as string | null)?.trim() ?? '';
  const password = (formData.get('password') as string | null) ?? '';
  const passwordConfirm = (formData.get('passwordConfirm') as string | null) ?? '';
  const acceptTerms = formData.get('acceptTerms') === 'on';

  const errors = validateVendorApplicationInput({
    companyName,
    contactEmail,
    contactPhone,
    password,
    passwordConfirm,
    acceptTerms
  });

  if (Object.keys(errors).length > 0) {
    return {
      status: 'error',
      message: '入力内容を確認してください',
      errors
    };
  }

  try {
    const emailConflict = await getVendorApplicationEmailConflict(contactEmail);

    if (emailConflict) {
      return {
        status: 'error',
        message: null,
        errors: { contactEmail: emailConflict }
      };
    }

    const supabase = await getServerActionClient();

    const signUpResult = await supabase.auth.signUp({
      email: contactEmail,
      password,
      options: {
        data: {
          role: 'pending_vendor',
          company_name: companyName,
          contact_name: contactName || null,
          contact_phone: contactPhone || null
        }
      }
    });

    if (signUpResult.error) {
      const message = translateSupabaseAuthError(signUpResult.error, {
        context: 'sign-up',
        fallback: 'アカウントの作成に失敗しました。時間をおいて再度お試しください。'
      });
      const fieldErrors = resolveApplySubmissionFieldErrors(message);

      return {
        status: 'error',
        message: fieldErrors ? null : message,
        errors: fieldErrors ?? {}
      };
    }

    const authUserId = signUpResult.data.user?.id ?? null;

    await createVendorApplication({
      companyName,
      contactName,
      contactEmail,
      contactPhone,
      message,
      authUserId
    });

    revalidatePath('/admin/applications');

    return {
      status: 'success',
      message:
        '利用申請とアカウント登録を受け付けました。確認メールをご確認の上、承認完了までお待ちください。',
      errors: {}
    };
  } catch (error) {
    console.error('Failed to submit vendor application', error);
    const message = resolveApplySubmissionErrorMessage(error);
    const fieldErrors = resolveApplySubmissionFieldErrors(message);

    return {
      status: 'error',
      message: fieldErrors ? null : message,
      errors: fieldErrors ?? {}
    };
  }
}
