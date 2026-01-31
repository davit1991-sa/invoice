export type CreateInvoiceDto = {
  // Prefer selecting existing client
  clientId?: string | null;

  // Or manual client fields (system will upsert by taxPayerId under the tenant)
  clientTaxPayerId?: string | null;
  clientName?: string | null;
  clientAddress?: string | null;
  clientEmail?: string | null;
  clientPhone?: string | null;
  clientIban?: string | null;

  purpose: string;
  amountNet: string | number; // decimal(18,2)
  includeVat?: boolean;       // if true, vat = 18% (tenant must be VAT payer)
  dueDate: string;            // ISO date string
  status?: 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'CANCELED';
};

export type UpdateInvoiceDto = Partial<{
  purpose: string;
  amountNet: string | number;
  includeVat: boolean;
  dueDate: string;
  status: 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'CANCELED';
}>;

export type ListInvoicesQuery = Partial<{
  status: 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'CANCELED';
  q: string; // search by invoiceNumber or client name/id
}>;
