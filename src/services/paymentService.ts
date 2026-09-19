export type PaymentMode = 'demo' | 'production';

export interface PaymentIntentResponse {
  success: boolean;
  transactionId?: string;
  pixQrCodeData?: string;
  pixCopiaECola?: string;
  errorMessage?: string;
}

export const getPaymentMode = (): PaymentMode => {
  // Use Vite environment variable, fallback to demo if not set
  const mode = import.meta.env.VITE_PAYMENT_MODE;
  return mode === 'production' ? 'production' : 'demo';
};

export const generatePaymentIntent = async (
  orderId: string,
  amount: number,
  method: 'pix' | 'credit_card'
): Promise<PaymentIntentResponse> => {
  const mode = getPaymentMode();

  if (mode === 'demo') {
    return simulateDemoPayment(orderId, amount, method);
  }

  // Production flow
  // TODO: Implement integration with actual payment gateway (MercadoPago, Stripe, Pagar.me)
  console.warn('Production payment flow is not implemented yet. Falling back to DEMO mode for safety.');
  return simulateDemoPayment(orderId, amount, method);
};

const simulateDemoPayment = async (
  orderId: string,
  amount: number,
  method: 'pix' | 'credit_card'
): Promise<PaymentIntentResponse> => {
  // Simulate network delay
  await new Promise(resolve => setTimeout(resolve, 800));

  if (method === 'pix') {
    return {
      success: true,
      transactionId: `demo_pix_${orderId}`,
      pixQrCodeData: `00020101021126580014br.gov.bcb.pix0136${crypto.randomUUID()}5204000053039865405${amount.toFixed(2)}5802BR5915Mercado Nosso J6008SAO PAULO62070503***63041A2B`,
      pixCopiaECola: `00020101021126580014br.gov.bcb.pix0136${crypto.randomUUID()}5204000053039865405${amount.toFixed(2)}5802BR5915Mercado Nosso J6008SAO PAULO62070503***63041A2B`,
    };
  }

  if (method === 'credit_card') {
    return {
      success: true,
      transactionId: `demo_cc_${orderId}`,
    };
  }

  return {
    success: false,
    errorMessage: 'Método de pagamento desconhecido',
  };
};
