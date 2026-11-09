/**
 * Apex Solution payment constants for the signup and the payment portal.
 * The backend stores channels as TELEBIRR / BANK / CASH / OTHER; the UI
 * presents them with the Telebirr / CBE / Other copy.
 */

/** Apex Solution CBE account — all transfers (including Telebirr → CBE). */
export const APEX_SOLUTION_CBE_ACCOUNT = "1000176310832";

export const APEX_PAYMENT_CHANNELS = ["TELEBIRR", "BANK", "OTHER"] as const;

export type ApexPaymentChannel = (typeof APEX_PAYMENT_CHANNELS)[number];

export const APEX_PAYMENT_CHANNEL_META: Record<
  ApexPaymentChannel,
  {
    label: string;
    transactionFieldLabel: string;
    transactionPlaceholder: string;
    hint: string;
  }
> = {
  TELEBIRR: {
    label: "Telebirr",
    transactionFieldLabel: "Telebirr transaction number",
    transactionPlaceholder: "e.g. CGK8X2… from your Telebirr receipt",
    hint: `Transfer via Telebirr to Apex Solution CBE account ${APEX_SOLUTION_CBE_ACCOUNT}, then enter the Telebirr transaction number from your receipt.`,
  },
  BANK: {
    label: "Commercial Bank of Ethiopia (CBE)",
    transactionFieldLabel: "CBE transaction ID",
    transactionPlaceholder: "e.g. FT25234… from your bank slip or app",
    hint: `Deposit to Apex Solution CBE account ${APEX_SOLUTION_CBE_ACCOUNT}, then enter the CBE transaction ID from your confirmation.`,
  },
  OTHER: {
    label: "Other",
    transactionFieldLabel: "Transaction reference",
    transactionPlaceholder: "Reference from your payment receipt",
    hint: `Pay via Telebirr, CBE (${APEX_SOLUTION_CBE_ACCOUNT}), or any method agreed with Apex, then enter the transaction reference from your receipt.`,
  },
};
