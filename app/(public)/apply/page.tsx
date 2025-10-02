import { Metadata } from 'next';
import { VendorApplicationForm } from '@/components/apply/vendor-application-form';

export const metadata: Metadata = {
  title: '利用申請 | LIVAPON Fulfillment Console'
};

export default function VendorApplyPage() {
  return <VendorApplicationForm />;
}
