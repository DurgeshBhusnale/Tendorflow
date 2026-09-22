import { cn } from "@/lib/utils";

/**
 * Status colours, one tone per meaning (docs/DESIGN_SYSTEM.md).
 *
 * Each pill is a tinted fill, a 1px border a step darker, and a solid dot: the
 * dot is what makes two adjacent states tell apart at a glance, and it keeps
 * the pill readable for anyone who can't rely on the fill's hue alone.
 */
const TONES = {
  green: { chip: "bg-emerald-50 text-emerald-700 border-emerald-200", dot: "bg-emerald-500" },
  amber: { chip: "bg-amber-50 text-amber-700 border-amber-200", dot: "bg-amber-500" },
  blue: { chip: "bg-blue-50 text-blue-700 border-blue-200", dot: "bg-blue-500" },
  red: { chip: "bg-red-50 text-red-700 border-red-200", dot: "bg-red-500" },
  slate: { chip: "bg-muted text-muted-foreground border-border", dot: "bg-gray-400" },
} as const;

export type PillTone = keyof typeof TONES;

export function StatusPill({ label, tone = "slate" }: { label: string; tone?: PillTone }) {
  const { chip, dot } = TONES[tone];
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 py-[3px] text-xs font-semibold",
        chip,
      )}
    >
      <span aria-hidden className={cn("size-1.5 shrink-0 rounded-full", dot)} />
      {label}
    </span>
  );
}
