import type { ReactNode } from "react";

type PageHeaderProps = {
  eyebrow?: string;
  title: string;
  description: string;
  step?: { current: number; total: number; label: string };
  actions?: ReactNode;
};

export function PageHeader({ eyebrow, title, description, step, actions }: PageHeaderProps) {
  return (
    <header className="page-header">
      <div>
        {step ? (
          <div className="step-indicator">
            <span className="step-indicator-number">{step.current}</span>
            Step {step.current} of {step.total} · {step.label}
          </div>
        ) : eyebrow ? (
          <div className="badge badge--accent">{eyebrow}</div>
        ) : null}
        <h2>{title}</h2>
        <p>{description}</p>
      </div>
      {actions ? <div className="page-header-actions">{actions}</div> : null}
    </header>
  );
}
