export type CreateActDto = {
  clientId?: string | null;

  clientTaxPayerId?: string | null;
  clientName?: string | null;
  clientAddress?: string | null;
  clientEmail?: string | null;
  clientPhone?: string | null;
  clientIban?: string | null;

  purpose: string;
  amount: string | number; // decimal(18,2)
  dueDate: string;         // ISO date string
  status?: 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'CANCELED';
};

export type UpdateActDto = Partial<{
  purpose: string;
  amount: string | number;
  dueDate: string;
  status: 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'CANCELED';
}>;

export type ListActsQuery = Partial<{
  status: 'DRAFT' | 'SENT' | 'PAID' | 'OVERDUE' | 'CANCELED';
  q: string; // search by actNumber or client name/id
}>;
