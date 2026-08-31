import * as React from "react";

import { cn } from "@/lib/utils";

/** Form field label — 14px medium, per the type scale. */
const Label = React.forwardRef<HTMLLabelElement, React.ComponentProps<"label">>(
  ({ className, ...props }, ref) => (
    <label
      ref={ref}
      className={cn("block text-sm font-medium text-foreground", className)}
      {...props}
    />
  ),
);
Label.displayName = "Label";

/** Inline validation / submission error text. */
function FieldError({ children }: { children?: React.ReactNode }) {
  if (!children) return null;
  return <p className="text-xs font-medium text-destructive">{children}</p>;
}

export { Label, FieldError };
