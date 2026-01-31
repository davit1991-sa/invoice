export type CreateClientDto = {
  taxPayerId: string;
  name: string;
  address?: string | null;
  email?: string | null;
  phone?: string | null;
  iban?: string | null;
};

export type UpdateClientDto = Partial<CreateClientDto>;

export type ImportCsvDto = {
  csv: string;
  // if true, update existing by (tenantId, taxPayerId)
  upsert?: boolean;
};
