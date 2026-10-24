"use client";

import type { ReactNode } from "react";

export function Panel({
  title,
  action,
  children,
  className = "",
}: {
  title: string;
  action?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section
      className={`rounded-[var(--radius-panel)] border border-[var(--color-line)] bg-[var(--color-surface)] ${className}`}
    >
      <header className="flex items-center justify-between border-b border-[var(--color-line)] px-4 py-3">
        <h2 className="text-[13px] font-semibold uppercase tracking-wider text-[var(--color-ink-muted)]">
          {title}
        </h2>
        {action}
      </header>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1.5 flex items-baseline justify-between text-[12px] font-medium text-[var(--color-ink-muted)]">
        {label}
        {hint ? (
          <span className="text-[11px] font-normal text-[var(--color-ink-faint)]">
            {hint}
          </span>
        ) : null}
      </span>
      {children}
    </label>
  );
}

export function ColorInput({
  value,
  onChange,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <span className="flex items-center gap-2">
      <input
        type="color"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        className="h-8 w-9 shrink-0 disabled:opacity-40"
      />
      <input
        type="text"
        value={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        spellCheck={false}
        className="h-8 w-full rounded-[var(--radius-control)] border border-[var(--color-line)] bg-[var(--color-surface-sunken)] px-2 font-mono text-[12px] uppercase text-[var(--color-ink)] outline-none focus:border-[var(--color-line-strong)] disabled:opacity-40"
      />
    </span>
  );
}

export function Select({
  value,
  onChange,
  options,
  disabled,
}: {
  value: string | number;
  onChange: (value: string) => void;
  options: { value: string | number; label: string }[];
  disabled?: boolean;
}) {
  return (
    <select
      value={String(value)}
      disabled={disabled}
      onChange={(event) => onChange(event.target.value)}
      className="h-8 w-full rounded-[var(--radius-control)] border border-[var(--color-line)] bg-[var(--color-surface-sunken)] px-2 text-[12px] text-[var(--color-ink)] outline-none focus:border-[var(--color-line-strong)] disabled:opacity-40"
    >
      {options.map((option) => (
        <option key={option.value} value={String(option.value)}>
          {option.label}
        </option>
      ))}
    </select>
  );
}

export function NumberInput({
  value,
  onChange,
  min,
  max,
  step = 1,
  disabled,
}: {
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  disabled?: boolean;
}) {
  return (
    <input
      type="number"
      value={value}
      min={min}
      max={max}
      step={step}
      disabled={disabled}
      onChange={(event) => {
        const next = Number(event.target.value);
        if (Number.isFinite(next)) onChange(next);
      }}
      className="h-8 w-full rounded-[var(--radius-control)] border border-[var(--color-line)] bg-[var(--color-surface-sunken)] px-2 text-[12px] text-[var(--color-ink)] outline-none focus:border-[var(--color-line-strong)] disabled:opacity-40"
    />
  );
}

export function Button({
  children,
  onClick,
  variant = "default",
  disabled,
  type = "button",
  className = "",
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: "default" | "primary" | "ghost" | "danger";
  disabled?: boolean;
  type?: "button" | "submit";
  className?: string;
}) {
  const base =
    "inline-flex h-8 items-center justify-center gap-1.5 rounded-[var(--radius-control)] px-3 text-[12px] font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40";
  const styles: Record<string, string> = {
    default:
      "border border-[var(--color-line)] bg-[var(--color-surface-raised)] text-[var(--color-ink)] hover:border-[var(--color-line-strong)]",
    primary:
      "bg-[var(--color-accent)] text-[var(--color-accent-ink)] hover:bg-[var(--color-accent-strong)]",
    ghost:
      "text-[var(--color-ink-muted)] hover:bg-[var(--color-surface-raised)] hover:text-[var(--color-ink)]",
    danger:
      "border border-[var(--color-danger)]/40 text-[var(--color-danger)] hover:bg-[var(--color-danger)]/10",
  };
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${styles[variant]} ${className}`}
    >
      {children}
    </button>
  );
}

export function Badge({
  children,
  tone = "neutral",
  className = "",
}: {
  children: ReactNode;
  tone?: "neutral" | "accent" | "warn";
  className?: string;
}) {
  const tones: Record<string, string> = {
    neutral:
      "border-[var(--color-line)] bg-[var(--color-surface-raised)] text-[var(--color-ink-muted)]",
    accent:
      "border-[var(--color-accent)]/40 bg-[var(--color-accent)]/10 text-[var(--color-accent)]",
    warn: "border-[var(--color-warn)]/40 bg-[var(--color-warn)]/10 text-[var(--color-warn)]",
  };
  return (
    <span
      className={`inline-flex items-center rounded-[var(--radius-chip)] border px-2 py-0.5 text-[11px] font-medium ${tones[tone]} ${className}`}
    >
      {children}
    </span>
  );
}
