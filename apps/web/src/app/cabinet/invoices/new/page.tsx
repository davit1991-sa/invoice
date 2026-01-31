"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { getWithAuth, jsonWithAuth } from "@/lib/authedFetch";

type ClientRow = {
  id: string;
  taxPayerId: string;
  name: string;
  address?: string | null;
  email?: string | null;
  phone?: string | null;
  iban?: string | null;
};

const VAT_RATE = 0.18;

export default function NewInvoicePage() {
  const [clients, setClients] = useState<ClientRow[]>([]);
  const [mode, setMode] = useState<"select" | "manual">("select");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [form, setForm] = useState({
    clientId: "",
    clientTaxPayerId: "",
    clientName: "",
    clientAddress: "",
    clientEmail: "",
    clientPhone: "",
    clientIban: "",
    purpose: "",
    amountNet: "0.00",
    includeVat: false,
    dueDate: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString().slice(0, 10),
  });

  const net = useMemo(() => {
    const n = Number(String(form.amountNet).replace(",", "."));
    return Number.isFinite(n) ? n : 0;
  }, [form.amountNet]);

  const vat = useMemo(() => (form.includeVat ? net * VAT_RATE : 0), [form.includeVat, net]);
  const gross = useMemo(() => net + vat, [net, vat]);

  async function loadClients() {
    try {
      const data = await getWithAuth<any[]>(`/clients`);
      setClients(
        data.map((c) => ({
          id: c.id,
          taxPayerId: c.taxPayerId,
          name: c.name,
          address: c.address ?? "",
          email: c.email ?? "",
          phone: c.phone ?? "",
          iban: c.iban ?? "",
        }))
      );
    } catch (e: any) {
      setErr(e?.message || "Failed to load clients");
    }
  }

  useEffect(() => {
    loadClients();
  }, []);

  function pickClient(id: string) {
    const c = clients.find((x) => x.id === id);
    if (!c) return;
    setForm((f) => ({
      ...f,
      clientId: id,
      clientTaxPayerId: c.taxPayerId,
      clientName: c.name,
      clientAddress: c.address || "",
      clientEmail: c.email || "",
      clientPhone: c.phone || "",
      clientIban: c.iban || "",
    }));
  }

  async function submit() {
    setErr(null);
    setLoading(true);
    try {
      const payload: any = {
        purpose: form.purpose,
        amountNet: form.amountNet,
        includeVat: form.includeVat,
        dueDate: new Date(form.dueDate).toISOString(),
      };

      if (mode === "select") {
        payload.clientId = form.clientId || null;
      } else {
        payload.clientTaxPayerId = form.clientTaxPayerId || null;
        payload.clientName = form.clientName || null;
        payload.clientAddress = form.clientAddress || null;
        payload.clientEmail = form.clientEmail || null;
        payload.clientPhone = form.clientPhone || null;
        payload.clientIban = form.clientIban || null;
      }

      await jsonWithAuth("/invoices", "POST", payload);
      window.location.href = "/cabinet/invoices";
    } catch (e: any) {
      setErr(e?.message || "Create failed");
    } finally {
      setLoading(false);
    }
  }

  const canSubmit =
    form.purpose.trim().length > 0 &&
    net >= 0 &&
    form.dueDate &&
    ((mode === "select" && form.clientId) ||
      (mode === "manual" && form.clientTaxPayerId.trim() && form.clientName.trim()));

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-slate-500">My Invoices</div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Create Invoice</h1>
          <div className="mt-1 text-sm text-slate-600">
            Numbering rule: &lt;YourTaxID&gt;-&lt;ClientTaxID&gt;-&lt;seq&gt;
          </div>
        </div>
        <Link href="/cabinet/invoices">
          <Button variant="outline">Back</Button>
        </Link>
      </div>

      {err && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {err}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="flex gap-2">
          <Button variant={mode === "select" ? "default" : "outline"} onClick={() => setMode("select")}>
            Choose from list
          </Button>
          <Button variant={mode === "manual" ? "default" : "outline"} onClick={() => setMode("manual")}>
            Fill manually
          </Button>
        </div>

        {mode === "select" && (
          <div className="mt-4 grid gap-3">
            <label className="text-sm text-slate-700">Client</label>
            <select
              className="h-11 rounded-xl border border-slate-200 px-3 outline-none focus:ring-2 focus:ring-slate-200"
              value={form.clientId}
              onChange={(e) => {
                const id = e.target.value;
                setForm((f) => ({ ...f, clientId: id }));
                pickClient(id);
              }}
            >
              <option value="">Select client…</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.taxPayerId})
                </option>
              ))}
            </select>

            {form.clientId && (
              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
                <div className="font-medium">{form.clientName}</div>
                <div className="text-slate-600">{form.clientTaxPayerId}</div>
                <div className="text-slate-600">{form.clientEmail || "—"} · {form.clientPhone || "—"}</div>
              </div>
            )}
          </div>
        )}

        {mode === "manual" && (
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <input
              className="h-11 rounded-xl border border-slate-200 px-3 outline-none focus:ring-2 focus:ring-slate-200"
              placeholder="Client Tax Payer ID"
              value={form.clientTaxPayerId}
              onChange={(e) => setForm((f) => ({ ...f, clientTaxPayerId: e.target.value }))}
            />
            <input
              className="h-11 rounded-xl border border-slate-200 px-3 outline-none focus:ring-2 focus:ring-slate-200"
              placeholder="Client Name"
              value={form.clientName}
              onChange={(e) => setForm((f) => ({ ...f, clientName: e.target.value }))}
            />
            <input
              className="h-11 rounded-xl border border-slate-200 px-3 outline-none focus:ring-2 focus:ring-slate-200"
              placeholder="Client Address"
              value={form.clientAddress}
              onChange={(e) => setForm((f) => ({ ...f, clientAddress: e.target.value }))}
            />
            <input
              className="h-11 rounded-xl border border-slate-200 px-3 outline-none focus:ring-2 focus:ring-slate-200"
              placeholder="Client Email"
              value={form.clientEmail}
              onChange={(e) => setForm((f) => ({ ...f, clientEmail: e.target.value }))}
            />
            <input
              className="h-11 rounded-xl border border-slate-200 px-3 outline-none focus:ring-2 focus:ring-slate-200"
              placeholder="Client Phone (WhatsApp)"
              value={form.clientPhone}
              onChange={(e) => setForm((f) => ({ ...f, clientPhone: e.target.value }))}
            />
            <input
              className="h-11 rounded-xl border border-slate-200 px-3 outline-none focus:ring-2 focus:ring-slate-200"
              placeholder="Client IBAN"
              value={form.clientIban}
              onChange={(e) => setForm((f) => ({ ...f, clientIban: e.target.value }))}
            />
          </div>
        )}

        <div className="mt-6 grid gap-3">
          <label className="text-sm text-slate-700">Purpose</label>
          <input
            className="h-11 rounded-xl border border-slate-200 px-3 outline-none focus:ring-2 focus:ring-slate-200"
            placeholder="Purpose of invoice"
            value={form.purpose}
            onChange={(e) => setForm((f) => ({ ...f, purpose: e.target.value }))}
          />

          <div className="grid gap-3 md:grid-cols-3">
            <div>
              <label className="text-sm text-slate-700">Amount (Net)</label>
              <input
                className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 outline-none focus:ring-2 focus:ring-slate-200"
                value={form.amountNet}
                onChange={(e) => setForm((f) => ({ ...f, amountNet: e.target.value }))}
              />
            </div>
            <div>
              <label className="text-sm text-slate-700">Due date</label>
              <input
                type="date"
                className="mt-2 h-11 w-full rounded-xl border border-slate-200 px-3 outline-none focus:ring-2 focus:ring-slate-200"
                value={form.dueDate}
                onChange={(e) => setForm((f) => ({ ...f, dueDate: e.target.value }))}
              />
            </div>
            <div className="flex items-end">
              <label className="flex items-center gap-2 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={form.includeVat}
                  onChange={(e) => setForm((f) => ({ ...f, includeVat: e.target.checked }))}
                />
                Include VAT (18%)
              </label>
            </div>
          </div>

          <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-slate-700">
            <div>Net: {net.toFixed(2)} GEL</div>
            <div>VAT: {vat.toFixed(2)} GEL</div>
            <div className="font-medium">Gross: {gross.toFixed(2)} GEL</div>
            <div className="mt-2 text-xs text-slate-500">
              Note: VAT is allowed only if your account is VAT payer (server-side enforced).
            </div>
          </div>

          <div className="flex items-center justify-end gap-2">
            <Link href="/cabinet/invoices"><Button variant="outline">Cancel</Button></Link>
            <Button onClick={submit} disabled={!canSubmit || loading}>
              {loading ? "Creating..." : "Create"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
