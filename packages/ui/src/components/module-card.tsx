export interface ModuleCardProps {
  /** Emoji or short glyph shown in the soft-green square. */
  icon: string;
  title: string;
  /** One-line description of what the module manages. */
  description: string;
  /** Live status line at the card foot (e.g. "5 clientes", "2 sin asignar"). */
  live?: string;
  /** Colors the live line red for attention states. */
  liveAlert?: boolean;
  /** `tower` renders the wide deep-green hero card. */
  variant?: "default" | "tower";
  href?: string;
}

/** Navigation card for a management area — the building block of the home
 * launchpad grid. The top accent bar animates in on hover. */
export const ModuleCard = ({
  icon,
  title,
  description,
  live,
  liveAlert,
  variant = "default",
  href = "#",
}: ModuleCardProps) => (
  <a
    className={["cnx-module", variant === "tower" ? "cnx-module--tower" : ""]
      .filter(Boolean)
      .join(" ")}
    href={href}
  >
    <div className="cnx-module__icon">{icon}</div>
    <b className="cnx-module__title">{title}</b>
    <span className="cnx-module__desc">{description}</span>
    {live && (
      <span className={["cnx-module__live", liveAlert ? "cnx-module__live--alert" : ""].join(" ")}>
        {live}
      </span>
    )}
  </a>
);
