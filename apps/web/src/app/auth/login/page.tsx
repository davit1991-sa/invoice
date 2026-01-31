"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { api, tokenStore } from "@/lib/api";

type Mode = "email" | "phone";

export default function LoginPage() {
  const [mode, setMode] = useState<Mode>("email");
  const [identifier, setIdentifier] = useState("");
  const [otp, setOtp] = useState("");
  const [step, setStep] = useState<1 | 2>(1);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const label = useMemo(() => (mode === "email" ? "Email" : "Phone"), [mode]);

  async function sendOtp() {
    setError(null);
    setOkMsg(null);
    setLoading(true);
    try {
      await api.requestOtp({ mode, identifier });
      setStep(2);
      setOkMsg("OTP sent. Check your Email/WhatsApp. (In dev: see API logs)");
    } catch (e: any) {
      setError(e?.message || "Failed to send OTP");
    } finally {
      setLoading(false);
    }
  }

  async function confirm() {
    setError(null);
    setOkMsg(null);
    setLoading(true);
    try {
      const res = await api.verifyOtp({ mode, identifier, code: otp });
      tokenStore.set(res.accessToken, res.refreshToken);
      setOkMsg("Logged in successfully. Redirecting to cabinet...");
      window.location.href = "/cabinet";
    } catch (e: any) {
      setError(e?.message || "OTP verification failed");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-md px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Login</h1>
      <p className="mt-2 text-slate-600 text-sm">
        Login via Email or Phone. OTP is required. (OTP codes are stored hashed in DB.)
      </p>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex gap-2">
          <Button
            type="button"
            variant={mode === "email" ? "default" : "outline"}
            className="flex-1"
            onClick={() => setMode("email")}
            disabled={loading}
          >
            Email
          </Button>
          <Button
            type="button"
            variant={mode === "phone" ? "default" : "outline"}
            className="flex-1"
            onClick={() => setMode("phone")}
            disabled={loading}
          >
            Phone
          </Button>
        </div>

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            {error}
          </div>
        )}
        {okMsg && (
          <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
            {okMsg}
          </div>
        )}

        {step === 1 && (
          <div className="mt-6 grid gap-3">
            <label className="text-sm text-slate-700">{label}</label>
            <input
              className="h-11 rounded-xl border border-slate-200 px-3 outline-none focus:ring-2 focus:ring-slate-200"
              placeholder={mode === "email" ? "name@company.ge" : "+9955XXXXXXXX"}
              value={identifier}
              onChange={(e) => setIdentifier(e.target.value)}
            />
            <Button
              type="button"
              className="mt-2"
              onClick={sendOtp}
              disabled={loading || !identifier.trim()}
            >
              {loading ? "Sending..." : "Send OTP"}
            </Button>
          </div>
        )}

        {step === 2 && (
          <div className="mt-6 grid gap-3">
            <label className="text-sm text-slate-700">OTP Code</label>
            <input
              className="h-11 rounded-xl border border-slate-200 px-3 outline-none focus:ring-2 focus:ring-slate-200"
              placeholder="123456"
              value={otp}
              onChange={(e) => setOtp(e.target.value)}
            />
            <div className="flex gap-2">
              <Button type="button" variant="outline" className="flex-1" onClick={() => setStep(1)} disabled={loading}>
                Back
              </Button>
              <Button type="button" className="flex-1" onClick={confirm} disabled={loading || otp.trim().length < 4}>
                {loading ? "Verifying..." : "Confirm & Login"}
              </Button>
            </div>
            <button
              type="button"
              className="text-left text-xs text-slate-500 hover:text-slate-700"
              onClick={sendOtp}
              disabled={loading}
            >
              Didn’t receive? Resend
            </button>
          </div>
        )}
      </div>

      <div className="mt-6 text-sm text-slate-600">
        Don’t have an account?{" "}
        <Link href="/auth/register" className="text-slate-900 hover:underline">
          Register
        </Link>
      </div>
    </div>
  );
}
