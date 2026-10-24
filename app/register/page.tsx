"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Panel";

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    username: "",
    email: "",
    password: "",
    confirmPassword: "",
  });
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  const set = (key: keyof typeof form) => (event: React.ChangeEvent<HTMLInputElement>) =>
    setForm((current) => ({ ...current, [key]: event.target.value }));

  const submit = async (event: React.FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const body = await response.json();
      if (!response.ok) {
        const detail = Array.isArray(body.issues)
          ? body.issues.map((i: { message: string }) => i.message).join(" ")
          : body.error;
        throw new Error(detail ?? "Registration failed.");
      }
      router.push("/editor");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Registration failed.");
      setBusy(false);
    }
  };

  const fields: { key: keyof typeof form; label: string; type: string; auto: string }[] = [
    { key: "username", label: "Username", type: "text", auto: "username" },
    { key: "email", label: "Email", type: "email", auto: "email" },
    { key: "password", label: "Password", type: "password", auto: "new-password" },
    {
      key: "confirmPassword",
      label: "Confirm password",
      type: "password",
      auto: "new-password",
    },
  ];

  return (
    <main className="flex min-h-dvh items-center justify-center bg-[var(--color-surface-sunken)] p-6">
      <div className="w-full max-w-sm rounded-[var(--radius-panel)] border border-[var(--color-line)] bg-[var(--color-surface)] p-6">
        <h1 className="mb-1 text-[15px] font-semibold">Create your account</h1>
        <p className="mb-5 text-[12px] text-[var(--color-ink-muted)]">
          Passwords must be at least 8 characters.
        </p>
        <form onSubmit={submit} className="flex flex-col gap-3">
          {fields.map((field) => (
            <label
              key={field.key}
              className="flex flex-col gap-1.5 text-[12px] font-medium text-[var(--color-ink-muted)]"
            >
              {field.label}
              <input
                type={field.type}
                value={form[field.key]}
                onChange={set(field.key)}
                autoComplete={field.auto}
                required
                className="h-9 rounded-[var(--radius-control)] border border-[var(--color-line)] bg-[var(--color-surface-sunken)] px-2.5 text-[13px] outline-none focus:border-[var(--color-line-strong)]"
              />
            </label>
          ))}
          {error ? (
            <p className="text-[12px] text-[var(--color-danger)]">{error}</p>
          ) : null}
          <Button type="submit" variant="primary" disabled={busy} className="mt-1">
            {busy ? "Creating…" : "Create account"}
          </Button>
        </form>
        <p className="mt-4 text-[12px] text-[var(--color-ink-muted)]">
          Already registered?{" "}
          <a href="/login" className="text-[var(--color-accent)] hover:underline">
            Sign in
          </a>
        </p>
      </div>
    </main>
  );
}
