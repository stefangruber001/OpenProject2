import type { ReactNode } from "react";

export interface NotePanelProps {
  children: ReactNode;
  /** `ok` green (default), `warn` amber, `danger` red. */
  tone?: "ok" | "warn" | "danger";
}

/** Left-bordered inline note — policy reminders and gentle warnings
 * ("nothing leaves the system without review"). */
export const NotePanel = ({ children, tone = "ok" }: NotePanelProps) => (
  <div className={["cnx-note", tone !== "ok" ? `cnx-note--${tone}` : ""].filter(Boolean).join(" ")}>
    {children}
  </div>
);
