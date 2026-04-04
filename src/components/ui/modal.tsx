"use client";

import { useEffect, useCallback, ReactNode } from "react";
import { cn } from "@/lib/utils";
import { X } from "lucide-react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  className?: string;
  title?: string;
  description?: string;
  size?: "sm" | "md" | "lg" | "xl" | "full";
}

const sizes = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
  full: "max-w-4xl",
};

export function Modal({ open, onClose, children, className, title, description, size = "md" }: ModalProps) {
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    },
    [onClose]
  );

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleEscape);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", handleEscape);
      document.body.style.overflow = "";
    };
  }, [open, handleEscape]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in" />

      {/* Content */}
      <div
        className={cn(
          "relative w-full rounded-2xl glass-strong shadow-2xl animate-fade-in-scale",
          sizes[size],
          className
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        {(title || description) && (
          <div className="flex items-start justify-between p-6 pb-0">
            <div>
              {title && <h2 className="text-lg font-semibold text-zinc-100">{title}</h2>}
              {description && <p className="text-sm text-zinc-500 mt-1">{description}</p>}
            </div>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800 transition-colors"
              aria-label="Close"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Close button when no header */}
        {!title && !description && (
          <button
            onClick={onClose}
            className="absolute top-4 right-4 z-10 p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition-colors"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Body */}
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
