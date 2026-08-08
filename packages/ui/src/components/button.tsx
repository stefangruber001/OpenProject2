import type { ReactNode, MouseEventHandler } from "react";

export interface ButtonProps {
  children: ReactNode;
  /** Visual weight. `primary` is the green gradient call-to-action. */
  variant?: "default" | "primary" | "danger" | "ghost";
  /** Compact size for toolbars and table rows. */
  size?: "md" | "sm";
  disabled?: boolean;
  onClick?: MouseEventHandler<HTMLButtonElement>;
  type?: "button" | "submit";
  className?: string;
}

/** Action button in the Canei style: white with a hairline border by default,
 * deep-green gradient for the primary action of a view. */
export const Button = ({
  children,
  variant = "default",
  size = "md",
  disabled,
  onClick,
  type = "button",
  className,
}: ButtonProps) => (
  <button
    type={type}
    disabled={disabled}
    onClick={onClick}
    className={[
      "cnx-btn",
      variant !== "default" ? `cnx-btn--${variant}` : "",
      size === "sm" ? "cnx-btn--sm" : "",
      className || "",
    ]
      .filter(Boolean)
      .join(" ")}
  >
    {children}
  </button>
);
