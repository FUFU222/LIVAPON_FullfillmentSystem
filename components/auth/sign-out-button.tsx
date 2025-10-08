'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { getBrowserClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';

const supabase = getBrowserClient();

export function SignOutButton() {
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
      setIsSigningOut(false);
    }
  }

  return (
    <Button type="button" variant="ghost" onClick={handleSignOut} disabled={isSigningOut}>
      {isSigningOut ? 'サインアウト中…' : 'サインアウト'}
    </Button>
  );
}
