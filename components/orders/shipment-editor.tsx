import { saveShipment } from '@/app/orders/actions';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select } from '@/components/ui/select';
import type { OrderDetail } from '@/lib/data/orders';

const statusOptions = [
  { value: 'in_transit', label: '輸送中' },
  { value: 'delivered', label: '配達済み' },
  { value: 'returned', label: '返品' }
];

const carrierOptions = [
  { value: 'yamato', label: 'ヤマト運輸' },
  { value: 'sagawa', label: '佐川急便' },
  { value: 'dhl', label: 'DHL' },
  { value: 'fedex', label: 'FedEx' }
];

type LineItem = OrderDetail['lineItems'][number];

type Props = {
  orderId: number;
  lineItem: LineItem;
};

export function ShipmentEditor({ orderId, lineItem }: Props) {
  const forms = lineItem.shipments.length > 0 ? lineItem.shipments : [null];

  return (
    <div className="flex flex-col gap-6">
      {forms.map((shipment, index) => (
        <form
          key={shipment?.id ?? `new-${index}`}
          action={saveShipment}
          className="grid gap-3 rounded-md border border-slate-200 bg-white p-4"
        >
          <input type="hidden" name="orderId" value={orderId} />
          <input type="hidden" name="lineItemId" value={lineItem.id} />
          <input type="hidden" name="redirectTo" value={`/orders/${orderId}`} />
          {shipment?.id ? <input type="hidden" name="shipmentId" value={shipment.id} /> : null}

          <div className="grid gap-2">
            <Label htmlFor={`tracking-${lineItem.id}-${index}`}>追跡番号</Label>
            <Input
              id={`tracking-${lineItem.id}-${index}`}
              name="trackingNumber"
              defaultValue={shipment?.trackingNumber ?? ''}
              placeholder="YT123456789JP"
              required
            />
          </div>

          <div className="grid gap-2">
            <Label htmlFor={`carrier-${lineItem.id}-${index}`}>配送業者</Label>
            <Select
              id={`carrier-${lineItem.id}-${index}`}
              name="carrier"
              defaultValue={shipment?.carrier ?? carrierOptions[0]?.value}
              required
            >
              {carrierOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>

          <div className="grid gap-2">
            <Label htmlFor={`status-${lineItem.id}-${index}`}>配送ステータス</Label>
            <Select
              id={`status-${lineItem.id}-${index}`}
              name="status"
              defaultValue={shipment?.status ?? statusOptions[0]?.value}
            >
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
          </div>

          <div className="flex justify-end">
            <Button type="submit">保存</Button>
          </div>
        </form>
      ))}
    </div>
  );
}
