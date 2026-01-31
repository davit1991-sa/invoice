"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { adminPost, adminTokenStore } from "@/lib/adminFetch";

export default function AdminLoginPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null);
    setLoading(true);
    try {
      const res = await adminPost<{ accessToken: string }>("/admin/auth/login", { email, password });
      adminTokenStore.set(res.accessToken);
      window.location.href = "/admin";
    } catch (e: any) {
      setErr(e?.message || "Login failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-[calc(100vh-120px)] bg-slate-50/40">
      <div className="mx-auto max-w-md px-4 py-16">
        <div className="rounded-2xl border border-slate-200 bg-white p-6">
          <div className="text-xs text-slate-500">Platform</div>
          <h1 className="text-xl font-semibold tracking-tight text-slate-900">Admin Login</h1>
          <div className="mt-1 text-sm text-slate-600">
            Use <span className="font-medium">ADMIN_EMAIL</span> and <span className="font-medium">ADMIN_PASSWORD</span>.
          </div>

          {err && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">{err}</div>
          )}

          <form onSubmit={onSubmit} className="mt-5 grid gap-3">
            <input
              className="h-11 rounded-xl border border-slate-200 px-3 outline-none focus:ring-2 focus:ring-slate-200"
              placeholder="Email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
            <input
              className="h-11 rounded-xl border border-slate-200 px-3 outline-none focus:ring-2 focus:ring-slate-200"
              placeholder="Password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <Button type="submit" disabled={loading}>
              {loading ? "Signing in..." : "Sign in"}
            </Button>
          </form>
        </div>
      </div>
    </div>
  );
}
