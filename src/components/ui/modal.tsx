"use client";

import { useEffect, useCallback, useRef, ReactNode } from "react";
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
  sm: "md:max-w-sm",
  md: "md:max-w-md",
  lg: "md:max-w-lg",
  xl: "md:max-w-xl",
  full: "md:max-w-4xl",
};

export function Modal({ open, onClose, children, className, title, description, size = "md" }: ModalProps) {
  const sheetRef = useRef<HTMLDivElement>(null);
  const dragStartY = useRef<number | null>(null);
  const dragCurrentY = useRef(0);

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

  // Bottom sheet drag-to-dismiss (mobile only)
  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    dragStartY.current = e.touches[0].clientY;
  }, []);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (dragStartY.current === null) return;
    const delta = e.touches[0].clientY - dragStartY.current;
    if (delta > 0 && sheetRef.current) {
      dragCurrentY.current = delta;
      sheetRef.current.style.transform = `translateY(${delta}px)`;
    }
  }, []);

  const handleTouchEnd = useCallback(() => {
    if (dragCurrentY.current > 120) {
      onClose();
    } else if (sheetRef.current) {
      sheetRef.current.style.transform = "";
    }
    dragStartY.current = null;
    dragCurrentY.current = 0;
  }, [onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-end md:items-center justify-center md:p-4"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/70 backdrop-blur-sm animate-fade-in" />

      {/* Content — bottom sheet on mobile, centered modal on desktop */}
      <div
        ref={sheetRef}
        className={cn(
          "relative w-full glass-strong shadow-2xl",
          // Mobile: bottom sheet
          "rounded-t-2xl animate-slide-up max-h-[85vh] overflow-y-auto",
          "pb-[env(safe-area-inset-bottom,0px)]",
          // Desktop: centered modal
          "md:rounded-2xl md:animate-fade-in-scale md:max-h-[90vh]",
          sizes[size],
          className
        )}
        onClick={(e) => e.stopPropagation()}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Drag handle — mobile only */}
        <div className="flex justify-center pt-3 pb-1 md:hidden">
          <div className="w-10 h-1 rounded-full bg-white/20" />
        </div>

        {/* Header */}
        {(title || description) && (
          <div className="flex items-start justify-between p-5 md:p-6 pb-0">
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
            className="absolute top-4 right-4 z-10 p-1.5 rounded-lg text-zinc-500 hover:text-zinc-300 hover:bg-zinc-800/50 transition-colors md:top-4 md:right-4"
            aria-label="Close"
          >
            <X className="w-4 h-4" />
          </button>
        )}

        {/* Body */}
        <div className="p-5 md:p-6">{children}</div>
      </div>
    </div>
  );
}
