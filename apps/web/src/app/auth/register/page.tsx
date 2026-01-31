"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { api } from "@/lib/api";

type AccountType = "PERSON" | "LLC" | "IE" | "OTHER";

export default function RegisterPage() {
  const [type, setType] = useState<AccountType>("LLC");
  const [regNumber, setRegNumber] = useState("");
  const [legalAddress, setLegalAddress] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [iban, setIban] = useState("");
  const [isVat, setIsVat] = useState(false);
  const [loading, setLoading] = useState(false);
  const [revLoading, setRevLoading] = useState(false);
  const [revStatus, setRevStatus] = useState<string | null>(null);
  const [revName, setRevName] = useState<string | null>(null);
  const [revManualUrl, setRevManualUrl] = useState<string | null>(null);
  const [revErrorCode, setRevErrorCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorManualUrl, setErrorManualUrl] = useState<string | null>(null);
  const [okMsg, setOkMsg] = useState<string | null>(null);

  const typeLabel = useMemo(() => {
    switch (type) {
      case "PERSON": return "Person";
      case "LLC": return "Limited liability Company";
      case "IE": return "Individual Entrepreneur";
      case "OTHER": return "Other";
    }
  }, [type]);

  async function submit() {
    setError(null);
    setErrorManualUrl(null);
    setOkMsg(null);
    setLoading(true);
    try {
      await api.register({
        accountType: type,
        regNumber,
        legalAddress,
        email,
        phone,
        iban,
        isVatPayer: isVat,
      });
      setOkMsg("Registered successfully. OTP sent to your email. Please login to verify.");
    } catch (e: any) {
      const details = e?.details;
      if (details?.code === "REVENUE_VERIFICATION_REQUIRED") {
        setError("Revenue Service verification is required before registration (strict mode is enabled). Please open my.gov.ge and ask Admin to verify.");
        setErrorManualUrl(details?.manualUrl || null);
      } else {
        setError(e?.message || "Registration failed");
      }
    } finally {
      setLoading(false);
    }
  }

  async function checkRevenue() {
    setRevLoading(true);
    setRevStatus(null);
    setRevName(null);
    setRevManualUrl(null);
    setRevErrorCode(null);
    try {
      const r = await api.revenueCheck({ accountType: type, regNumber });
      setRevStatus(r.status);
      setRevName(r.name || null);
      setRevManualUrl(r.manualUrl || null);
      setRevErrorCode(r.errorCode || null);
    } catch (e: any) {
      setRevStatus("FAILED");
      const details = e?.details;
      setRevErrorCode(details?.code || e?.message || "FAILED");
      if (details?.manualUrl) setRevManualUrl(details.manualUrl);
    } finally {
      setRevLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-12">
      <h1 className="text-2xl font-semibold tracking-tight text-slate-900">Register</h1>
      <p className="mt-2 text-slate-600 text-sm">
        Create your cabinet. System supports Revenue Service verification (manual or mock mode).
      </p>

      <div className="mt-6 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="grid gap-4">
          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
              {error}
              {errorManualUrl ? (
                <div className="mt-2 text-xs text-red-700">
                  Manual verification link: <a className="underline" href={errorManualUrl} target="_blank" rel="noreferrer">my.gov.ge</a>
                </div>
              ) : null}
            </div>
          )}
          {okMsg && (
            <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              {okMsg}
            </div>
          )}

          <div className="grid gap-2">
            <label className="text-sm text-slate-700">Choose your type</label>
            <select
              className="h-11 rounded-xl border border-slate-200 px-3 outline-none focus:ring-2 focus:ring-slate-200"
              value={type}
              onChange={(e) => setType(e.target.value as AccountType)}
              disabled={loading}
            >
              <option value="PERSON">Person</option>
              <option value="LLC">Limited liability Company</option>
              <option value="IE">Individual Entrepreneur</option>
              <option value="OTHER">Other</option>
            </select>
            <div className="text-xs text-slate-500">Selected: {typeLabel}</div>
          </div>

          <div className="grid gap-2">
            <label className="text-sm text-slate-700">Registration Number (Personal / Taxpayer ID)</label>
            <input
              className="h-11 rounded-xl border border-slate-200 px-3 outline-none focus:ring-2 focus:ring-slate-200"
              placeholder="e.g. 01234567890"
              value={regNumber}
              onChange={(e) => setRegNumber(e.target.value)}
              disabled={loading}
            />
            <div className="text-xs text-slate-500">
              For Person/LLC/IE you can run a pre-check. In production, verification is typically manual (opens my.gov.ge).
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={checkRevenue}
                disabled={revLoading || loading || !regNumber.trim()}
              >
                {revLoading ? "Checking..." : "Check Revenue Service"}
              </Button>

              {revStatus && (
                <div className="text-xs text-slate-600">
                  <span className="font-medium">Status:</span> {revStatus}
                  {revName ? <span className="ml-2">| <span className="font-medium">Name:</span> {revName}</span> : null}
                  {revErrorCode ? <span className="ml-2">| <span className="font-medium">Code:</span> {revErrorCode}</span> : null}
                </div>
              )}
            </div>

            {revManualUrl && (
              <div className="text-xs text-slate-500">
                Manual verification link: <a className="underline" href={revManualUrl} target="_blank" rel="noreferrer">my.gov.ge</a>
              </div>
            )}
          </div>

          <div className="grid gap-2">
            <label className="text-sm text-slate-700">Legal Address</label>
            <input
              className="h-11 rounded-xl border border-slate-200 px-3 outline-none focus:ring-2 focus:ring-slate-200"
              placeholder="Tbilisi, ..."
              value={legalAddress}
              onChange={(e) => setLegalAddress(e.target.value)}
              disabled={loading}
            />
          </div>

          <div className="grid md:grid-cols-2 gap-4">
            <div className="grid gap-2">
              <label className="text-sm text-slate-700">Email</label>
              <input
                className="h-11 rounded-xl border border-slate-200 px-3 outline-none focus:ring-2 focus:ring-slate-200"
                placeholder="name@company.ge"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                disabled={loading}
              />
            </div>
            <div className="grid gap-2">
              <label className="text-sm text-slate-700">Mobile Phone (WhatsApp)</label>
              <input
                className="h-11 rounded-xl border border-slate-200 px-3 outline-none focus:ring-2 focus:ring-slate-200"
                placeholder="+9955XXXXXXXX"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                disabled={loading}
              />
            </div>
          </div>

          <div className="grid gap-2">
            <label className="text-sm text-slate-700">Bank Account Number (IBAN)</label>
            <input
              className="h-11 rounded-xl border border-slate-200 px-3 outline-none focus:ring-2 focus:ring-slate-200"
              placeholder="GE29TB..."
              value={iban}
              onChange={(e) => setIban(e.target.value)}
              disabled={loading}
            />
          </div>

          <label className="flex items-center gap-2 text-sm text-slate-700">
            <input
              type="checkbox"
              className="h-4 w-4"
              checked={isVat}
              onChange={(e) => setIsVat(e.target.checked)}
              disabled={loading}
            />
            VAT payer
          </label>

          <Button
            type="button"
            size="lg"
            onClick={submit}
            disabled={loading || !regNumber.trim() || !email.trim() || !phone.trim() || !iban.trim()}
          >
            {loading ? "Registering..." : "Register & Send OTP"}
          </Button>

          <div className="text-xs text-slate-500">
            OTP is sent on registration (email). OTP is stored hashed in DB and has TTL.
          </div>
        </div>
      </div>

      <div className="mt-6 text-sm text-slate-600">
        Already have an account?{" "}
        <Link href="/auth/login" className="text-slate-900 hover:underline">
          Login
        </Link>
      </div>
    </div>
  );
}
