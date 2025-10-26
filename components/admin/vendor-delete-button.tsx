'use client';

import { useRef, useState } from 'react';
import { deleteVendorAction } from '@/app/admin/vendors/actions';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

type Props = {
  vendorId: number;
  vendorName: string;
};

export function VendorDeleteButton({ vendorId, vendorName }: Props) {
  const [pending, setPending] = useState(false);
  const [open, setOpen] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <>
      <form
        ref={formRef}
        action={async (formData) => {
          if (pending) {
            return;
          }

          try {
            setPending(true);
            await deleteVendorAction(formData);
          } finally {
            setPending(false);
          }
        }}
        className="flex justify-end"
      >
        <input type="hidden" name="vendorId" value={vendorId} />
        <Button
          type="button"
          variant="outline"
          className="border-red-200 text-red-600 hover:bg-red-50"
          disabled={pending}
          onClick={(event) => {
            event.stopPropagation();
            setOpen(true);
          }}
        >
          {pending ? '削除中…' : '削除'}
        </Button>
      </form>

      <ConfirmDialog
        open={open}
        title={`「${vendorName}」を削除しますか？`}
        description="関連するデータが存在する場合は削除できないことがあります。"
        confirmLabel="削除する"
        cancelLabel="キャンセル"
        confirmVariant="danger"
        onCancel={() => setOpen(false)}
        onConfirm={() => {
          setOpen(false);
          formRef.current?.requestSubmit();
        }}
      />
    </>
  );
}
