export type RecoveryCase = {
  id: string;
  case_ref: string;
  customer: string;
  case_type: string;
  amount: number;
  failure_reason: string;
  attempts: number;
  status: string;
  opt_out: boolean;
  preferred_lang: string;
  recovered_amount: number;
  last_action: string | null;
  last_message: string | null;
  pay_url: string;
  checkout_url: string;
  escalation_note: string | null;
  stopping_rule: string | null;
};

export type MessageTemplate = {
  id: string;
  failure_reason: string;
  strategy: string;
  english_template: string;
  hinglish_template: string;
};

export const MAX_ATTEMPTS = 3;

export const CASE_TYPES = [
  "Overdue Receivable",
  "Failed Subscription",
  "Checkout Abandonment",
];

export const REASONS = [
  "Invoice Overdue 45 Days",
  "Card Declined (Insufficient Funds)",
  "Expired Credit Card",
  "Payment Gateway Timeout",
  "Disputed Invoice / Legal Notice Requested",
];

export const STATUSES = ["Pending", "Recovered", "Escalated", "In Review"];

export function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
  }).format(value);
}

export function fillTemplate(template: string, item: RecoveryCase) {
  return template
    .replaceAll("{customer}", item.customer)
    .replaceAll("{first_name}", item.customer.split(" ")[0] ?? item.customer)
    .replaceAll("{reference}", item.case_ref)
    .replaceAll("{amount}", formatCurrency(item.amount))
    .replaceAll("{pay_url}", item.pay_url || "(no payment link set)")
    .replaceAll("{checkout_url}", item.checkout_url || "(no checkout link set)");
}

export type Outcome = {
  status: string;
  attempts: number;
  recovered_amount: number;
  last_action: string;
  last_message: string;
  stopping_rule: string | null;
};

export function evaluate(
  item: RecoveryCase,
  templates: MessageTemplate[]
): Outcome {
  if (item.opt_out) {
    return {
      status: "Escalated",
      attempts: item.attempts,
      recovered_amount: 0,
      last_action: "Halted automated reach-out; flagged for compliance review.",
      last_message: "",
      stopping_rule: "STOP: Customer opted out / dispute raised",
    };
  }

  if (item.attempts >= MAX_ATTEMPTS) {
    return {
      status: "Escalated",
      attempts: item.attempts,
      recovered_amount: 0,
      last_action: "Transferred to manual outreach team.",
      last_message: "",
      stopping_rule: `STOP: Max attempts limit (${MAX_ATTEMPTS}) reached`,
    };
  }

  const template = templates.find(
    (row) => row.failure_reason === item.failure_reason
  );

  if (!template) {
    return {
      status: "Escalated",
      attempts: item.attempts,
      recovered_amount: 0,
      last_action: "No message template found for this reason.",
      last_message: "",
      stopping_rule: "STOP: Missing message template",
    };
  }

  const raw =
    item.preferred_lang === "Hinglish"
      ? template.hinglish_template || template.english_template
      : template.english_template || template.hinglish_template;

  const recovered = item.failure_reason.includes("Overdue")
    ? item.amount * 0.5
    : item.amount;

  return {
    status: "Recovered",
    attempts: item.attempts + 1,
    recovered_amount: recovered,
    last_action: template.strategy || "Recovery outreach sent",
    last_message: fillTemplate(raw, item),
    stopping_rule: null,
  };
}

export function normalizeCase(row: Record<string, unknown>): RecoveryCase {
  return {
    ...(row as unknown as RecoveryCase),
    amount: Number(row['amount']),
    recovered_amount: Number(row['recovered_amount']),
    pay_url: (row['pay_url'] as string) ?? "",
    checkout_url: (row['checkout_url'] as string) ?? "",
  };
}
