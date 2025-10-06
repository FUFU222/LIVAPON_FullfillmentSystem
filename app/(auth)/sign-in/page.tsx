import { redirect } from 'next/navigation';
import type { Metadata } from 'next';
import { SignInForm } from '@/components/auth/sign-in-form';
import { getAuthContext } from '@/lib/auth';

export const metadata: Metadata = {
  title: 'サインイン | LIVAPON Fulfillment Console'
};

function safeRedirect(target: unknown): string {
  if (typeof target !== 'string') {
    return '/orders';
  }

  if (!target.startsWith('/') || target.startsWith('//')) {
    return '/orders';
  }

  return target.length > 0 ? target : '/orders';
}

export default async function SignInPage({
  searchParams
}: {
  searchParams: { redirectTo?: string };
}) {
  const redirectTo = safeRedirect(searchParams.redirectTo);
  const auth = await getAuthContext();

  if (auth) {
    if (auth.role === 'admin') {
      redirect('/admin');
    }

    if (auth.role === 'pending_vendor') {
      redirect('/pending');
    }

    redirect(redirectTo);
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-6 rounded-lg border border-slate-200 bg-white p-8 shadow-sm">
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-2xl font-semibold text-foreground">サインイン</h1>
        <p className="text-sm text-slate-500">
          登録済みのメールアドレスとパスワードでサインインしてください。
        </p>
      </div>
      <SignInForm redirectTo={redirectTo} />
    </div>
  );
}
