import { cn } from "@/lib/utils";

/**
 * Tinted initials, used wherever a row is about a person or a company.
 *
 * The tint is derived from the name, so the same client is the same colour on
 * every screen. It carries no meaning of its own — it is there to give a long
 * list of near-identical rows something to navigate by. Decorative, so it is
 * hidden from assistive tech: the name itself is always next to it.
 */
const PALETTE = [
  "bg-primary/10 text-primary",
  "bg-emerald-50 text-emerald-700",
  "bg-orange-50 text-orange-700",
  "bg-sky-50 text-sky-700",
  "bg-violet-50 text-violet-700",
  "bg-pink-50 text-pink-700",
] as const;

const SIZES = {
  sm: "size-7 rounded-md text-[10px]",
  md: "size-9 rounded-lg text-xs",
} as const;

function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "—";
  const first = parts[0][0] ?? "";
  const second = parts[1]?.[0] ?? parts[0][1] ?? "";
  return (first + second).toUpperCase();
}

function tintFor(name: string): string {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) {
    hash = (hash * 31 + name.charCodeAt(i)) >>> 0;
  }
  return PALETTE[hash % PALETTE.length];
}

export function Avatar({
  name,
  size = "md",
  className,
}: {
  name: string;
  size?: keyof typeof SIZES;
  className?: string;
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "flex shrink-0 items-center justify-center font-bold leading-none",
        SIZES[size],
        tintFor(name),
        className,
      )}
    >
      {initials(name)}
    </span>
  );
}
