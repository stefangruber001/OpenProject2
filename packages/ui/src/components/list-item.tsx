import type { ReactNode } from "react";

export interface ListItemProps {
  children: ReactNode;
  /** Leading figure rendered bold in deep green (e.g. a count). */
  strong?: string;
  /** Red-tinted row for overdue/critical entries. */
  danger?: boolean;
}

/** Compact list row used in "Mi día" panels and alert lists. Stack several
 * inside a flex column with 6px gap. */
export const ListItem = ({ children, strong, danger }: ListItemProps) => (
  <div className={["cnx-item", danger ? "cnx-item--danger" : ""].filter(Boolean).join(" ")}>
    {strong && <i className="cnx-item__strong">{strong}</i>}
    <span>{children}</span>
  </div>
);
