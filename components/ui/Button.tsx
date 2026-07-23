"use client";

import { LoaderCircle } from "lucide-react";
import { forwardRef, type ButtonHTMLAttributes, type ReactNode } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "small" | "default" | "large";

export type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leadingIcon?: ReactNode;
};

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  {
    variant = "secondary",
    size = "default",
    loading = false,
    leadingIcon,
    className = "",
    children,
    disabled,
    ...props
  },
  ref,
) {
  const iconSize = size === "small" ? 14 : size === "large" ? 18 : 16;
  return (
    <button
      {...props}
      ref={ref}
      className={`bioazUiButton bioazUiButton--${variant} bioazUiButton--${size} ${className}`.trim()}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {loading ? <LoaderCircle className="bioazUiButtonSpinner" size={iconSize} /> : leadingIcon}
      <span>{children}</span>
    </button>
  );
});

export type IconButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  size?: "compact" | "default";
  selected?: boolean;
  icon: ReactNode;
  label: string;
};

export const IconButton = forwardRef<HTMLButtonElement, IconButtonProps>(
  function IconButton(
    { size = "default", selected = false, icon, label, className = "", ...props },
    ref,
  ) {
    return (
      <button
        {...props}
        ref={ref}
        className={`bioazUiIconButton bioazUiIconButton--${size} ${selected ? "bioazUiIconButton--selected" : ""} ${className}`.trim()}
        aria-label={label}
        aria-pressed={selected || undefined}
        title={props.title ?? label}
      >
        {icon}
      </button>
    );
  },
);
