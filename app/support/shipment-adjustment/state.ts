export type ShipmentAdjustmentFormState = {
  status: 'idle' | 'success' | 'error';
  message: string | null;
  submissionId?: string | null;
  fieldErrors?: Partial<
    Record<
      'orderNumber' | 'issueSummary' | 'desiredChange' | 'contactEmail' | 'contactName' | 'issueType',
      string
    >
  >;
  requestId?: number | null;
};

export const initialShipmentAdjustmentFormState: ShipmentAdjustmentFormState = {
  status: 'idle',
  message: null,
  submissionId: null,
  requestId: null
};
