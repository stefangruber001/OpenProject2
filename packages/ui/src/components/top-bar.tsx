import type { ReactNode } from "react";

/** The Canei house mark — green rounded square, white house, gold spark. */
export const LogoMark = ({ size = 40 }: { size?: number }) => (
  <svg width={size} height={size} viewBox="0 0 40 40" fill="none" aria-label="Canei Subirats">
    <rect x="1" y="1" width="38" height="38" rx="11" fill="#48733c" />
    <path
      d="M11 21.5 L20 13 L29 21.5"
      stroke="#fff"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <path
      d="M13.5 20 V28.5 H26.5 V20"
      stroke="#fff"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
    <rect x="18" y="23.5" width="4" height="5" rx="1" fill="#fff" />
    <rect x="28" y="28" width="6.5" height="6.5" rx="2" fill="#f2c230" />
  </svg>
);

export interface TopBarProps {
  /** Brand name next to the mark. */
  name?: string;
  /** Uppercase subtitle under the name. */
  subtitle?: string;
  /** Right-aligned content (date, primary Button…). */
  children?: ReactNode;
}

/** Page top bar: logo + name on the left, actions on the right. */
export const TopBar = ({ name = "Canei Subirats", subtitle, children }: TopBarProps) => (
  <header className="cnx-topbar">
    <a className="cnx-logo" href="#">
      <LogoMark />
      <span className="cnx-logo__name">
        {name}
        {subtitle && <small className="cnx-logo__sub">{subtitle}</small>}
      </span>
    </a>
    <span className="cnx-topbar__spacer" />
    {children}
  </header>
);
