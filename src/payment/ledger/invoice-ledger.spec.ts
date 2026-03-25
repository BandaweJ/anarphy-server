import {
  computeExemptionAmount,
  computeInvoiceLedger,
  computeNetBillAmount,
  computeGrossBillAmount,
  simulateReconciliationRun,
  simulateFromScratchFifoRebuild,
} from './invoice-ledger';
import { FeesNames } from '../../finance/models/fees-names.enum';
import { ExemptionType } from '../../exemptions/enums/exemptions-type.enum';

describe('Billing ledger (in-memory)', () => {
  describe('Exemptions', () => {
    it('FIXED_AMOUNT: computes net = gross - fixed once', () => {
      const bills = [
        { fees: { name: FeesNames.aLevelApplicationFee, amount: 100 } },
        // Even if an exemption line sneaks in, it must be ignored for gross.
        { fees: { name: FeesNames.exemption, amount: 999 } },
      ];
      const exemption = {
        type: ExemptionType.FIXED_AMOUNT,
        isActive: true,
        fixedAmount: 20,
      } as const;

      expect(computeGrossBillAmount(bills as any)).toBe(100);
      expect(computeExemptionAmount(bills as any, exemption as any)).toBe(20);
      expect(computeNetBillAmount(bills as any, exemption as any)).toBe(80);
    });

    it('PERCENTAGE: computes net = gross - (gross * percentage) once', () => {
      const bills = [
        { fees: { name: FeesNames.aLevelApplicationFee, amount: 200 } },
      ];
      const exemption = {
        type: ExemptionType.PERCENTAGE,
        isActive: true,
        percentageAmount: 10,
      } as const;

      expect(computeNetBillAmount(bills as any, exemption as any)).toBe(180);
    });

    it('STAFF_SIBLING: food is halved and others fully exempt', () => {
      const bills = [
        { fees: { name: FeesNames.foodFee, amount: 50 } }, // 25 exempt
        { fees: { name: FeesNames.admissionFee, amount: 30 } }, // 30 exempt
      ];
      const exemption = {
        type: ExemptionType.STAFF_SIBLING,
        isActive: true,
      } as const;

      // gross = 80, exempt = 30 + (50*0.5) = 55, net = 25
      expect(computeExemptionAmount(bills as any, exemption as any)).toBe(55);
      expect(computeNetBillAmount(bills as any, exemption as any)).toBe(25);
    });
  });

  describe('Step 7: reconciliation invariants (in-memory simulation)', () => {
    it('Partial payment: balance reduces by receipt allocations', () => {
      const ledger = computeInvoiceLedger({
        totalBill: 100,
        receiptAllocations: [30, 20],
        creditAllocations: [],
      });

      expect(ledger.receiptPaid).toBe(50);
      expect(ledger.creditApplied).toBe(0);
      expect(ledger.balance).toBe(50);
    });

    it('Tiny overpayment within tolerance: balance becomes 0 (eligibility safe)', () => {
      const ledger = computeInvoiceLedger({
        totalBill: 100,
        receiptAllocations: [100.005],
        creditAllocations: [],
      });
      // DB scale(2) + eligibility tolerance(0.01) => treat as paid
      expect(ledger.balance).toBe(0);
    });

    it('Receipt overpayment: creates credit once and FIFO applies it; rerun is idempotent', () => {
      const invoices = [
        {
          id: 1,
          invoiceNumber: 'INV-A',
          invoiceDate: new Date('2026-01-01'),
          totalBill: 100,
          receiptAllocations: [120],
          creditAllocations: [],
        },
        {
          id: 2,
          invoiceNumber: 'INV-B',
          invoiceDate: new Date('2026-01-02'),
          totalBill: 50,
          receiptAllocations: [],
          creditAllocations: [],
        },
      ];

      const creditTransactions: any[] = [];
      const first = simulateReconciliationRun({
        studentCreditAmount: 0,
        creditTransactions,
        invoices,
      });

      expect(first.creditTransactions).toHaveLength(1);
      // Invoice A is overpaid => balance 0
      const invA = first.invoices.find((i) => i.id === 1)!;
      const invB = first.invoices.find((i) => i.id === 2)!;
      expect(invA.creditAllocations).toHaveLength(0); // credit applied to B (oldest with positive balance)
      expect(invA.creditAllocations.reduce((s, x) => s + x, 0)).toBe(0);

      // Credit 20 applied to B reduces balance from 50 -> 30
      expect(invB.creditAllocations).toEqual([20]);
      const invBLedger = computeInvoiceLedger({
        totalBill: invB.totalBill,
        receiptAllocations: invB.receiptAllocations,
        creditAllocations: invB.creditAllocations,
      });
      expect(invBLedger.balance).toBe(30);

      // Rerun with same inputs should not create another credit and balances remain stable
      const second = simulateReconciliationRun({
        studentCreditAmount: first.studentCreditAmount,
        creditTransactions: first.creditTransactions,
        invoices: first.invoices,
      });

      expect(second.creditTransactions).toHaveLength(1);
      const invB2 = second.invoices.find((i) => i.id === 2)!;
      const invBLedger2 = computeInvoiceLedger({
        totalBill: invB2.totalBill,
        receiptAllocations: invB2.receiptAllocations,
        creditAllocations: invB2.creditAllocations,
      });
      expect(invBLedger2.balance).toBe(30);
    });

    it('Credit applied: balance reduces by credit allocations', () => {
      const invoices = [
        {
          id: 1,
          invoiceNumber: 'INV-A',
          invoiceDate: new Date('2026-01-01'),
          totalBill: 100,
          receiptAllocations: [70],
          creditAllocations: [30],
        },
      ];

      const ledger = computeInvoiceLedger({
        totalBill: 100,
        receiptAllocations: [70],
        creditAllocations: [30],
      });
      expect(ledger.balance).toBe(0);

      // Also verify simulation applies existing student credit to invoices with balance
      const sim = simulateReconciliationRun({
        studentCreditAmount: 20,
        creditTransactions: [],
        invoices: [
          {
            ...invoices[0],
            receiptAllocations: [50],
            creditAllocations: [],
            totalBill: 100,
          },
        ],
      });

      const inv = sim.invoices[0];
      const invLedger = computeInvoiceLedger({
        totalBill: inv.totalBill,
        receiptAllocations: inv.receiptAllocations,
        creditAllocations: inv.creditAllocations,
      });
      expect(invLedger.balance).toBe(30);
    });

    it('Invoice total changes after payments: reconciliation creates only the incremental additional credit (no double-credit)', () => {
      const initialInvoices = [
        {
          id: 1,
          invoiceNumber: 'INV-A',
          invoiceDate: new Date('2026-01-01'),
          totalBill: 110,
          receiptAllocations: [120], // overpayment = 10
          creditAllocations: [],
        },
        {
          id: 2,
          invoiceNumber: 'INV-B',
          invoiceDate: new Date('2026-01-02'),
          totalBill: 50,
          receiptAllocations: [],
          creditAllocations: [],
        },
      ];

      const first = simulateReconciliationRun({
        studentCreditAmount: 0,
        creditTransactions: [],
        invoices: initialInvoices,
      });

      const creditedTotal1 = first.creditTransactions.reduce(
        (sum, t) => sum + Number(t.amount || 0),
        0,
      );
      expect(creditedTotal1).toBe(10);

      // Now reduce invoice A totalBill by 10 => new overpayment becomes 20.
      const secondInputInvoices = first.invoices.map((i) =>
        i.id === 1 ? { ...i, totalBill: 100 } : i,
      );

      const second = simulateReconciliationRun({
        studentCreditAmount: first.studentCreditAmount,
        creditTransactions: first.creditTransactions,
        invoices: secondInputInvoices,
      });

      const creditedTotal2 = second.creditTransactions.reduce(
        (sum, t) => sum + Number(t.amount || 0),
        0,
      );

      // Existing 10 already created; incremental should be +10 => total 20
      expect(creditedTotal2).toBe(20);
    });

    it('Exemptions applied once in net totals (covers FIXED/PERCENTAGE/STAFF_SIBLING and double-discount risk)', () => {
      const staffSiblingBills = [
        { fees: { name: FeesNames.foodFee, amount: 50 } },
        { fees: { name: FeesNames.admissionFee, amount: 30 } },
        // If the UI adds an exemption fee row (presentation), it must not be double-counted.
        { fees: { name: FeesNames.exemption, amount: -999 } },
      ];
      const staffExemption = {
        type: ExemptionType.STAFF_SIBLING,
        isActive: true,
      } as const;

      // gross = 80, exemption = 55, net = 25
      expect(computeNetBillAmount(staffSiblingBills as any, staffExemption as any)).toBe(25);
    });

    it('From-scratch FIFO rebuild: fully-paid invoice creates no credit, excess becomes credit', () => {
      const invoices = [
        { id: 1, invoiceDate: new Date('2026-01-01'), totalBill: 3140 },
      ];
      const receipts = [
        { id: 10, paymentDate: new Date('2026-01-02'), amountPaid: 3140 },
      ];

      const out = simulateFromScratchFifoRebuild({ invoices, receipts });
      expect(out.invoices[0].balance).toBe(0);
      expect(out.receiptCredits).toHaveLength(0);

      const out2 = simulateFromScratchFifoRebuild({
        invoices,
        receipts: [{ id: 11, paymentDate: new Date('2026-01-02'), amountPaid: 6280 }],
      });
      expect(out2.invoices[0].balance).toBe(0);
      expect(out2.receiptCredits).toEqual([{ receiptId: 11, creditAmount: 3140 }]);
    });
  });
});

