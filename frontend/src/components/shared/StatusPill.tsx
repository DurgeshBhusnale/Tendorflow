import { cn } from "@/lib/utils";

/** Exact status colours from the design system's pill-badge palette. */
const TONES = {
  green: "bg-emerald-50 text-emerald-600", // #ECFDF5 / #059669
  amber: "bg-amber-50 text-amber-600", // #FFFBEB / #D97706
  red: "bg-red-50 text-red-600", // #FEF2F2 / #DC2626
  slate: "bg-gray-100 text-gray-600", // #F3F4F6 / #4B5563
} as const;

export type PillTone = keyof typeof TONES;

export function StatusPill({ label, tone = "slate" }: { label: string; tone?: PillTone }) {
  return (
    <span
      className={cn(
        "inline-flex items-center whitespace-nowrap px-2.5 py-1 text-xs font-semibold",
        TONES[tone],
      )}
    >
      {label}
    </span>
  );
}
