'use client';

import { useEffect, useRef, useState } from 'react';
import { useFormStatus } from 'react-dom';
import { deleteVendorAction } from '@/app/admin/vendors/actions';
import { Button } from '@/components/ui/button';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';

type Props = {
  vendorId: number;
  vendorName: string;
};

function DeleteActionButton({ onOpen }: { onOpen: () => void }) {
  const { pending } = useFormStatus();

  return (
    <Button
      type="button"
      variant="outline"
      className="border-red-200 text-red-600 hover:bg-red-50"
      disabled={pending}
      onClick={(event) => {
        event.stopPropagation();
        onOpen();
      }}
    >
      {pending ? '削除中…' : '削除'}
    </Button>
  );
}

export function VendorDeleteButton({ vendorId, vendorName }: Props) {
  const [open, setOpen] = useState(false);
  const [submitQueued, setSubmitQueued] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (!submitQueued || open) {
      return;
    }

    const timer = window.setTimeout(() => {
      formRef.current?.requestSubmit();
      setSubmitQueued(false);
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [open, submitQueued]);

  return (
    <>
      <form ref={formRef} action={deleteVendorAction} className="flex justify-end">
        <input type="hidden" name="vendorId" value={vendorId} />
        <DeleteActionButton onOpen={() => setOpen(true)} />
      </form>

      <ConfirmDialog
        open={open}
        title={`「${vendorName}」を削除しますか？`}
        description="この操作は元に戻せません。関連データが存在する場合は削除できないことがあります。"
        confirmLabel="削除する"
        cancelLabel="キャンセル"
        confirmVariant="danger"
        onCancel={() => setOpen(false)}
        onConfirm={() => {
          setOpen(false);
          setSubmitQueued(true);
        }}
      />
    </>
  );
}
