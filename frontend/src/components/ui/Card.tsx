import { ReactNode } from "react";

type CardVariant = "default" | "stat" | "hero";

interface CardProps {
  variant?: CardVariant;
  className?: string;
  children: ReactNode;
}

/**
 * Shared card shell for the whole app. Use this instead of hand-writing
 * `bg-white rounded-2xl p-6 border ...` on every page — see DESIGN_TOKENS.md.
 */
export function Card({ variant = "default", className = "", children }: CardProps) {
  const base = "border transition-shadow";

  const variants: Record<CardVariant, string> = {
    default:
      "bg-surface-card border-border rounded-card p-5 sm:p-6 shadow-sm hover:shadow-md",
    stat:
      "bg-surface-card border-border rounded-card p-4 sm:p-5 shadow-sm hover:shadow-md overflow-hidden",
    hero:
      "bg-gradient-to-r from-brand-900 via-brand-800 to-brand-900 border-brand-800 text-white rounded-hero p-5 sm:p-6 md:p-8 shadow-xl",
  };

  return <div className={`${base} ${variants[variant]} ${className}`}>{children}</div>;
}

/**
 * Icon badge for stat cards — brand-tinted by default. Pass `tone` only when
 * the number genuinely represents a status (overdue, low stock, etc).
 */
interface StatIconProps {
  icon: ReactNode;
  tone?: "brand" | "success" | "danger" | "warning" | "info";
}

export function StatIcon({ icon, tone = "brand" }: StatIconProps) {
  const tones: Record<NonNullable<StatIconProps["tone"]>, string> = {
    brand: "bg-gradient-to-tr from-brand-800 to-brand-600 shadow-brand-600/20",
    success: "bg-gradient-to-tr from-success-600 to-success-500 shadow-success-500/20",
    danger: "bg-gradient-to-tr from-danger-600 to-danger-500 shadow-danger-500/20",
    warning: "bg-gradient-to-tr from-accent-600 to-accent-500 shadow-accent-500/20",
    info: "bg-gradient-to-tr from-info-600 to-info-500 shadow-info-500/20",
  };

  return (
    <div
      className={`w-9 h-9 sm:w-10 sm:h-10 rounded-control text-white flex items-center justify-center shadow-md ${tones[tone]}`}
    >
      {icon}
    </div>
  );
}

/**
 * Wrap any price, balance, RGB count, or quantity in this so numbers render
 * in the monospace ledger face and align in columns. See DESIGN_TOKENS.md.
 */
export function Figure({ children, className = "" }: { children: ReactNode; className?: string }) {
  return (
    <span className={`font-mono tabular-nums ${className}`}>{children}</span>
  );
}
