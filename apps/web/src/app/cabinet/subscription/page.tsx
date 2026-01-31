"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { getWithAuth, jsonWithAuth } from "@/lib/authedFetch";

type Plan = {
  code: "BASIC_NO_CLIENTS" | "PRO_UNLIMITED" | "PAYG_5_5";
  title: string;
  priceGEL: number;
  durationDays: number;
  limits: {
    invoices: number | null;
    acts: number | null;
    allowClients: boolean;
  };
};

type MySubResponse = {
  active: boolean;
  subscription: null | {
    planCode: Plan["code"];
    status: string;
    validFrom: string;
    validTo: string;
    invoicesUsed: number;
    actsUsed: number;
    invoicesRemaining: number | null;
    actsRemaining: number | null;
    allowClients: boolean;
  };
  plans: Plan[];
};

type PaymentIntent = {
  id: string;
  status: string;
  planCode: string;
  amount: string;
  currency: string;
  payId?: string | null;
  approvalUrl?: string | null;
  createdAt: string;
  updatedAt: string;
};

function fmtDate(d: string) {
  const x = new Date(d);
  if (Number.isNaN(x.getTime())) return d;
  return x.toISOString().slice(0, 10);
}

function isFinalPaymentStatus(status: string) {
  const s = (status || "").toUpperCase();
  return ["SUCCEEDED", "FAILED", "EXPIRED", "CANCELED"].includes(s);
}

export default function SubscriptionPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [me, setMe] = useState<MySubResponse | null>(null);

  const [loading, setLoading] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const [checkoutMsg, setCheckoutMsg] = useState<string | null>(null);
  const [payment, setPayment] = useState<PaymentIntent | null>(null);
  const pollRef = useRef<number | null>(null);

  async function load() {
    setLoading(true);
    setErr(null);
    try {
      const [p, m] = await Promise.all([
        getWithAuth<Plan[]>("/subscriptions/plans"),
        getWithAuth<MySubResponse>("/subscriptions/me"),
      ]);
      setPlans(p);
      setMe(m);
    } catch (e: any) {
      setErr(e?.message || "Failed to load subscription");
    } finally {
      setLoading(false);
    }
  }

  async function startCheckout(planCode: Plan["code"]) {
    setErr(null);
    setCheckoutMsg(null);
    try {
      const res = await jsonWithAuth<{ approvalUrl: string; paymentIntentId: string }>("/billing/tbc/checkout", "POST", {
        planCode,
      });
      window.location.href = res.approvalUrl;
    } catch (e: any) {
      setErr(e?.message || "Checkout failed");
    }
  }

  async function pollPayment(intentId: string) {
    // clear previous
    if (pollRef.current) window.clearInterval(pollRef.current);

    setCheckoutMsg("Checking payment status...");
    const startedAt = Date.now();

    const tick = async () => {
      try {
        const pi = await getWithAuth<PaymentIntent>(`/billing/payments/${encodeURIComponent(intentId)}`);
        setPayment(pi);

        const st = (pi.status || "").toUpperCase();
        if (isFinalPaymentStatus(st)) {
          if (pollRef.current) window.clearInterval(pollRef.current);
          pollRef.current = null;

          if (st === "SUCCEEDED") {
            setCheckoutMsg("Payment succeeded. Activating subscription...");
            await load();
            setCheckoutMsg("Subscription activated ✅");
          } else {
            setCheckoutMsg(`Payment finished with status: ${pi.status}`);
          }
          return;
        }

        // stop after 60 seconds
        if (Date.now() - startedAt > 60_000) {
          if (pollRef.current) window.clearInterval(pollRef.current);
          pollRef.current = null;
          setCheckoutMsg("Payment status is still pending. Please press Refresh in a few seconds.");
        }
      } catch (e: any) {
        // do not fail hard on polling
        setCheckoutMsg("Could not fetch payment status. Please press Refresh.");
      }
    };

    // immediate + interval
    await tick();
    pollRef.current = window.setInterval(tick, 2500);
  }

  useEffect(() => {
    load();

    // If user returned from TBC (returnurl contains ?checkout=return&intent=<id>)
    const url = new URL(window.location.href);
    const checkout = url.searchParams.get("checkout");
    const intent = url.searchParams.get("intent");
    if (checkout === "return" && intent) {
      setCheckoutMsg("Returned from checkout. Verifying payment...");
      pollPayment(intent);
    }

    return () => {
      if (pollRef.current) window.clearInterval(pollRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const activePlan = useMemo(() => {
    if (!me?.active || !me.subscription) return null;
    return plans.find((x) => x.code === me.subscription!.planCode) || null;
  }, [me, plans]);

  return (
    <div className="grid gap-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-xs text-slate-500">Cabinet</div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Subscription</h1>
          <div className="mt-1 text-sm text-slate-600">Choose plan, pay via TBC Checkout, and manage usage limits.</div>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" onClick={load} disabled={loading}>
            {loading ? "Refreshing..." : "Refresh"}
          </Button>
        </div>
      </div>

      {err && (
        <div className="rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</div>
      )}

      {checkoutMsg && (
        <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700">
          <div className="font-medium text-slate-900">Checkout</div>
          <div className="mt-1">{checkoutMsg}</div>
          {payment ? (
            <div className="mt-2 text-xs text-slate-500">
              PaymentIntent: <span className="font-mono">{payment.id}</span> · Status:{" "}
              <span className="font-semibold">{payment.status}</span>
            </div>
          ) : null}
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="text-sm font-medium text-slate-900">Current status</div>
        <div className="mt-3 text-sm text-slate-700 grid gap-1">
          {!me?.active ? (
            <>
              <div>
                <span className="font-medium">No active subscription.</span> You can still create{" "}
                <span className="font-medium">1 free invoice</span> and <span className="font-medium">1 free act</span>{" "}
                per IP address.
              </div>
              <div className="text-slate-500">When you exceed free limits, the API returns HTTP 402 with a reason code.</div>
            </>
          ) : (
            <>
              <div>
                <span className="text-slate-500">Plan:</span>{" "}
                <span className="font-semibold">{me.subscription?.planCode}</span>
                {activePlan?.title ? <span className="text-slate-500"> — {activePlan.title}</span> : null}
              </div>
              <div>
                <span className="text-slate-500">Valid:</span> {fmtDate(me.subscription!.validFrom)} →{" "}
                {fmtDate(me.subscription!.validTo)}
              </div>
              <div>
                <span className="text-slate-500">Clients module:</span>{" "}
                {me.subscription!.allowClients ? "Allowed" : "Not allowed in this plan"}
              </div>

              <div className="mt-2 grid gap-1">
                <div>
                  <span className="text-slate-500">Invoices used:</span> {me.subscription!.invoicesUsed}
                  {me.subscription!.invoicesRemaining !== null ? (
                    <span className="text-slate-500"> · Remaining: {me.subscription!.invoicesRemaining}</span>
                  ) : (
                    <span className="text-slate-500"> · Unlimited</span>
                  )}
                </div>
                <div>
                  <span className="text-slate-500">Acts used:</span> {me.subscription!.actsUsed}
                  {me.subscription!.actsRemaining !== null ? (
                    <span className="text-slate-500"> · Remaining: {me.subscription!.actsRemaining}</span>
                  ) : (
                    <span className="text-slate-500"> · Unlimited</span>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6">
        <div className="text-sm font-medium text-slate-900">Plans</div>
        <div className="mt-1 text-sm text-slate-600">
          Click “Pay & Activate” to start TBC Checkout. After successful payment, subscription activates automatically.
        </div>

        <div className="mt-4 grid gap-3 md:grid-cols-3">
          {plans.map((p) => (
            <div key={p.code} className="rounded-2xl border border-slate-200 p-5">
              <div className="text-sm font-semibold text-slate-900">{p.code}</div>
              <div className="mt-1 text-sm text-slate-600">{p.title}</div>
              <div className="mt-3 text-sm text-slate-700 grid gap-1">
                <div>
                  <span className="text-slate-500">Price:</span> {p.priceGEL} GEL
                </div>
                <div>
                  <span className="text-slate-500">Duration:</span> {p.durationDays} days
                </div>
                <div className="mt-2 grid gap-1">
                  <div>
                    <span className="text-slate-500">Invoices:</span>{" "}
                    {p.limits.invoices === null ? "Unlimited" : p.limits.invoices}
                  </div>
                  <div>
                    <span className="text-slate-500">Acts:</span> {p.limits.acts === null ? "Unlimited" : p.limits.acts}
                  </div>
                  <div>
                    <span className="text-slate-500">Clients module:</span> {p.limits.allowClients ? "Yes" : "No"}
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <Button className="w-full" onClick={() => startCheckout(p.code)}>
                  Pay & Activate
                </Button>
                <div className="mt-2 text-xs text-slate-500">
                  You will be redirected to TBC Checkout. After return, this page will verify status automatically.
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
