/**
 * Currency formatting, matching the legacy app exactly.
 *
 * `en-US` is hardcoded there and hardcoded here on purpose: the output reaches
 * a parent in a payment message, and batch 1.11's golden test asserts it byte
 * for byte — including the non-breaking space `Intl` puts between the currency
 * code and the amount.
 */
export const formatCurrency = (amount: number, currency: string): string =>
  new Intl.NumberFormat("en-US", { style: "currency", currency }).format(
    amount,
  );

export const SUPPORTED_CURRENCIES = ["UAH", "PLN"] as const;
