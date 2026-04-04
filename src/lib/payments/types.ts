// ============================================
// GENESIS STUDIO — Payment Provider Interfaces
// ============================================

export interface PaymentProvider {
  name: string;
  createCheckout(params: CheckoutParams): Promise<CheckoutResult>;
  verifyPayment(reference: string): Promise<PaymentVerification>;
  handleWebhook(
    body: unknown,
    headers: Record<string, string>
  ): Promise<WebhookResult>;
}

export interface CheckoutParams {
  amount: number; // cents (ZAR)
  currency: string; // "ZAR"
  email: string;
  userId: string;
  description: string;
  metadata: Record<string, string>;
  successUrl: string;
  cancelUrl: string;
  notifyUrl: string; // webhook URL
}

export interface CheckoutResult {
  checkoutId: string;
  redirectUrl: string;
  provider: string;
}

export interface PaymentVerification {
  success: boolean;
  amount: number;
  reference: string;
  metadata: Record<string, string>;
}

export interface WebhookResult {
  event:
    | "payment.success"
    | "payment.failed"
    | "subscription.cancelled"
    | "unknown";
  reference: string;
  metadata: Record<string, string>;
  amount?: number;
}
