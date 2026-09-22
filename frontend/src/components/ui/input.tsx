import * as React from "react";

import { cn } from "@/lib/utils";

/** Shared field chrome: 1px border, 9px radius, 14px text, indigo focus halo. */
export const fieldClasses =
  "flex h-10 w-full rounded-lg border border-input bg-card px-3 py-2 text-sm text-foreground transition-[border-color,box-shadow] placeholder:text-muted-foreground/70 focus-visible:border-primary focus-visible:outline-none focus-visible:ring-[3px] focus-visible:ring-primary/15 disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground";

const Input = React.forwardRef<HTMLInputElement, React.ComponentProps<"input">>(
  ({ className, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          fieldClasses,
          "file:border-0 file:bg-transparent file:text-sm file:font-medium file:text-foreground",
          // Calculated / read-only fields read as visibly inert.
          "read-only:bg-muted read-only:text-muted-foreground",
          className,
        )}
        ref={ref}
        {...props}
      />
    );
  },
);
Input.displayName = "Input";

export { Input };
