import Link from "next/link";
import { Button } from "@/components/ui/button";

function Section({ id, title, children }: { id: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24 py-16">
      <div className="mx-auto max-w-6xl px-4">
        <h2 className="text-2xl font-semibold tracking-tight text-slate-900">{title}</h2>
        <div className="mt-4 text-slate-600 leading-relaxed">{children}</div>
      </div>
    </section>
  );
}

export default function HomePage() {
  return (
    <div>
      <section className="relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-b from-slate-50 to-white" />
        <div className="absolute -top-24 -right-24 h-80 w-80 rounded-full bg-slate-100 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-80 w-80 rounded-full bg-slate-100 blur-3xl" />

        <div className="relative mx-auto max-w-6xl px-4 py-20">
          <div className="grid gap-10 lg:grid-cols-2 items-center">
            <div>
              <h1 className="text-4xl lg:text-5xl font-semibold tracking-tight text-slate-900">
                Create invoices and compare acts online — fast, clean, and Georgian-market ready.
              </h1>
              <p className="mt-4 text-slate-600 text-lg leading-relaxed">
                Save, send, and manage invoices/acts. Download PDF or send via Email/WhatsApp. Track paid vs pending.
              </p>

              <div className="mt-8 flex flex-wrap gap-3">
                <Link href="/auth/register">
                  <Button size="lg">Create Invoice</Button>
                </Link>
                <Link href="/auth/register">
                  <Button size="lg" variant="outline">Create Compare Act</Button>
                </Link>
              </div>

              <div className="mt-6 text-xs text-slate-500">
                First customers: 1 free invoice + 1 free act (IP-based control in backend — coming in next batches).
              </div>
            </div>

            <div className="rounded-2xl border border-slate-200 bg-white shadow-sm p-6">
              <div className="text-sm text-slate-500">Preview</div>
              <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-4">
                <div className="flex items-center justify-between">
                  <div className="font-medium text-slate-900">Invoice INV-0001</div>
                  <div className="text-xs rounded-full px-2 py-1 bg-white border border-slate-200 text-slate-600">
                    DRAFT
                  </div>
                </div>
                <div className="mt-3 grid grid-cols-2 gap-3 text-sm">
                  <div className="text-slate-600">
                    <div className="text-xs text-slate-500">Client</div>
                    Demo Client LLC
                  </div>
                  <div className="text-slate-600">
                    <div className="text-xs text-slate-500">Amount</div>
                    1,250.00 GEL
                  </div>
                  <div className="text-slate-600">
                    <div className="text-xs text-slate-500">Due date</div>
                    2026-02-10
                  </div>
                  <div className="text-slate-600">
                    <div className="text-xs text-slate-500">Channel</div>
                    Email / WhatsApp
                  </div>
                </div>
                <div className="mt-4 flex gap-2">
                  <Button size="sm">Send Email</Button>
                  <Button size="sm" variant="outline">Send WhatsApp</Button>
                  <Button size="sm" variant="ghost">Download PDF</Button>
                </div>
              </div>

              <div className="mt-4 text-xs text-slate-500">
                UI is scaffolded. Business logic will be wired step-by-step in next batches.
              </div>
            </div>
          </div>
        </div>
      </section>

      <Section id="about" title="About us">
        We help Georgian SMEs and individuals create professional invoices and debt compare acts without Excel.
        The platform is designed for speed, VAT support, and simple sending workflows.
      </Section>

      <Section id="start" title="Start Invoicing">
        Register, verify your identity (Revenue Service integration in next batch), add clients (manual/import),
        then create invoices/acts, export PDFs, and send notifications via email or WhatsApp.
      </Section>

      <Section id="subscription" title="Subscription">
        Planned packages:
        <ul className="list-disc pl-5 mt-3">
          <li>100 GEL / month: unlimited invoices & acts (no client list)</li>
          <li>250 GEL / month: unlimited clients + invoices + acts</li>
          <li>20 GEL: 5 invoices + 5 acts</li>
        </ul>
      </Section>

      <Section id="contact" title="Contact">
        Email: support@your-domain.ge <br />
        Phone/WhatsApp: +995 XXX XX XX XX
      </Section>
    </div>
  );
}
