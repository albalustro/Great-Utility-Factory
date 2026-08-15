import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const alertVariants = cva(
  "relative w-full rounded-lg border px-4 py-3 text-sm [&>svg]:absolute [&>svg]:left-4 [&>svg]:top-3.5 [&>svg]:size-4 [&>svg~*]:pl-6",
  {
    variants: {
      variant: {
        default: "border-border bg-card text-card-foreground",
        info: "border-[var(--info)]/25 bg-[var(--info-soft)] text-foreground [&>svg]:text-[var(--info)]",
        warning:
          "border-[var(--warning)]/30 bg-[var(--warning-soft)] text-foreground [&>svg]:text-[var(--warning)]",
        destructive:
          "border-[var(--danger)]/30 bg-[var(--danger-soft)] text-foreground [&>svg]:text-[var(--danger)]",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

function Alert({
  className,
  variant,
  ...props
}: React.ComponentProps<"div"> & VariantProps<typeof alertVariants>) {
  return (
    <div
      role="alert"
      className={cn(alertVariants({ variant }), className)}
      {...props}
    />
  );
}

function AlertTitle({ className, ...props }: React.ComponentProps<"h5">) {
  return (
    <h5
      className={cn("mb-0.5 font-medium leading-none tracking-tight", className)}
      {...props}
    />
  );
}

function AlertDescription({ className, ...props }: React.ComponentProps<"div">) {
  return (
    <div
      className={cn("text-xs leading-relaxed text-muted-foreground", className)}
      {...props}
    />
  );
}

export { Alert, AlertTitle, AlertDescription };
