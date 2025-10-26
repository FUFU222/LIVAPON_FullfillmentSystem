'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getBrowserClient } from '@/lib/supabase/client';
import { Button, type ButtonVariant } from '@/components/ui/button';

type SignOutButtonProps = {
  variant?: ButtonVariant;
  className?: string;
  onSignedOut?: () => void;
};

const supabase = getBrowserClient();

export function SignOutButton({ variant = 'ghost', className, onSignedOut }: SignOutButtonProps = {}) {
  const router = useRouter();
  const [isSigningOut, setIsSigningOut] = useState(false);

  async function handleSignOut() {
    setIsSigningOut(true);

    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) {
        console.error('Failed to sign out', error);
      }
    } finally {
      router.replace('/sign-in');
      router.refresh();
      onSignedOut?.();
      setIsSigningOut(false);
    }
  }

  return (
    <Button
      type="button"
      variant={variant}
      className={className}
      onClick={handleSignOut}
      disabled={isSigningOut}
    >
      {isSigningOut ? 'サインアウト中…' : 'サインアウト'}
    </Button>
  );
}
