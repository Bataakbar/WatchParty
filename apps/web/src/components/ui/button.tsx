import * as React from "react";
import { cn } from "@/lib/utils";

type ButtonVariant = "default" | "secondary" | "ghost" | "outline" | "accent";
type ButtonSize = "sm" | "md" | "lg" | "icon";

const variantClasses: Record<ButtonVariant, string> = {
  default: "bg-zinc-100 text-zinc-900 hover:bg-white",
  secondary: "bg-white/5 text-foreground hover:bg-white/10 border border-line",
  ghost: "text-muted hover:text-foreground hover:bg-white/5",
  outline: "border border-line text-foreground hover:bg-white/5",
  accent: "bg-cyan-500 text-zinc-950 hover:bg-cyan-400 font-medium",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-8 px-3 text-sm rounded-md",
  md: "h-10 px-4 text-sm rounded-lg",
  lg: "h-12 px-6 text-base rounded-xl",
  icon: "h-9 w-9 rounded-lg",
};

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "md", type = "button", ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        "inline-flex items-center justify-center gap-2 whitespace-nowrap transition-colors",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cyan-400/60",
        "disabled:pointer-events-none disabled:opacity-40 cursor-pointer",
        variantClasses[variant],
        sizeClasses[size],
        className,
      )}
      {...props}
    />
  ),
);
Button.displayName = "Button";

export const Input = React.forwardRef<HTMLInputElement, React.InputHTMLAttributes<HTMLInputElement>>(
  ({ className, ...props }, ref) => (
    <input
      ref={ref}
      className={cn(
        "h-11 w-full rounded-lg border border-line bg-white/[0.04] px-4 text-sm text-foreground",
        "placeholder:text-muted/70 focus:outline-none focus:ring-2 focus:ring-cyan-400/50",
        "uppercase tracking-[0.3em] font-mono",
        className,
      )}
      {...props}
    />
  ),
);
Input.displayName = "Input";
