/** Owner-facing payment method details (not admin-editable). */

export type PaymentDetailRow = {
  /** i18n key under billing.*, e.g. "payRecipient" */
  labelKey:
    | "payRecipient"
    | "payRevolutUser"
    | "payIban"
    | "payBic"
    | "payBankName"
    | "payAmount"
    | "payReference";
  /** Static value; omit when the value is dynamic. */
  value?: string;
  /** When true, row value is the formatted amount due. */
  amount?: boolean;
  /** When true, row value is the monthly payment reference (основание). */
  reference?: boolean;
};

export const BANK_TRANSFER_DETAILS = {
  recipientName: "Georgi Nikolov",
  iban: "BG29FINV91501015456617",
  bic: "FINVBGSF",
  bankName: "First Investment Bank",
} as const;

export const BANK_TRANSFER_ROWS: readonly PaymentDetailRow[] = [
  { labelKey: "payRecipient", value: BANK_TRANSFER_DETAILS.recipientName },
  { labelKey: "payIban", value: BANK_TRANSFER_DETAILS.iban },
  { labelKey: "payBic", value: BANK_TRANSFER_DETAILS.bic },
  { labelKey: "payBankName", value: BANK_TRANSFER_DETAILS.bankName },
  { labelKey: "payAmount", amount: true },
  { labelKey: "payReference", reference: true },
];

export const REVOLUT_DETAILS = {
  username: "@georgin",
  /** Opens Revolut app / revolut.me profile for this user. */
  payUrl: "https://revolut.me/georgin",
} as const;

export const REVOLUT_ROWS: readonly PaymentDetailRow[] = [
  { labelKey: "payRevolutUser", value: REVOLUT_DETAILS.username },
  { labelKey: "payAmount", amount: true },
  { labelKey: "payReference", reference: true },
];
