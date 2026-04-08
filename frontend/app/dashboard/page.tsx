"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";

export default function DashboardPage() {
  const { session, profile, loading, signOut } = useAuth();
  const router = useRouter();

  // Not logged in — redirect to login
  useEffect(() => {
    if (!loading && !session) router.replace("/login");
  }, [session, loading, router]);

  if (loading || !session) return null;

  return (
    <main className="min-h-screen bg-neutral-950 text-white p-8">
      <div className="max-w-2xl mx-auto flex flex-col gap-6">

        <div className="flex items-center justify-between">
          <h1 className="text-2xl font-semibold tracking-tight">Ledgr</h1>
          <button
            onClick={signOut}
            className="text-sm text-neutral-400 hover:text-white transition-colors"
          >
            Sign out
          </button>
        </div>

        <div className="rounded-xl bg-neutral-900 border border-neutral-800 p-6 flex flex-col gap-2">
          <p className="text-sm text-neutral-400">Signed in as</p>
          <p className="text-lg font-medium">{profile?.display_name ?? "—"}</p>
          <p className="text-sm text-neutral-400">{profile?.email}</p>
        </div>

        <p className="text-neutral-600 text-sm">Dashboard coming soon.</p>
      </div>
    </main>
  );
}