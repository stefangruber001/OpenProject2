import type { ReactNode } from "react";

export interface TagProps {
  children: ReactNode;
  /** Status color: green (ok/default), neutral, warn (amber), danger (red), spark (gold). */
  tone?: "ok" | "neutral" | "warn" | "danger" | "spark";
}

/** Rounded status pill — used for document states (emitida, cobrada, vencida),
 * completeness badges and counts. */
export const Tag = ({ children, tone = "ok" }: TagProps) => (
  <span className={["cnx-tag", tone !== "ok" ? `cnx-tag--${tone}` : ""].filter(Boolean).join(" ")}>
    {children}
  </span>
);
