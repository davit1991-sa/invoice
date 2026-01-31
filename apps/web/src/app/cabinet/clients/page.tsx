"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { downloadTextWithAuth, getWithAuth, jsonWithAuth } from "@/lib/authedFetch";

type MySub = {
  active: boolean;
  subscription: null | {
    planCode: string;
    allowClients: boolean;
    invoicesRemaining: number | null;
    actsRemaining: number | null;
    validTo: string;
  };
};

type ClientRow = {
  id: string;
  taxPayerId: string;
  name: string;
  address?: string | null;
  email?: string | null;
  phone?: string | null;
  iban?: string | null;
  debt: number;
  activeInvoicesNumber: number;
  closedInvoicesNumber: number;
  currency: string;
  createdAt: string;
};

function downloadFile(filename: string, text: string, mime = "text/plain") {
  const blob = new Blob([text], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function fmtDate(s: string) {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toISOString().slice(0, 10);
}

export default function ClientsPage() {
  const [rows, setRows] = useState<ClientRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [sub, setSub] = useState<MySub | null>(null);
  const [subLoading, setSubLoading] = useState(false);

  const [form, setForm] = useState({
    taxPayerId: "",
    name: "",
    address: "",
    email: "",
    phone: "",
    iban: "",
  });

  const totalDebt = useMemo(() => rows.reduce((s, r) => s + (r.debt || 0), 0), [rows]);

  async function load() {
    setLoading(true);
    setErr(null);
    setSubLoading(true);
    try {
      const subRes = await getWithAuth<MySub>("/subscriptions/me");
      setSub(subRes);

      const allow = !!subRes?.active && !!subRes?.subscription?.allowClients;
      if (!allow) {
        setRows([]);
        return;
      }

      const data = await getWithAuth<ClientRow[]>("/clients");
      setRows(data);
    } catch (e: any) {
      setErr(e?.message || "Failed to load clients");
    } finally {
      setLoading(false);
      setSubLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function addClient() {
    setErr(null);
    try {
      await jsonWithAuth("/clients", "POST", {
        taxPayerId: form.taxPayerId,
        name: form.name,
        address: form.address || null,
        email: form.email || null,
        phone: form.phone || null,
        iban: form.iban || null,
      });
      setForm({ taxPayerId: "", name: "", address: "", email: "", phone: "", iban: "" });
      await load();
    } catch (e: any) {
      setErr(e?.message || "Create failed");
    }
  }

  async function remove(id: string) {
    setErr(null);
    try {
      await jsonWithAuth(`/clients/${id}`, "DELETE", {});
      await load();
    } catch (e: any) {
      setErr(e?.message || "Delete failed");
    }
  }

  async function exportCsv() {
    setErr(null);
    try {
      const csv = await downloadTextWithAuth("/clients/export/csv");
      downloadFile("clients.csv", csv, "text/csv");
    } catch (e: any) {
      setErr(e?.message || "Export failed");
    }
  }

  async function importCsv(file: File, upsert: boolean) {
    setErr(null);
    try {
      const text = await file.text();
      await jsonWithAuth("/clients/import/csv", "POST", { csv: text, upsert });
      await load();
    } catch (e: any) {
      setErr(e?.message || "Import failed");
    }
  }

const clientsAllowed = !!sub?.active && !!sub?.subscription?.allowClients;

if (!subLoading && sub && !clientsAllowed) {
  return (
    <div className="grid gap-4">
      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="text-sm font-medium text-slate-900">Clients module is not available</div>
        <div className="mt-2 text-sm text-slate-700">
          Your current plan does not allow managing clients. Upgrade your subscription to enable Clients.
        </div>
        <div className="mt-3 text-sm text-slate-600">
          Plan: <span className="font-semibold">{sub.subscription?.planCode || "—"}</span>
          {sub.subscription?.validTo ? (
            <span className="text-slate-500"> · Valid until: {fmtDate(sub.subscription.validTo)}</span>
          ) : null}
        </div>
        <div className="mt-5 flex flex-wrap gap-2">
          <Button onClick={() => (window.location.href = "/cabinet/subscription")}>Go to Subscription</Button>
          <Button variant="outline" onClick={load}>Refresh</Button>
        </div>
        <div className="mt-3 text-xs text-slate-500">
          Note: BASIC_NO_CLIENTS package blocks Clients module by design.
        </div>
      </div>
    </div>
  );
}


  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between">
        <div>
          <div className="text-xs text-slate-500">Cabinet</div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Clients</h1>
          <div className="mt-1 text-sm text-slate-600">
            Total clients: {rows.length} · Total debt: {totalDebt.toFixed(2)} GEL
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={load} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
          <Button variant="outline" onClick={exportCsv}>
            Export CSV
          </Button>
        </div>
      </div>

      {err && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {err}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="text-sm font-medium text-slate-900">Add Client</div>
        <div className="mt-4 grid gap-3 md:grid-cols-2">
          <input
            className="h-11 rounded-xl border border-slate-200 px-3 outline-none focus:ring-2 focus:ring-slate-200"
            placeholder="Tax Payer ID"
            value={form.taxPayerId}
            onChange={(e) => setForm((f) => ({ ...f, taxPayerId: e.target.value }))}
          />
          <input
            className="h-11 rounded-xl border border-slate-200 px-3 outline-none focus:ring-2 focus:ring-slate-200"
            placeholder="Name"
            value={form.name}
            onChange={(e) => setForm((f) => ({ ...f, name: e.target.value }))}
          />
          <input
            className="h-11 rounded-xl border border-slate-200 px-3 outline-none focus:ring-2 focus:ring-slate-200"
            placeholder="Address"
            value={form.address}
            onChange={(e) => setForm((f) => ({ ...f, address: e.target.value }))}
          />
          <input
            className="h-11 rounded-xl border border-slate-200 px-3 outline-none focus:ring-2 focus:ring-slate-200"
            placeholder="Email"
            value={form.email}
            onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
          />
          <input
            className="h-11 rounded-xl border border-slate-200 px-3 outline-none focus:ring-2 focus:ring-slate-200"
            placeholder="Phone (WhatsApp)"
            value={form.phone}
            onChange={(e) => setForm((f) => ({ ...f, phone: e.target.value }))}
          />
          <input
            className="h-11 rounded-xl border border-slate-200 px-3 outline-none focus:ring-2 focus:ring-slate-200"
            placeholder="IBAN"
            value={form.iban}
            onChange={(e) => setForm((f) => ({ ...f, iban: e.target.value }))}
          />
        </div>

        <div className="mt-4 flex items-center gap-2">
          <Button onClick={addClient} disabled={!form.taxPayerId.trim() || !form.name.trim()}>
            Add
          </Button>
          <div className="ml-auto flex items-center gap-2">
            <label className="text-sm text-slate-600">
              Import CSV:
              <input
                type="file"
                accept=".csv,text/csv"
                className="ml-2"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) importCsv(f, false);
                  e.currentTarget.value = "";
                }}
              />
            </label>
            <label className="text-sm text-slate-600">
              Import CSV (Upsert):
              <input
                type="file"
                accept=".csv,text/csv"
                className="ml-2"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) importCsv(f, true);
                  e.currentTarget.value = "";
                }}
              />
            </label>
          </div>
        </div>

        <div className="mt-3 text-xs text-slate-500">
          CSV headers expected: taxPayerId,name,address,email,phone,iban. (Excel import will be added next batch.)
        </div>
      </div>

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-[900px] w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left px-4 py-3">Tax Payer ID</th>
                <th className="text-left px-4 py-3">Name</th>
                <th className="text-left px-4 py-3">Email</th>
                <th className="text-left px-4 py-3">Phone</th>
                <th className="text-left px-4 py-3">IBAN</th>
                <th className="text-right px-4 py-3">Debt (GEL)</th>
                <th className="text-right px-4 py-3">Active</th>
                <th className="text-right px-4 py-3">Closed</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="px-4 py-3">{r.taxPayerId}</td>
                  <td className="px-4 py-3">{r.name}</td>
                  <td className="px-4 py-3">{r.email || "—"}</td>
                  <td className="px-4 py-3">{r.phone || "—"}</td>
                  <td className="px-4 py-3">{r.iban || "—"}</td>
                  <td className="px-4 py-3 text-right">{(r.debt || 0).toFixed(2)}</td>
                  <td className="px-4 py-3 text-right">{r.activeInvoicesNumber}</td>
                  <td className="px-4 py-3 text-right">{r.closedInvoicesNumber}</td>
                  <td className="px-4 py-3 text-right">
                    <Button variant="outline" size="sm" onClick={() => remove(r.id)}>
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td className="px-4 py-10 text-center text-slate-500" colSpan={9}>
                    No clients yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
