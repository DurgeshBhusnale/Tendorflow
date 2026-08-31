import * as React from "react";
import { ChevronDown } from "lucide-react";

import { fieldClasses } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * A native <select> wearing the design system's field chrome.
 *
 * Native on purpose: it forwards its ref and spreads props, so React Hook
 * Form's `{...register("x")}` keeps working exactly as before.
 */
const Select = React.forwardRef<HTMLSelectElement, React.ComponentProps<"select">>(
  ({ className, children, ...props }, ref) => {
    return (
      <div className="relative">
        <select
          ref={ref}
          className={cn(fieldClasses, "appearance-none pr-9", className)}
          {...props}
        >
          {children}
        </select>
        <ChevronDown
          aria-hidden
          className="pointer-events-none absolute right-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
        />
      </div>
    );
  },
);
Select.displayName = "Select";

export { Select };
