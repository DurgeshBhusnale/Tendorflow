import * as React from "react";

import { fieldClasses } from "@/components/ui/input";
import { cn } from "@/lib/utils";

/**
 * Multi-line field wearing the same chrome as `Input`.
 *
 * For text that genuinely runs to several lines — a client's bank details, or
 * the note saying what an expense was for. `h-10` is dropped in favour of a row
 * count, and the field grows vertically rather than scrolling horizontally.
 */
const Textarea = React.forwardRef<HTMLTextAreaElement, React.ComponentProps<"textarea">>(
  ({ className, rows = 4, ...props }, ref) => {
    return (
      <textarea
        ref={ref}
        rows={rows}
        className={cn(fieldClasses, "h-auto min-h-[2.5rem] resize-y leading-relaxed", className)}
        {...props}
      />
    );
  },
);
Textarea.displayName = "Textarea";

export { Textarea };
