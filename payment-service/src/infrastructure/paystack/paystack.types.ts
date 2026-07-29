export interface PaystackInitializeResponse {
  status: boolean;
  message: string;
  data: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
}

export interface PaystackVerifyResponse {
  status: boolean;
  message: string;
  data: {
    status: 'success' | 'failed' | 'abandoned';
    reference: string;
    amount: number;
    currency: string;
    channel: string;
    gateway_response: string;
    paid_at: string | null;
    metadata: Record<string, unknown> | null;
    customer: { email: string };
  };
}

export interface PaystackRefundResponse {
  status: boolean;
  message: string;
  data: {
    id: number;
    status: string;
    transaction: { reference: string };
  };
}
