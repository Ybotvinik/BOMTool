import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const buttonVariants = cva(
  "inline-flex items-center justify-center gap-1.5 whitespace-nowrap rounded-lg text-[12px] font-semibold leading-none cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand)]/40 focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed [&_svg]:pointer-events-none [&_svg]:size-[14px] [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        // A. Primary — dark navy
        default:
          "bg-[var(--navy)] text-white border border-[var(--navy)] hover:bg-[oklch(0.28_0.04_250)]",
        // B. Secondary — white / navy text
        secondary:
          "bg-white text-[var(--navy)] border border-[var(--input)] hover:bg-[oklch(0.97_0.008_245)]",
        outline:
          "bg-white text-[var(--navy)] border border-[var(--input)] hover:bg-[oklch(0.97_0.008_245)]",
        // C. Customer Safe — soft green
        customer:
          "bg-[oklch(0.95_0.05_150)] text-[oklch(0.45_0.13_150)] border border-[oklch(0.82_0.1_150)] hover:bg-[oklch(0.93_0.06_150)]",
        // D. Internal Only — soft amber
        internal:
          "bg-[oklch(0.97_0.04_85)] text-[oklch(0.5_0.12_75)] border border-[oklch(0.82_0.12_80)] hover:bg-[oklch(0.95_0.05_85)]",
        // E. Destructive — soft red
        destructive:
          "bg-[oklch(0.97_0.025_25)] text-[oklch(0.5_0.18_27)] border border-[oklch(0.82_0.12_27)] hover:bg-[oklch(0.95_0.04_25)]",
        // Brand accent — primary blue
        brand:
          "bg-[var(--brand)] text-white border border-[var(--brand)] hover:bg-[oklch(0.52_0.16_245)]",
        ghost:
          "text-[var(--navy)] hover:bg-[oklch(0.96_0.012_245)] border border-transparent",
        link: "text-[var(--brand)] underline-offset-4 hover:underline border-0",
      },
      size: {
        default: "h-8 px-3.5",
        sm: "h-7 px-2.5 text-[11px] [&_svg]:size-[13px]",
        lg: "h-9 px-4 text-[13px]",
        icon: "h-7 w-7 p-0 [&_svg]:size-[14px]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>, VariantProps<typeof buttonVariants> {
  asChild?: boolean;
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    return (
      <Comp className={cn(buttonVariants({ variant, size, className }))} ref={ref} {...props} />
    );
  },
);
Button.displayName = "Button";

export { Button, buttonVariants };
