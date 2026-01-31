"use client";

import { useEffect } from "react";
import { tokenStore } from "@/lib/api";

export default function LogoutPage() {
  useEffect(() => {
    tokenStore.clear();
    window.location.href = "/";
  }, []);

  return (
    <div className="mx-auto max-w-md px-4 py-20 text-slate-600">
      Logging out...
    </div>
  );
}
