import type { ReactNode } from "react";

type CardProps = {
  title: string;
  className?: string;
  children: ReactNode;
  subtitle?: string;
  variant?: "default" | "metric" | "status" | "glass";
  statusColor?: "candidate" | "risky" | "rejected";
};

export function Card({ title, className, children, subtitle, variant, statusColor }: CardProps) {
  const variantClass = variant === "metric" ? "card-metric" : variant === "status" ? `card-status${statusColor === "risky" ? " card-status--warning" : statusColor === "rejected" ? " card-status--danger" : ""}` : "";
  return (
    <section className={`card ${variantClass} ${className ?? ""}`.trim()}>
      <h3>{title}</h3>
      {subtitle ? <p className="muted" style={{ marginTop: "-0.4rem", marginBottom: "0.5rem", fontSize: "0.8rem" }}>{subtitle}</p> : null}
      {children}
    </section>
  );
}
