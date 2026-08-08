import type { ReactNode } from "react";

export interface ToastProps {
  children: ReactNode;
  /** `danger` for error toasts (engine validation messages). */
  tone?: "default" | "danger";
}

/** Confirmation pill shown after a mutation ("Datos actualizados").
 * Position it fixed bottom-center in the app; rendered inline here. */
export const Toast = ({ children, tone = "default" }: ToastProps) => (
  <div
    className={["cnx-toast", tone === "danger" ? "cnx-toast--danger" : ""]
      .filter(Boolean)
      .join(" ")}
  >
    {children}
  </div>
);
