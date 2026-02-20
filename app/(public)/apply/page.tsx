import { Metadata } from 'next';
import { VendorApplicationForm } from '@/components/apply/vendor-application-form';

export const metadata: Metadata = {
  title: '利用申請 | LIVAPON 配送管理システム'
};

export default function VendorApplyPage() {
  return <VendorApplicationForm />;
}
