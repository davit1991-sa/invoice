"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { tokenStore } from "@/lib/api";
import { Button } from "@/components/ui/button";

export default function CabinetLayout({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const { accessToken, refreshToken } = tokenStore.get();
    // Minimal protection: require any token. If expired, dashboard fetch will refresh.
    if (!accessToken && !refreshToken) {
      window.location.href = "/auth/login";
      return;
    }
    setReady(true);
  }, []);

  if (!ready) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-20 text-slate-600">
        Loading cabinet...
      </div>
    );
  }

  return (
    <div className="min-h-[calc(100vh-120px)] bg-slate-50/40">
      <div className="mx-auto max-w-6xl px-4 py-8">
        <div className="flex items-center justify-between">
          <div>
            <div className="text-xs text-slate-500">My cabinet</div>
            <div className="text-xl font-semibold tracking-tight text-slate-900">Dashboard</div>
          </div>
          <div className="flex items-center gap-2">
            <Link href="/"><Button variant="outline">Home</Button></Link>
            <Link href="/auth/logout"><Button variant="ghost">Logout</Button></Link>
          </div>
        </div>

        <div className="mt-6 grid grid-cols-1 md:grid-cols-5 gap-3">
          <Link className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 hover:border-slate-300" href="/cabinet">
            Dashboard
          </Link>
          <Link className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 hover:border-slate-300" href="/cabinet/invoices">
            My Invoices
          </Link>
          <Link className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 hover:border-slate-300" href="/cabinet/acts">
            Acts
          </Link>
          <Link className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 hover:border-slate-300" href="/cabinet/clients">
            Clients
          </Link>
          <Link className="rounded-2xl border border-slate-200 bg-white p-4 text-sm text-slate-700 hover:border-slate-300" href="/cabinet/subscription">
            Subscription
          </Link>
        </div>

        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
