/**
 * Apex Solution payment constants for the payment portal, mirroring the
 * hotcol signup payment metadata. The backend stores channels as TELEBIRR /
 * BANK; the portal presents them with the same Telebirr / CBE copy.
 */

/** Apex Solution CBE account — all yearly subscription transfers (including Telebirr → CBE). */
export const APEX_SOLUTION_CBE_ACCOUNT = "1000418779358";

export const APEX_PAYMENT_CHANNELS = ["TELEBIRR", "BANK"] as const;

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
};
