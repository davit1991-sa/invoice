"use client";

import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { adminGet, adminPost, adminTokenStore } from "@/lib/adminFetch";

type TenantItem = {
  id: string;
  regNumber: string;
  name: string;
  email: string;
  phone: string;
  isVatPayer: boolean;
  revenueStatus?: string;
  revenueCheckedAt?: string | null;
  revenueCheckedName?: string | null;
  createdAt: string;
  subscription: null | {
    planCode: string;
    status: string;
    validFrom: string;
    validTo: string;
    invoicesUsed: number;
    actsUsed: number;
  };
};

type RevenueLog = {
  id: string;
  tenantId: string;
  status: string;
  name?: string | null;
  note?: string | null;
  adminId?: string | null;
  createdAt: string;
};

type PaymentItem = {
  id: string;
  tenant: { name: string; regNumber: string; email: string };
  provider: string;
  planCode: string;
  amount: string;
  currency: string;
  status: string;
  payId?: string | null;
  createdAt: string;
};

function fmtDateTime(s: string) {
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return s;
  return d.toISOString().slice(0, 16).replace("T", " ");
}

export default function AdminDashboardPage() {
  const [q, setQ] = useState("");
  const [tenants, setTenants] = useState<TenantItem[]>([]);
  const [payments, setPayments] = useState<PaymentItem[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState<string | null>(null);
  const [revenueLogs, setRevenueLogs] = useState<Record<string, RevenueLog[]>>({});
  const [logsLoading, setLogsLoading] = useState<Record<string, boolean>>({});
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const [actionPlan, setActionPlan] = useState("PAYG_5_5");
  const [extendDays, setExtendDays] = useState(30);

  const filtered = useMemo(() => tenants, [tenants]);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const [t, p] = await Promise.all([
        adminGet<TenantItem[]>(`/admin/tenants${q ? `?q=${encodeURIComponent(q)}` : ""}`),
        adminGet<PaymentItem[]>(`/admin/payments`),
      ]);
      setTenants(t);
      setPayments(p);
    } catch (e: any) {
      setErr(e?.message || "Failed to load admin data");
      if ((e?.message || "").toLowerCase().includes("invalid")) {
        adminTokenStore.clear();
      }
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    const token = adminTokenStore.get();
    if (!token) {
      window.location.href = "/admin/login";
      return;
    }
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function setSub(tenantId: string) {
    setErr(null);
    try {
      await adminPost(`/admin/tenants/${tenantId}/subscription`, {
        action: "set",
        planCode: actionPlan,
      });
      await load();
    } catch (e: any) {
      setErr(e?.message || "Update failed");
    }
  }

  async function extendSub(tenantId: string) {
    setErr(null);
    try {
      await adminPost(`/admin/tenants/${tenantId}/subscription`, {
        action: "extend",
        extendDays: Number(extendDays),
      });
      await load();
    } catch (e: any) {
      setErr(e?.message || "Extend failed");
    }
  }


  async function updateRevenue(tenantId: string) {
    setErr(null);
    try {
      const status = window.prompt("Revenue status: VERIFIED / FAILED / BYPASSED / PENDING", "VERIFIED");
      if (!status) return;
      const name = window.prompt("Verified name (optional)", "");
      const note = window.prompt("Note (optional)", "");
      await adminPost(`/admin/tenants/${tenantId}/revenue`, {
        status,
        name: name || undefined,
        note: note || undefined,
      });
      await load();
    } catch (e: any) {
      setErr(e?.message || "Revenue update failed");
    }
  }

  async function cancelSub(tenantId: string) {
    setErr(null);
    try {
      await adminPost(`/admin/tenants/${tenantId}/subscription`, {
        action: "cancel",
      });
      await load();
    } catch (e: any) {
      setErr(e?.message || "Cancel failed");
    }
  }

  async function loadRevenueLogs(tenantId: string) {
    setErr(null);
    setSelectedTenantId((prev) => (prev === tenantId ? null : tenantId));

    // If toggling open and already have logs, keep them
    const already = revenueLogs[tenantId];
    if (already && already.length > 0) return;

    setLogsLoading((s) => ({ ...s, [tenantId]: true }));
    try {
      const logs = await adminGet<RevenueLog[]>(`/admin/tenants/${tenantId}/revenue/logs`);
      setRevenueLogs((s) => ({ ...s, [tenantId]: logs }));
    } catch (e: any) {
      setErr(e?.message || "Failed to load revenue logs");
    } finally {
      setLogsLoading((s) => ({ ...s, [tenantId]: false }));
    }
  }

  function logout() {
    adminTokenStore.clear();
    window.location.href = "/admin/login";
  }

  return (
    <div className="min-h-[calc(100vh-120px)] bg-slate-50/40">
      <div className="mx-auto max-w-7xl px-4 py-8">
        <div className="flex items-center justify-between gap-3">
          <div>
            <div className="text-xs text-slate-500">Platform</div>
            <h1 className="text-xl font-semibold tracking-tight text-slate-900">Admin Dashboard</h1>
            <div className="mt-1 text-sm text-slate-600">Manage customers, subscriptions, and payments.</div>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={load} disabled={loading}>
              {loading ? "Refreshing..." : "Refresh"}
            </Button>
            <Button variant="ghost" onClick={logout}>Logout</Button>
          </div>
        </div>

        {err && (
          <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</div>
        )}

        <div className="mt-5 rounded-2xl border border-slate-200 bg-white p-5">
          <div className="flex flex-col md:flex-row md:items-center gap-2 md:gap-3">
            <input
              className="h-11 w-full md:w-[360px] rounded-xl border border-slate-200 px-3 outline-none focus:ring-2 focus:ring-slate-200"
              placeholder="Search tenants: name / regNumber / email / phone"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <Button onClick={load} variant="outline">Search</Button>

            <div className="flex-1" />

            <select
              className="h-11 rounded-xl border border-slate-200 px-3 outline-none focus:ring-2 focus:ring-slate-200"
              value={actionPlan}
              onChange={(e) => setActionPlan(e.target.value)}
            >
              <option value="BASIC_NO_CLIENTS">BASIC_NO_CLIENTS</option>
              <option value="PRO_UNLIMITED">PRO_UNLIMITED</option>
              <option value="PAYG_5_5">PAYG_5_5</option>
            </select>

            <input
              className="h-11 w-28 rounded-xl border border-slate-200 px-3 outline-none focus:ring-2 focus:ring-slate-200"
              type="number"
              min={1}
              value={extendDays}
              onChange={(e) => setExtendDays(Number(e.target.value))}
              title="Extend days"
            />
          </div>
        </div>

        <div className="mt-5 rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 text-xs font-medium text-slate-600 grid grid-cols-12 gap-2">
            <div className="col-span-3">Tenant</div>
            <div className="col-span-2">Reg#</div>
            <div className="col-span-2">Created</div>
            <div className="col-span-2">Revenue</div>
            <div className="col-span-2">Subscription</div>
            <div className="col-span-1 text-right">Actions</div>
          </div>

          {filtered.map((t) => (
            <div key={t.id} className="px-4 py-3 border-t border-slate-100 grid grid-cols-12 gap-2 items-start">
              <div className="col-span-3">
                <div className="font-medium text-slate-900">{t.name}</div>
                <div className="text-xs text-slate-500">{t.email} · {t.phone}</div>
              </div>
              <div className="col-span-2 text-sm text-slate-700">{t.regNumber}</div>
              <div className="col-span-2 text-sm text-slate-700">{fmtDateTime(t.createdAt)}</div>

              <div className="col-span-2 text-sm text-slate-700">
                {t.subscription ? (
                  <div className="grid gap-1">
                    <div><span className="text-slate-500">Plan:</span> <span className="font-medium">{t.subscription.planCode}</span></div>
                    <div><span className="text-slate-500">Status:</span> {t.subscription.status}</div>
                    <div><span className="text-slate-500">ValidTo:</span> {fmtDateTime(t.subscription.validTo)}</div>
                    <div className="text-xs text-slate-500">Used: inv {t.subscription.invoicesUsed} · act {t.subscription.actsUsed}</div>
                  </div>
                ) : (
                  <div className="text-slate-500">No subscription</div>
                )}
              </div>

              <div className="col-span-1 flex flex-col gap-2 items-end">
                <Button onClick={() => setSub(t.id)}>Set Plan</Button>
                <Button variant="outline" onClick={() => updateRevenue(t.id)}>Revenue</Button>
                <Button variant="outline" onClick={() => loadRevenueLogs(t.id)}>
                  {logsLoading[t.id] ? "Loading..." : (selectedTenantId === t.id ? "Hide History" : "History")}
                </Button>
                <div className="flex gap-2">
                  <Button variant="outline" onClick={() => extendSub(t.id)}>Extend</Button>
                  <Button variant="ghost" onClick={() => cancelSub(t.id)}>Cancel</Button>
                </div>
              </div>
            </div>
              {selectedTenantId === t.id && (
                <div className="col-span-12 -mt-1 mb-3 rounded-2xl border border-slate-200 bg-slate-50/40 p-4">
                  <div className="text-sm font-medium text-slate-900">Revenue Logs (last 50)</div>
                  <div className="mt-2 grid gap-2">
                    {(revenueLogs[t.id] && revenueLogs[t.id].length > 0) ? (
                      revenueLogs[t.id].map((l) => (
                        <div key={l.id} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{l.status}</span>
                            <span className="text-xs text-slate-500">{fmtDateTime(l.createdAt)}</span>
                            {l.name ? <span className="text-xs text-slate-600">| Name: {l.name}</span> : null}
                          </div>
                          {l.note ? <div className="mt-1 text-xs text-slate-600">Note: {l.note}</div> : null}
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-slate-500">No logs yet.</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}


          {filtered.length === 0 && (
            <div className="px-4 py-10 text-sm text-slate-500 text-center">No tenants.</div>
          )}
        </div>

        <div className="mt-8 rounded-2xl border border-slate-200 bg-white overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 text-xs font-medium text-slate-600">Recent Payments (last 200)</div>
          <div className="grid grid-cols-12 gap-2 px-4 py-3 text-xs font-medium text-slate-600 border-t border-slate-100">
            <div className="col-span-3">Tenant</div>
            <div className="col-span-2">Plan</div>
            <div className="col-span-2">Amount</div>
            <div className="col-span-2">Status</div>
            <div className="col-span-3">Created</div>
          </div>

          {payments.map((p) => (
            <div key={p.id} className="grid grid-cols-12 gap-2 px-4 py-3 text-sm border-t border-slate-100">
              <div className="col-span-3">
                <div className="font-medium text-slate-900">{p.tenant?.name}</div>
                <div className="text-xs text-slate-500">{p.tenant?.regNumber} · {p.tenant?.email}</div>
              </div>
              <div className="col-span-2 text-slate-700">{p.planCode}</div>
              <div className="col-span-2 text-slate-700">{p.amount} {p.currency}</div>
              <div className="col-span-2 text-slate-700">{p.status}</div>
              <div className="col-span-3 text-slate-700">{fmtDateTime(p.createdAt)}</div>
            </div>
              {selectedTenantId === t.id && (
                <div className="col-span-12 -mt-1 mb-3 rounded-2xl border border-slate-200 bg-slate-50/40 p-4">
                  <div className="text-sm font-medium text-slate-900">Revenue Logs (last 50)</div>
                  <div className="mt-2 grid gap-2">
                    {(revenueLogs[t.id] && revenueLogs[t.id].length > 0) ? (
                      revenueLogs[t.id].map((l) => (
                        <div key={l.id} className="rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="font-medium">{l.status}</span>
                            <span className="text-xs text-slate-500">{fmtDateTime(l.createdAt)}</span>
                            {l.name ? <span className="text-xs text-slate-600">| Name: {l.name}</span> : null}
                          </div>
                          {l.note ? <div className="mt-1 text-xs text-slate-600">Note: {l.note}</div> : null}
                        </div>
                      ))
                    ) : (
                      <div className="text-sm text-slate-500">No logs yet.</div>
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}


          {payments.length === 0 && (
            <div className="px-4 py-10 text-sm text-slate-500 text-center">No payments yet.</div>
          )}
        </div>
      </div>
    </div>
  );
}
