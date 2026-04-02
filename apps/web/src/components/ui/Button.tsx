import type { ButtonHTMLAttributes, ReactNode } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  leftIcon?: ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary: "bg-accent-blue text-white hover:bg-blue-500 border border-blue-400/50",
  secondary: "bg-bg-card2 text-text-primary hover:bg-bg-hover border border-border-base",
  ghost:
    "bg-transparent text-text-secondary hover:text-text-primary hover:bg-bg-hover border border-transparent",
};

export function Button({
  variant = "primary",
  className = "",
  leftIcon,
  children,
  ...props
}: ButtonProps) {
  return (
    <button
      {...props}
      className={`inline-flex items-center gap-2 rounded-lg px-4 py-2 text-sm font-medium transition-colors duration-200 ${variantClasses[variant]} ${className}`}
    >
      {leftIcon}
      {children}
    </button>
  );
}
