import { InvoiceEntity } from '../entities/invoice.entity';

export class InvoiceResponseDto {
  invoice: InvoiceEntity;
  warning?: {
    message: string;
    voidedInvoiceNumber?: string;
    voidedAt?: Date;
    voidedBy?: string;
  };
  // For group invoices, include all invoices in the group
  groupInvoices?: InvoiceEntity[];
}



