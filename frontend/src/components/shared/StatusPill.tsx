import { cn } from "@/lib/utils";

const TONES = {
  green: "bg-green-100 text-green-800",
  amber: "bg-amber-100 text-amber-800",
  slate: "bg-slate-100 text-slate-800",
  red: "bg-red-100 text-red-800",
} as const;

export type PillTone = keyof typeof TONES;

export function StatusPill({ label, tone = "slate" }: { label: string; tone?: PillTone }) {
  return (
    <span
      className={cn("inline-block rounded-full px-2 py-0.5 text-xs font-medium", TONES[tone])}
    >
      {label}
    </span>
  );
}
