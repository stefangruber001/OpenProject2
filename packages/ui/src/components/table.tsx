import type { ReactNode } from "react";

export interface TableProps {
  /** Column headings, left-to-right. */
  head: string[];
  /** Table rows: `<Tr>` elements (or plain `<tr>`). */
  children: ReactNode;
}

/** Premium list table with soft-green header row and hover highlight —
 * the ERP's standard record list. */
export const Table = ({ head, children }: TableProps) => (
  <table className="cnx-table">
    <thead>
      <tr>
        {head.map((h) => (
          <th key={h}>{h}</th>
        ))}
      </tr>
    </thead>
    <tbody>{children}</tbody>
  </table>
);

export interface TrProps {
  children: ReactNode;
  onClick?: () => void;
}

/** Table row; pass onClick to make it a drill-down row. */
export const Tr = ({ children, onClick }: TrProps) => (
  <tr onClick={onClick} style={onClick ? { cursor: "pointer" } : undefined}>
    {children}
  </tr>
);

export interface TdProps {
  children?: ReactNode;
  /** Right-aligned tabular numerals for amounts. */
  numeric?: boolean;
}

/** Table cell; set `numeric` for money and quantities. */
export const Td = ({ children, numeric }: TdProps) => (
  <td className={numeric ? "cnx-table__num" : undefined}>{children}</td>
);
