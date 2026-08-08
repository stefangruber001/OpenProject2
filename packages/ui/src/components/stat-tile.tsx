export interface StatTileProps {
  /** Uppercase micro-label above the figure (e.g. "Proyectos activos"). */
  label: string;
  /** The figure itself, serif and tabular (e.g. "12" or "48.200 €"). */
  value: string;
  /** Small context line under the figure. */
  sub?: string;
  /** `highlight` renders the deep-green hero tile; `warn` colors the value red. */
  variant?: "default" | "highlight" | "warn";
  href?: string;
}

/** KPI tile from the control tower and home status strip. Use a 4-column
 * grid of these for a dashboard header row. */
export const StatTile = ({ label, value, sub, variant = "default", href }: StatTileProps) => {
  const cls = ["cnx-stat", variant !== "default" ? `cnx-stat--${variant}` : ""]
    .filter(Boolean)
    .join(" ");
  const body = (
    <>
      <div className="cnx-stat__label">{label}</div>
      <div className="cnx-stat__value">{value}</div>
      {sub && <div className="cnx-stat__sub">{sub}</div>}
    </>
  );
  return href ? (
    <a className={cls} href={href}>
      {body}
    </a>
  ) : (
    <div className={cls}>{body}</div>
  );
};
