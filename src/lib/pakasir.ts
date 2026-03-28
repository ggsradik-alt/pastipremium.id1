// Pakasir Payment Gateway Integration
// Docs: https://pakasir.com/p/docs

const PAKASIR_SLUG = process.env.PAKASIR_SLUG || 'pastipremiumid1';
const PAKASIR_API_KEY = process.env.PAKASIR_API_KEY || '';
const PAKASIR_BASE_URL = 'https://app.pakasir.com';

export interface PakasirCreateResponse {
  payment: {
    project: string;
    order_id: string;
    amount: number;
    fee: number;
    total_payment: number;
    payment_method: string;
    payment_number: string;
    expired_at: string;
  };
}

export interface PakasirWebhookPayload {
  amount: number;
  order_id: string;
  project: string;
  status: string;
  payment_method: string;
  completed_at: string;
}

export interface PakasirTransactionDetail {
  transaction: {
    amount: number;
    order_id: string;
    project: string;
    status: string;
    payment_method: string;
    completed_at: string;
  };
}

/**
 * Create a transaction via Pakasir API
 * Returns QRIS string / VA number for display
 */
export async function createPakasirTransaction(
  orderId: string,
  amount: number,
  method: 'qris' | 'bri_va' | 'bni_va' | 'cimb_niaga_va' | 'permata_va' | 'maybank_va' | 'bnc_va' | 'sampoerna_va' | 'artha_graha_va' | 'atm_bersama_va' = 'qris'
): Promise<PakasirCreateResponse> {
  const res = await fetch(`${PAKASIR_BASE_URL}/api/transactioncreate/${method}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      project: PAKASIR_SLUG,
      order_id: orderId,
      amount: amount,
      api_key: PAKASIR_API_KEY,
    }),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Pakasir API error: ${res.status} - ${text}`);
  }

  return res.json();
}

/**
 * Get transaction detail / status from Pakasir
 */
export async function getPakasirTransaction(
  orderId: string,
  amount: number
): Promise<PakasirTransactionDetail> {
  const params = new URLSearchParams({
    project: PAKASIR_SLUG,
    order_id: orderId,
    amount: amount.toString(),
    api_key: PAKASIR_API_KEY,
  });

  const res = await fetch(`${PAKASIR_BASE_URL}/api/transactiondetail?${params}`);
  if (!res.ok) {
    throw new Error(`Pakasir detail error: ${res.status}`);
  }
  return res.json();
}

/**
 * Cancel a Pakasir transaction
 */
export async function cancelPakasirTransaction(
  orderId: string,
  amount: number
): Promise<void> {
  await fetch(`${PAKASIR_BASE_URL}/api/transactioncancel`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      project: PAKASIR_SLUG,
      order_id: orderId,
      amount: amount,
      api_key: PAKASIR_API_KEY,
    }),
  });
}

/**
 * Generate Pakasir payment link (redirect-based, simpler)
 */
export function getPakasirPaymentUrl(orderId: string, amount: number, redirectUrl?: string): string {
  let url = `${PAKASIR_BASE_URL}/pay/${PAKASIR_SLUG}/${amount}?order_id=${orderId}`;
  if (redirectUrl) {
    url += `&redirect=${encodeURIComponent(redirectUrl)}`;
  }
  return url;
}
