import type { brandingSchema } from "@repo/kernel";
import type { z } from "zod";

type Branding = z.infer<typeof brandingSchema>;

/** The Canei brand mark — green rounded square, white house glyph, yellow spark.
 *  Data-driven from the tenant palette; the same glyph as the document header. */
export function BrandMark({
  palette = {},
  size = 40,
}: {
  palette?: Record<string, string>;
  size?: number;
}) {
  const green = palette.brandGreen ?? "#48733c";
  const spark = palette.brandYellow ?? "#f2c230";
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 40 40"
      fill="none"
      role="img"
      aria-label="brand mark"
    >
      <rect x="1" y="1" width="38" height="38" rx="10" fill={green} />
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
      <rect x="28" y="28" width="6.5" height="6.5" rx="2" fill={spark} />
    </svg>
  );
}

/** Full logo lockup: mark + serif wordmark + slogan. Used across app headers. */
export function BrandLockup({ branding, size = 40 }: { branding: Branding; size?: number }) {
  return (
    <div className="flex items-center gap-3">
      <BrandMark palette={branding.palette} size={size} />
      <div className="leading-tight">
        <span className="block font-serif text-lg font-semibold text-neutral-900 dark:text-neutral-100">
          {branding.tradeName ?? branding.legalName}
        </span>
        {branding.slogan && (
          <span className="block text-[11px] italic text-neutral-500">{branding.slogan}</span>
        )}
      </div>
    </div>
  );
}
