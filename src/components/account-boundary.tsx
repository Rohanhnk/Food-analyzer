"use client";
import { SignIn, UserButton, useUser } from "@clerk/nextjs";
import { useEffect, useState } from "react";
export function AccountBoundary({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn, user } = useUser();
  const [authorizedId, setAuthorizedId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [retry, setRetry] = useState(0);
  useEffect(() => {
    if (!user) return;
    let active = true;
    fetch("/api/account").then(async response => {
      const body = await response.json();
      if (!response.ok) throw new Error(body?.error?.message ?? "Account access could not be verified.");
      if (active) { setAuthorizedId(user.id); setError(""); }
    }).catch(e => { if (active) setError(e.message); });
    return () => { active = false; };
  }, [user, retry]);
  if (!isLoaded) return <main className="access-screen" role="status">Loading your account…</main>;
  if (!isSignedIn) return <main className="access-screen"><h1>Your private food diary</h1><p>Sign in to save meals and view your records across devices.</p><SignIn routing="hash" fallbackRedirectUrl="/" /></main>;
  if (authorizedId !== user.id) return <main className="access-screen"><UserButton /><h1>Private account access</h1>{error ? <><p role="alert">{error}</p><button className="button secondary" onClick={() => setRetry(n => n + 1)}>Retry access check</button></> : <p role="status">Checking access…</p>}</main>;
  return <div key={user.id}>{children}</div>;
}
export function AccountControl() {
  return process.env.NEXT_PUBLIC_DATA_MODE === "live" ? <UserButton /> : null;
}
