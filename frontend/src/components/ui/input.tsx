import * as React from "react";

import { cn } from "@/lib/utils";

/** Shared field chrome: 1px border, 0px radius, 14px text, indigo focus. */
export const fieldClasses =
  "flex h-10 w-full border border-input bg-card px-3 py-2 text-sm text-foreground transition-colors placeholder:text-muted-foreground focus-visible:border-primary focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:bg-muted disabled:text-muted-foreground";

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
