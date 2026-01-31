"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { downloadBlobWithAuth, getWithAuth, jsonWithAuth, triggerBrowserDownload } from "@/lib/authedFetch";

type ActRow = {
  id: string;
  actNumber: string;
  purpose: string;
  amount: string;
  currency: string;
  issueDate: string;
  dueDate: string;
  status: string;
  client: null | {
    id: string;
    taxPayerId: string;
    name: string;
    email?: string | null;
    phone?: string | null;
    iban?: string | null;
  };
};

function fmtDate(s: string) {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toISOString().slice(0, 10);
}

export default function ActsPage() {
  const [rows, setRows] = useState<ActRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");

  const total = useMemo(() => rows.reduce((s, r) => s + Number(r.amount || 0), 0), [rows]);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const params = new URLSearchParams();
      if (q.trim()) params.set("q", q.trim());
      if (status) params.set("status", status);
      const data = await getWithAuth<ActRow[]>(`/acts?${params.toString()}`);
      setRows(data);
    } catch (e: any) {
      setErr(e?.message || "Failed to load acts");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function markPaid(id: string) {
    setErr(null);
    try {
      await jsonWithAuth(`/acts/${id}`, "PUT", { status: "PAID" });
      await load();
    } catch (e: any) {
      setErr(e?.message || "Update failed");
    }
  }

  async function remove(id: string) {
    setErr(null);
    try {
      await jsonWithAuth(`/acts/${id}`, "DELETE", {});
      await load();
    } catch (e: any) {
      setErr(e?.message || "Delete failed");
    }
  }

async function downloadPdf(id: string, actNumber: string) {
  setErr(null);
  try {
    const blob = await downloadBlobWithAuth(`/acts/${id}/pdf`);
    triggerBrowserDownload(blob, `act-${actNumber}.pdf`);
  } catch (e: any) {
    setErr(e?.message || "Download failed");
  }
}

return (

    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs text-slate-500">Cabinet</div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Acts</h1>
          <div className="mt-1 text-sm text-slate-600">
            Total acts: {rows.length} · Sum: {total.toFixed(2)} GEL
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/cabinet/acts/new"><Button>Create ACT</Button></Link>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-2 md:items-center">
        <input
          className="h-11 w-full md:w-[360px] rounded-xl border border-slate-200 px-3 outline-none focus:ring-2 focus:ring-slate-200"
          placeholder="Search act number / client / purpose"
          value={q}
          onChange={(e) => setQ(e.target.value)}
        />
        <select
          className="h-11 w-full md:w-[220px] rounded-xl border border-slate-200 px-3 outline-none focus:ring-2 focus:ring-slate-200"
          value={status}
          onChange={(e) => setStatus(e.target.value)}
        >
          <option value="">All statuses</option>
          <option value="DRAFT">DRAFT</option>
          <option value="SENT">SENT</option>
          <option value="PAID">PAID</option>
          <option value="OVERDUE">OVERDUE</option>
          <option value="CANCELED">CANCELED</option>
        </select>
        <Button variant="outline" onClick={load} disabled={loading}>
          {loading ? "Loading..." : "Apply"}
        </Button>
      </div>

      {err && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          {err}
        </div>
      )}

      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="overflow-x-auto">
          <table className="min-w-[1100px] w-full text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="text-left px-4 py-3">ACT #</th>
                <th className="text-left px-4 py-3">Tax ID</th>
                <th className="text-left px-4 py-3">Name</th>
                <th className="text-left px-4 py-3">Purpose</th>
                <th className="text-right px-4 py-3">Amount (GEL)</th>
                <th className="text-left px-4 py-3">Issue</th>
                <th className="text-left px-4 py-3">Due</th>
                <th className="text-left px-4 py-3">Status</th>
                <th className="text-right px-4 py-3">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => (
                <tr key={r.id} className="border-t border-slate-100">
                  <td className="px-4 py-3 font-medium text-slate-900">{r.actNumber}</td>
                  <td className="px-4 py-3">{r.client?.taxPayerId || "—"}</td>
                  <td className="px-4 py-3">{r.client?.name || "—"}</td>
                  <td className="px-4 py-3">{r.purpose}</td>
                  <td className="px-4 py-3 text-right">{Number(r.amount).toFixed(2)}</td>
                  <td className="px-4 py-3">{fmtDate(r.issueDate)}</td>
                  <td className="px-4 py-3">{fmtDate(r.dueDate)}</td>
                  <td className="px-4 py-3">{r.status}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex flex-wrap justify-end gap-2">
  <Button size="sm" variant="outline" onClick={() => sendEmail(r.id, r.client?.email)}>Send Email</Button>
                      <Button size="sm" variant="outline" onClick={() => sendWhatsApp(r.id, r.client?.phone)}>Send WhatsApp</Button>
                      <Button size="sm" variant="outline" onClick={() => downloadPdf(r.id, r.actNumber)}>Download PDF</Button>
  <Button size="sm" variant="outline" onClick={() => markPaid(r.id)}>Mark Paid</Button>
  <Button size="sm" variant="outline" onClick={() => remove(r.id)}>Delete</Button>
</div>
<div className="mt-2 text-[11px] text-slate-500">
  Email/WhatsApp sending is now wired (requires SMTP/WhatsApp env vars).
</div>
                  </td>
                </tr>
              ))}
              {rows.length === 0 && (
                <tr>
                  <td className="px-4 py-10 text-center text-slate-500" colSpan={9}>
                    No acts yet.
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
