import React from "react";
import { Loader2 } from "lucide-react";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "brand" | "subtle" | "danger" | "outline";
  size?: "sm" | "md" | "lg";
  isLoading?: boolean;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      children,
      className = "",
      variant = "primary",
      size = "md",
      isLoading = false,
      disabled = false,
      leftIcon,
      rightIcon,
      type = "button",
      ...props
    },
    ref
  ) => {
    const baseStyles =
      "inline-flex items-center justify-center font-medium transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-brand/40 focus:ring-offset-1 disabled:opacity-50 disabled:cursor-not-allowed select-none rounded-pill";

    const variantStyles = {
      primary:
        "bg-primary text-primary-text hover:bg-primary-hover shadow-sm active:scale-[0.99]",
      secondary:
        "bg-surface-elevated text-text-primary border border-border hover:bg-surface-subtle shadow-sm active:scale-[0.99]",
      brand:
        "bg-brand text-white hover:opacity-90 shadow-sm active:scale-[0.99]",
      subtle:
        "bg-transparent text-text-secondary hover:text-text-primary hover:bg-surface-subtle active:scale-[0.99]",
      outline:
        "bg-transparent text-text-primary border border-border hover:bg-surface-subtle active:scale-[0.99]",
      danger:
        "bg-danger/10 text-danger border border-danger/20 hover:bg-danger/20 active:scale-[0.99]",
    };

    const sizeStyles = {
      sm: "h-[34px] px-3 text-xs gap-1.5",
      md: "h-[42px] px-4 text-sm gap-2",
      lg: "h-[50px] px-6 text-base gap-2.5",
    };

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || isLoading}
        className={`${baseStyles} ${variantStyles[variant]} ${sizeStyles[size]} ${className}`}
        {...props}
      >
        {isLoading ? (
          <Loader2 className="h-4 w-4 animate-spin text-current" />
        ) : (
          leftIcon
        )}
        <span>{children}</span>
        {!isLoading && rightIcon}
      </button>
    );
  }
);

Button.displayName = "Button";

