"use client";

import { forwardRef, type ButtonHTMLAttributes, type HTMLAttributes } from "react";

export type CardDensity = "compact" | "default" | "spacious";

export type SurfaceCardProps = HTMLAttributes<HTMLDivElement> & {
  density?: CardDensity;
};

export const SurfaceCard = forwardRef<HTMLDivElement, SurfaceCardProps>(
  function SurfaceCard({ density = "default", className = "", ...props }, ref) {
    return (
      <div
        {...props}
        ref={ref}
        className={`bioazUiSurfaceCard bioazUiSurfaceCard--${density} ${className}`.trim()}
      />
    );
  },
);

export type ActionCardProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  density?: CardDensity;
};

export const ActionCard = forwardRef<HTMLButtonElement, ActionCardProps>(
  function ActionCard({ density = "default", className = "", type = "button", ...props }, ref) {
    return (
      <button
        {...props}
        ref={ref}
        type={type}
        className={`bioazUiActionCard bioazUiActionCard--${density} ${className}`.trim()}
      />
    );
  },
);
