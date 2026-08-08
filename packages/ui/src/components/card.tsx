import type { ReactNode } from "react";

export interface CardProps {
  /** Card heading shown in the serif brand face. */
  title?: string;
  /** Small element rendered on the right of the heading (usually a Tag). */
  aside?: ReactNode;
  children: ReactNode;
  className?: string;
}

/** White content card with the brand's soft shadow and hairline border —
 * the basic container of every Canei screen. */
export const Card = ({ title, aside, children, className }: CardProps) => (
  <section className={["cnx-card", className || ""].filter(Boolean).join(" ")}>
    {(title || aside) && (
      <div className="cnx-card__head">
        {title && <h3 className="cnx-card__title">{title}</h3>}
        {aside}
      </div>
    )}
    {children}
  </section>
);
