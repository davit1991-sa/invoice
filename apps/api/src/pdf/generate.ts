import PDFDocument from 'pdfkit';

type Tenant = {
  regNumber: string;
  name: string;
  legalAddress: string;
  email: string;
  phone: string;
  iban: string;
  isVatPayer: boolean;
};

type Client = {
  taxPayerId: string;
  name: string;
  address?: string | null;
  email?: string | null;
  phone?: string | null;
  iban?: string | null;
};

function toIsoDate(d: Date) {
  try {
    return d.toISOString().slice(0, 10);
  } catch {
    return String(d);
  }
}

function bufferFromDoc(doc: PDFDocument): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    doc.on('data', (c: Buffer) => chunks.push(c));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);
    doc.end();
  });
}

function header(doc: PDFDocument, title: string) {
  doc.fontSize(18).text(title, { align: 'left' });
  doc.moveDown(0.5);
  doc.fontSize(10).fillColor('#444').text(`Generated: ${toIsoDate(new Date())}`);
  doc.fillColor('#000');
  doc.moveDown(1);
}

function block(doc: PDFDocument, caption: string) {
  doc.fontSize(12).text(caption);
  doc.moveDown(0.25);
  doc.moveTo(doc.x, doc.y).lineTo(570, doc.y).strokeColor('#ddd').stroke();
  doc.strokeColor('#000');
  doc.moveDown(0.5);
}

function kv(doc: PDFDocument, k: string, v: string) {
  doc.fontSize(10).fillColor('#333').text(k, { continued: true, width: 170 });
  doc.fillColor('#000').text(v || '—');
}

export async function generateInvoicePdf(params: {
  tenant: Tenant;
  client: Client | null;
  invoice: {
    invoiceNumber: string;
    purpose: string;
    amountNet: string;
    vatAmount: string;
    amountGross: string;
    currency: string;
    issueDate: Date;
    dueDate: Date;
    status: string;
  };
}) {
  const { tenant, client, invoice } = params;

  const doc = new PDFDocument({ size: 'A4', margin: 48 });

  header(doc, 'INVOICE');

  doc.fontSize(10).text(`Invoice Number: ${invoice.invoiceNumber}`);
  doc.text(`Status: ${invoice.status}`);
  doc.text(`Issue Date: ${toIsoDate(invoice.issueDate)}`);
  doc.text(`Due Date: ${toIsoDate(invoice.dueDate)}`);
  doc.moveDown(1);

  block(doc, 'Seller (Your Company)');
  kv(doc, 'Tax Payer ID: ', tenant.regNumber);
  kv(doc, 'Name: ', tenant.name);
  kv(doc, 'Legal Address: ', tenant.legalAddress);
  kv(doc, 'Email: ', tenant.email);
  kv(doc, 'Phone: ', tenant.phone);
  kv(doc, 'IBAN: ', tenant.iban);
  kv(doc, 'VAT payer: ', tenant.isVatPayer ? 'Yes' : 'No');
  doc.moveDown(1);

  block(doc, 'Buyer (Client)');
  if (client) {
    kv(doc, 'Tax Payer ID: ', client.taxPayerId);
    kv(doc, 'Name: ', client.name);
    kv(doc, 'Address: ', client.address || '');
    kv(doc, 'Email: ', client.email || '');
    kv(doc, 'Phone: ', client.phone || '');
    kv(doc, 'IBAN: ', client.iban || '');
  } else {
    doc.fontSize(10).text('—');
  }
  doc.moveDown(1);

  block(doc, 'Purpose');
  doc.fontSize(10).text(invoice.purpose || '—');
  doc.moveDown(1);

  block(doc, 'Amounts');
  kv(doc, 'Net: ', `${invoice.amountNet} ${invoice.currency}`);
  kv(doc, 'VAT: ', `${invoice.vatAmount} ${invoice.currency}`);
  kv(doc, 'Gross: ', `${invoice.amountGross} ${invoice.currency}`);
  doc.moveDown(1);

  doc.fontSize(9).fillColor('#555').text('This document was generated electronically.', { align: 'left' });
  doc.fillColor('#000');

  return bufferFromDoc(doc);
}

export async function generateActPdf(params: {
  tenant: Tenant;
  client: Client | null;
  act: {
    actNumber: string;
    purpose: string;
    amount: string;
    currency: string;
    issueDate: Date;
    dueDate: Date;
    status: string;
  };
}) {
  const { tenant, client, act } = params;

  const doc = new PDFDocument({ size: 'A4', margin: 48 });

  header(doc, 'ACT OF COMPARISON');

  doc.fontSize(10).text(`ACT Number: ${act.actNumber}`);
  doc.text(`Status: ${act.status}`);
  doc.text(`Issue Date: ${toIsoDate(act.issueDate)}`);
  doc.text(`Due Date: ${toIsoDate(act.dueDate)}`);
  doc.moveDown(1);

  block(doc, 'Company (Your Company)');
  kv(doc, 'Tax Payer ID: ', tenant.regNumber);
  kv(doc, 'Name: ', tenant.name);
  kv(doc, 'Legal Address: ', tenant.legalAddress);
  kv(doc, 'Email: ', tenant.email);
  kv(doc, 'Phone: ', tenant.phone);
  kv(doc, 'IBAN: ', tenant.iban);
  doc.moveDown(1);

  block(doc, 'Counterparty (Client)');
  if (client) {
    kv(doc, 'Tax Payer ID: ', client.taxPayerId);
    kv(doc, 'Name: ', client.name);
    kv(doc, 'Address: ', client.address || '');
    kv(doc, 'Email: ', client.email || '');
    kv(doc, 'Phone: ', client.phone || '');
    kv(doc, 'IBAN: ', client.iban || '');
  } else {
    doc.fontSize(10).text('—');
  }
  doc.moveDown(1);

  block(doc, 'Purpose');
  doc.fontSize(10).text(act.purpose || '—');
  doc.moveDown(1);

  block(doc, 'Amount');
  kv(doc, 'Amount: ', `${act.amount} ${act.currency}`);
  doc.moveDown(1);

  doc.fontSize(9).fillColor('#555').text('This document was generated electronically.', { align: 'left' });
  doc.fillColor('#000');

  return bufferFromDoc(doc);
}
