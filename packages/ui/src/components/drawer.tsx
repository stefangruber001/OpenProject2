import type { ReactNode } from "react";

export interface DrawerProps {
  /** Serif heading in the drawer bar. */
  title: string;
  children: ReactNode;
  onClose?: () => void;
}

/** Right-hand detail drawer — the ERP's editor surface for records
 * (customer file, budget versions, project detail). Render it inside a
 * right-aligned overlay container. */
export const Drawer = ({ title, children, onClose }: DrawerProps) => (
  <aside className="cnx-drawer">
    <div className="cnx-drawer__bar">
      <h3 className="cnx-drawer__title">{title}</h3>
      <button type="button" className="cnx-drawer__close" onClick={onClose} aria-label="Close">
        ✕
      </button>
    </div>
    <div className="cnx-drawer__body">{children}</div>
  </aside>
);
