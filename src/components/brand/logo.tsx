// ============================================
// GENESIS STUDIO — Brand Logo Component
// ============================================
// Single source of truth for the logo across the entire app.
// Uses inline SVG for instant rendering (no network request).

import Link from "next/link";

function LogoMark({ size = 32, className = "" }: { size?: number; className?: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="logo-bg" x1="0" y1="0" x2="48" y2="48" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#7c3aed" />
          <stop offset="100%" stopColor="#06b6d4" />
        </linearGradient>
      </defs>
      <rect width="48" height="48" rx="12" fill="url(#logo-bg)" />
      <path
        d="M18 12.5v23a1.5 1.5 0 0 0 2.25 1.3l19.5-11.5a1.5 1.5 0 0 0 0-2.6L20.25 11.2A1.5 1.5 0 0 0 18 12.5z"
        fill="white"
        opacity="0.95"
      />
      <path
        d="M28 20h5v2h-3v4h3v2h-5a2 2 0 0 1-2-2v-4a2 2 0 0 1 2-2z"
        fill="url(#logo-bg)"
        opacity="0.9"
      />
    </svg>
  );
}

function LogoText({ className = "" }: { className?: string }) {
  return (
    <span className={`font-bold gradient-text ${className}`}>
      Genesis Studio
    </span>
  );
}

/**
 * Full brand logo: icon + text, linked to homepage.
 *
 * Sizes:
 * - "sm"  → 28px icon, text-base  (sidebar, mobile)
 * - "md"  → 32px icon, text-lg    (navbar — default)
 * - "lg"  → 44px icon, text-2xl   (sign-in pages, hero)
 */
export function Logo({
  size = "md",
  href = "/",
  showText = true,
}: {
  size?: "sm" | "md" | "lg";
  href?: string;
  showText?: boolean;
}) {
  const config = {
    sm: { icon: 28, text: "text-base", gap: "gap-2" },
    md: { icon: 32, text: "text-lg", gap: "gap-2.5" },
    lg: { icon: 44, text: "text-2xl", gap: "gap-2.5" },
  }[size];

  const content = (
    <span className={`flex items-center ${config.gap}`}>
      <LogoMark size={config.icon} className="shrink-0 shadow-lg shadow-violet-600/20" />
      {showText && <LogoText className={config.text} />}
    </span>
  );

  if (href) {
    return <Link href={href} className="flex items-center">{content}</Link>;
  }

  return content;
}

export { LogoMark, LogoText };
