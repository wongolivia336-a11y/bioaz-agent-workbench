"use client";

import { forwardRef, type ButtonHTMLAttributes, type HTMLAttributes } from "react";
import { cn } from "../../lib/cn";

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
        className={cn("bioazUiSurfaceCard", `bioazUiSurfaceCard--${density}`, className)}
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
        className={cn("bioazUiActionCard", `bioazUiActionCard--${density}`, className)}
      />
    );
  },
);
