import { FeesNames } from '../../finance/models/fees-names.enum';
import { ExemptionType } from '../../exemptions/enums/exemptions-type.enum';

export type BillLike = {
  fees?: {
    name?: FeesNames;
    amount?: number;
  } | null;
};

export type ExemptionLike = {
  type?: ExemptionType;
  isActive?: boolean;
  fixedAmount?: number | string | null;
  percentageAmount?: number | string | null;
};

export type InvoiceLedgerInput = {
  totalBill: number;
  receiptAllocations: number[]; // receipt_invoice_allocations.amountApplied for this invoice
  creditAllocations: number[]; // credit_invoice_allocations.amountApplied for this invoice
};

export type InvoiceLedgerOutput = {
  receiptPaid: number;
  creditApplied: number;
  totalPaid: number; // receiptPaid + creditApplied
  amountPaidOnInvoice: number; // totalPaid capped to totalBill (for display/status)
  balance: number; // max(0, totalBill - totalPaid)
};

function toNumber(value: number | string | null | undefined): number {
  if (value === null || value === undefined) return 0;
  const n = typeof value === 'number' ? value : parseFloat(String(value));
  return Number.isFinite(n) ? n : 0;
}

export function computeGrossBillAmount(bills: BillLike[]): number {
  // IMPORTANT: Exemption discount is NOT part of persisted bill rows.
  // If an exemption line item accidentally appears inside bills, ignore it here
  // to prevent double-discount.
  return (bills || []).reduce((sum, bill) => {
    const feeName = bill.fees?.name;
    if (feeName === FeesNames.exemption) return sum;
    const amount = toNumber(bill.fees?.amount);
    return sum + amount;
  }, 0);
}

export function computeExemptionAmount(
  bills: BillLike[],
  studentExemption: ExemptionLike | null | undefined,
): number {
  if (!studentExemption?.type || !studentExemption.isActive) return 0;

  const type = studentExemption.type;
  const grossBillAmount = computeGrossBillAmount(bills);

  switch (type) {
    case ExemptionType.FIXED_AMOUNT:
      return toNumber(studentExemption.fixedAmount);
    case ExemptionType.PERCENTAGE: {
      const percentage = toNumber(studentExemption.percentageAmount);
      return (grossBillAmount * percentage) / 100;
    }
    case ExemptionType.STAFF_SIBLING: {
      let foodFeeTotal = 0;
      let otherFeesTotal = 0;
      for (const bill of bills || []) {
        const feeName = bill.fees?.name;
        if (feeName === FeesNames.exemption) continue;
        const amount = toNumber(bill.fees?.amount);
        if (feeName === FeesNames.foodFee) foodFeeTotal += amount;
        else otherFeesTotal += amount;
      }
      return otherFeesTotal + foodFeeTotal * 0.5;
    }
    default:
      return 0;
  }
}

export function computeNetBillAmount(
  bills: BillLike[],
  studentExemption: ExemptionLike | null | undefined,
): number {
  const gross = computeGrossBillAmount(bills);
  const exemptionAmount = computeExemptionAmount(bills, studentExemption);
  return Math.max(0, gross - exemptionAmount);
}

export function computeInvoiceLedger(
  input: InvoiceLedgerInput,
  tolerance = 0.01,
): InvoiceLedgerOutput {
  const totalBill = toNumber(input.totalBill);

  const receiptPaidRaw = (input.receiptAllocations || []).reduce(
    (sum, a) => sum + toNumber(a),
    0,
  );
  const creditAppliedRaw = (input.creditAllocations || []).reduce(
    (sum, a) => sum + toNumber(a),
    0,
  );
  const receiptPaid = round2(receiptPaidRaw);
  const creditApplied = round2(creditAppliedRaw);
  const totalPaid = round2(receiptPaid + creditApplied);

  // Persisted DB values are decimal(10,2); keep the in-memory model consistent.
  const roundedTotalBill = round2(totalBill);

  // amountPaidOnInvoice is for display/status; balance is canonical for eligibility.
  const amountPaidOnInvoice = Math.min(roundedTotalBill, totalPaid);
  const balanceRaw = roundedTotalBill - totalPaid;
  const balance = Math.max(0, round2(Math.abs(balanceRaw) <= tolerance ? 0 : balanceRaw));

  return {
    receiptPaid,
    creditApplied,
    totalPaid,
    amountPaidOnInvoice,
    balance,
  };
}

export type CreditTransactionLike = {
  id?: number;
  transactionType: 'CREDIT';
  relatedInvoiceId?: number | null;
  amount: number; // positive
  fingerprint?: string;
};

export type InvoiceReconciliationState = {
  id: number;
  invoiceNumber?: string;
  invoiceDate: Date;
  totalBill: number;
  receiptAllocations: number[];
  creditAllocations: number[];
};

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

export function makeOverpaymentFingerprint(
  invoiceId: number,
  overpaymentAmount: number,
): string {
  return `${invoiceId}:${round2(overpaymentAmount)}`;
}

export function getInvoiceBalance(state: InvoiceReconciliationState): number {
  return computeInvoiceLedger({
    totalBill: state.totalBill,
    receiptAllocations: state.receiptAllocations,
    creditAllocations: state.creditAllocations,
  }).balance;
}

/**
 * In-memory simulator of "overpayment credit + FIFO credit application".
 * This is for unit tests and reconciliation invariants; it does not hit the DB.
 */
export function simulateReconciliationRun(params: {
  studentCreditAmount: number;
  creditTransactions: CreditTransactionLike[];
  invoices: InvoiceReconciliationState[];
  tolerance?: number;
}): {
  studentCreditAmount: number;
  creditTransactions: CreditTransactionLike[];
  invoices: InvoiceReconciliationState[];
} {
  const tolerance = params.tolerance ?? 0.01;
  let studentCreditAmount = toNumber(params.studentCreditAmount);
  const creditTransactions = [...(params.creditTransactions || [])];

  const invoices = params.invoices.map((inv) => ({
    ...inv,
    receiptAllocations: [...(inv.receiptAllocations || [])],
    creditAllocations: [...(inv.creditAllocations || [])],
  }));

  // 1) Create overpayment credits (idempotent via fingerprint)
  for (const invoice of invoices) {
    const ledger = computeInvoiceLedger({
      totalBill: invoice.totalBill,
      receiptAllocations: invoice.receiptAllocations,
      creditAllocations: invoice.creditAllocations,
    }, tolerance);

    const totalPaid = ledger.totalPaid;
    const overpayment = totalPaid - round2(toNumber(invoice.totalBill));

    if (overpayment <= tolerance) continue;

    const alreadyCredited = creditTransactions
      .filter(
        (t) => t.transactionType === 'CREDIT' && t.relatedInvoiceId === invoice.id,
      )
      .reduce((sum, t) => sum + toNumber(t.amount), 0);

    // If invoice totals changed since the last reconciliation, we may need to create
    // additional credit for the delta in overpayment (but never double-credit the past).
    const additionalCredit = overpayment - alreadyCredited;
    if (additionalCredit <= tolerance) continue;

    const fingerprint = makeOverpaymentFingerprint(invoice.id, overpayment);

    creditTransactions.push({
      transactionType: 'CREDIT',
      relatedInvoiceId: invoice.id,
      amount: round2(additionalCredit),
      fingerprint,
    });
    studentCreditAmount += round2(additionalCredit);
  }

  // 2) Apply credit to oldest invoices with balance > tolerance
  const sortedByOldest = [...invoices].sort(
    (a, b) => a.invoiceDate.getTime() - b.invoiceDate.getTime(),
  );

  for (const invoice of sortedByOldest) {
    if (studentCreditAmount <= tolerance) break;

    const currentBalance = getInvoiceBalance(invoice);
    if (currentBalance <= tolerance) continue;

    const applyAmount = Math.min(currentBalance, studentCreditAmount);
    if (applyAmount <= tolerance) continue;

    invoice.creditAllocations.push(round2(applyAmount));
    studentCreditAmount -= round2(applyAmount);
  }

  return {
    studentCreditAmount,
    creditTransactions,
    invoices,
  };
}

