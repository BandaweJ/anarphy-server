/* eslint-disable prettier/prettier */
// src/finance/entities/receipt-invoice-allocation.entity.ts
import {
  Check,
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
  BeforeInsert,
  BeforeUpdate,
  CreateDateColumn,
} from 'typeorm';
import { ReceiptEntity } from './payment.entity'; // Assuming your receipt entity is in payment.entity.ts
import { InvoiceEntity } from './invoice.entity';

@Entity('receipt_invoice_allocations')
@Check(`"amountApplied" > 0`)
export class ReceiptInvoiceAllocationEntity {
  @PrimaryGeneratedColumn()
  id: number;

  // Explicit FK columns (already exist in DB due to @JoinColumn).
  // Having them as real columns allows us to set them deterministically (e.g. during reconciliation)
  // and prevents NULL FK inserts that break the ledger.
  @Column({ name: 'receiptId', type: 'int', nullable: false })
  receiptId: number;

  @Column({ name: 'invoiceId', type: 'int', nullable: false })
  invoiceId: number;

  // Many-to-One relationship with ReceiptEntity
  // This column (receiptId) will be the foreign key in the database
  @ManyToOne(() => ReceiptEntity, (receipt) => receipt.allocations, {
    onDelete: 'CASCADE',
  }) // If a receipt is deleted, its allocations are too
  @JoinColumn({ name: 'receiptId' }) // The actual column name for the FK
  receipt: ReceiptEntity;

  // Many-to-One relationship with InvoiceEntity
  // This column (invoiceId) will be the foreign key in the database
  @ManyToOne(() => InvoiceEntity, (invoice) => invoice.allocations, {
    onDelete: 'RESTRICT',
  }) // Usually RESTRICT for financial data
  @JoinColumn({ name: 'invoiceId' }) // The actual column name for the FK
  invoice: InvoiceEntity;

  @Column({
    type: 'decimal',
    precision: 10,
    scale: 2,
    transformer: {
      to: (value: number) => {
        if (value === null || value === undefined || isNaN(value)) {
          return '0.00';
        }
        const numValue = typeof value === 'number' ? value : parseFloat(String(value));
        if (isNaN(numValue)) {
          return '0.00';
        }
        // Ensure value doesn't exceed precision
        if (numValue > 99999999.99) {
          throw new Error(`Amount ${numValue} exceeds maximum allowed value (99,999,999.99)`);
        }
        return numValue.toFixed(2);
      },
      from: (value: string | number) => {
        if (value === null || value === undefined) {
          return 0;
        }
        if (typeof value === 'string') {
          const parsed = parseFloat(value);
          return isNaN(parsed) ? 0 : parsed;
        }
        return value;
      },
    },
    comment: 'Amount of this specific receipt applied to this specific invoice. Must be greater than zero (enforced by database constraint)',
  })
  amountApplied: number;

  @CreateDateColumn({ type: 'timestamp' })
  allocationDate: Date; // Timestamp for when this allocation was made

  // Safety net: some creation paths may only set `receipt: { id }` / `invoice: { id }`
  // relation stubs. Since `receiptId`/`invoiceId` are NOT NULL, sync them from relations
  // before persisting to avoid runtime FK constraint violations.
  @BeforeInsert()
  @BeforeUpdate()
  private syncForeignKeys(): void {
    if ((!this.receiptId || this.receiptId === 0) && this.receipt?.id) {
      this.receiptId = this.receipt.id;
    }
    if ((!this.invoiceId || this.invoiceId === 0) && this.invoice?.id) {
      this.invoiceId = this.invoice.id;
    }
  }
}
