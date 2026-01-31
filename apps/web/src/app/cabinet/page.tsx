"use client";

import { useEffect, useState } from "react";
import { getWithAuth } from "@/lib/authedFetch";
import { Button } from "@/components/ui/button";
import Link from "next/link";

type Tenant = {
  id: string;
  name: string;
  regNumber: string;
  legalAddress: string;
  email: string;
  phone: string;
  iban: string;
  isVatPayer: boolean;
  accountType: string;
};

type Stats = {
  sentInvoices: number;
  sentActs: number;
  paidInvoices: { count: number; sum: number; currency: string };
  pendingInvoices: { count: number; sum: number; currency: string };
};

export default function CabinetDashboard() {
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function load() {
    setError(null);
    try {
      const [me, st] = await Promise.all([
        getWithAuth<Tenant>("/me"),
        getWithAuth<Stats>("/dashboard/stats"),
      ]);
      setTenant(me);
      setStats(st);
    } catch (e: any) {
      setError(e?.message || "Failed to load cabinet");
    }
  }

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="grid gap-4">
      {error && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {error}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="text-sm text-slate-500">Profile</div>
            <div className="mt-1 text-lg font-semibold text-slate-900">
              {tenant?.name || "—"}
            </div>
            <div className="mt-2 text-sm text-slate-600 grid gap-1">
              <div><span className="text-slate-500">Reg/Tax ID:</span> {tenant?.regNumber || "—"}</div>
              <div><span className="text-slate-500">Email:</span> {tenant?.email || "—"}</div>
              <div><span className="text-slate-500">Phone:</span> {tenant?.phone || "—"}</div>
              <div><span className="text-slate-500">IBAN:</span> {tenant?.iban || "—"}</div>
              <div><span className="text-slate-500">VAT payer:</span> {tenant ? (tenant.isVatPayer ? "Yes" : "No") : "—"}</div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={load}>Refresh</Button>
            <Link href="/auth/login">
              <Button variant="ghost">Re-login</Button>
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="text-sm text-slate-500">Sent invoices</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">{stats?.sentInvoices ?? "—"}</div>
          <div className="mt-3 text-xs text-slate-500">Status: SENT/PAID/OVERDUE</div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="text-sm text-slate-500">Sent acts</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">{stats?.sentActs ?? "—"}</div>
          <div className="mt-3 text-xs text-slate-500">Status: SENT/PAID/OVERDUE</div>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="text-sm text-slate-500">Paid invoices</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">{stats?.paidInvoices.count ?? "—"}</div>
          <div className="mt-2 text-sm text-slate-600">
            Sum: {stats ? `${stats.paidInvoices.sum.toFixed(2)} ${stats.paidInvoices.currency}` : "—"}
          </div>
        </div>
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="text-sm text-slate-500">Pending invoices</div>
          <div className="mt-2 text-3xl font-semibold text-slate-900">{stats?.pendingInvoices.count ?? "—"}</div>
          <div className="mt-2 text-sm text-slate-600">
            Sum: {stats ? `${stats.pendingInvoices.sum.toFixed(2)} ${stats.pendingInvoices.currency}` : "—"}
          </div>
          <div className="mt-3 text-xs text-slate-500">Status: SENT/OVERDUE</div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 text-sm text-slate-600">
        Next batches will add: Invoices list + Create Invoice, Acts list + Create Act, Clients (CRUD + import/export),
        PDF generation & sending via Email/WhatsApp, and subscription limits.
      </div>
    </div>
  );
}
