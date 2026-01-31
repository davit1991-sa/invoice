import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { Button } from "@/components/ui/button";

export const metadata: Metadata = {
  title: "Invoice & Compare Act",
  description: "Create invoices and compare acts online, download PDF, send via email or WhatsApp.",
};

const nav = [
  { href: "#about", label: "About us" },
  { href: "#contact", label: "Contact" },
  { href: "#start", label: "Start Invoicing" },
  { href: "#subscription", label: "Subscription" },
];

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <div className="min-h-screen flex flex-col">
          <header className="sticky top-0 z-50 border-b border-slate-100 bg-white/80 backdrop-blur">
            <div className="mx-auto max-w-6xl px-4 py-3 flex items-center justify-between">
              <Link href="/" className="font-semibold tracking-tight text-slate-900">
                Invoice<span className="text-slate-400">.</span>
              </Link>

              <nav className="hidden md:flex items-center gap-6 text-sm text-slate-600">
                {nav.map((n) => (
                  <a key={n.href} href={n.href} className="hover:text-slate-900">
                    {n.label}
                  </a>
                ))}
              </nav>

              <div className="flex items-center gap-2">
                <Link href="/auth/login">
                  <Button variant="ghost">Login</Button>
                </Link>
                <Link href="/auth/register">
                  <Button>Register</Button>
                </Link>
              </div>
            </div>
          </header>

          <main className="flex-1">{children}</main>

          <footer className="border-t border-slate-100 bg-white">
            <div className="mx-auto max-w-6xl px-4 py-10 text-sm text-slate-600 grid gap-3">
              <div className="flex flex-wrap gap-4">
                <a href="#about" className="hover:text-slate-900">About us</a>
                <a href="#contact" className="hover:text-slate-900">Contact</a>
                <a href="#subscription" className="hover:text-slate-900">Subscription</a>
                <a href="#start" className="hover:text-slate-900">Start</a>
              </div>
              <div>© {new Date().getFullYear()} Invoice & Compare Act Platform</div>
            </div>
          </footer>
        </div>
      </body>
    </html>
  );
}
