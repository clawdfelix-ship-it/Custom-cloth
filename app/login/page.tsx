"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Panel";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, password }),
      });
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "Sign in failed.");
      router.push("/editor");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Sign in failed.");
      setBusy(false);
    }
  };

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[var(--color-surface-sunken)] p-6">
      <div className="w-full max-w-sm rounded-[var(--radius-panel)] border border-[var(--color-line)] bg-[var(--color-surface)] p-6">
        <h1 className="mb-1 text-[15px] font-semibold">Zenex Sports Custom</h1>
        <p className="mb-5 text-[12px] text-[var(--color-ink-muted)]">
          Sign in to design and save kits.
        </p>
        <form onSubmit={submit} className="flex flex-col gap-3">
          <label className="flex flex-col gap-1.5 text-[12px] font-medium text-[var(--color-ink-muted)]">
            Username or email
            <input
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              autoComplete="username"
              required
              className="h-9 rounded-[var(--radius-control)] border border-[var(--color-line)] bg-[var(--color-surface-sunken)] px-2.5 text-[13px] outline-none focus:border-[var(--color-line-strong)]"
            />
          </label>
          <label className="flex flex-col gap-1.5 text-[12px] font-medium text-[var(--color-ink-muted)]">
            Password
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              autoComplete="current-password"
              required
              className="h-9 rounded-[var(--radius-control)] border border-[var(--color-line)] bg-[var(--color-surface-sunken)] px-2.5 text-[13px] outline-none focus:border-[var(--color-line-strong)]"
            />
          </label>
          {error ? (
            <p className="text-[12px] text-[var(--color-danger)]">{error}</p>
          ) : null}
          <Button type="submit" variant="primary" disabled={busy} className="mt-1">
            {busy ? "Signing in…" : "Sign in"}
          </Button>
        </form>
        <p className="mt-4 text-[12px] text-[var(--color-ink-muted)]">
          No account?{" "}
          <a href="/register" className="text-[var(--color-accent)] hover:underline">
            Register
          </a>
        </p>
      </div>
    </main>
  );
}
