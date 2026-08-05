export interface SectionHeaderProps {
  title: string;
  /** Muted hint sitting on the same baseline (e.g. "un único entorno"). */
  hint?: string;
}

/** Serif section heading with an optional muted hint — starts every
 * content block on the site. */
export const SectionHeader = ({ title, hint }: SectionHeaderProps) => (
  <div className="cnx-section">
    <h2 className="cnx-section__title">{title}</h2>
    {hint && <span className="cnx-section__hint">{hint}</span>}
  </div>
);
