'use client';

import { useState } from 'react';
import { deleteVendorAction } from '@/app/admin/vendors/actions';
import { Button } from '@/components/ui/button';

type Props = {
  vendorId: number;
  vendorName: string;
};

export function VendorDeleteButton({ vendorId, vendorName }: Props) {
  const [pending, setPending] = useState(false);

  return (
    <form
      action={async (formData) => {
        if (pending) {
          return;
        }

        const confirmed = window.confirm(`「${vendorName}」を削除します。関連データも削除されます。実行してよろしいですか？`);
        if (!confirmed) {
          return;
        }

        try {
          setPending(true);
          await deleteVendorAction(formData);
        } finally {
          setPending(false);
        }
      }}
    >
      <input type="hidden" name="vendorId" value={vendorId} />
      <Button
        type="submit"
        variant="outline"
        className="border-red-200 text-red-600 hover:bg-red-50"
        disabled={pending}
      >
        {pending ? '削除中…' : '削除'}
      </Button>
    </form>
  );
}
