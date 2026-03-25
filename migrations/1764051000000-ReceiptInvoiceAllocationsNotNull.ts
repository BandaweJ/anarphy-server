import { MigrationInterface, QueryRunner } from 'typeorm';

export class ReceiptInvoiceAllocationsNotNull1764051000000
  implements MigrationInterface
{
  name = 'ReceiptInvoiceAllocationsNotNull1764051000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // If any legacy/buggy allocations exist without invoiceId/receiptId, remove them.
    // They cannot be shown correctly in the ledger and cannot be reconciled deterministically.
    await queryRunner.query(`
      DELETE FROM "receipt_invoice_allocations"
      WHERE "invoiceId" IS NULL OR "receiptId" IS NULL
    `);

    // Enforce integrity going forward.
    await queryRunner.query(`
      ALTER TABLE "receipt_invoice_allocations"
      ALTER COLUMN "invoiceId" SET NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "receipt_invoice_allocations"
      ALTER COLUMN "receiptId" SET NOT NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE "receipt_invoice_allocations"
      ALTER COLUMN "receiptId" DROP NOT NULL
    `);
    await queryRunner.query(`
      ALTER TABLE "receipt_invoice_allocations"
      ALTER COLUMN "invoiceId" DROP NOT NULL
    `);
  }
}

