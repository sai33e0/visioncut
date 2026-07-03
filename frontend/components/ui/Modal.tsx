"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
}

export function Modal({ open, onClose, title, children, className }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onEsc);
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onEsc);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div
        className={cn(
          "relative z-10 w-full max-w-lg rounded-2xl border bg-[rgb(var(--background))] p-6 shadow-2xl animate-fade-in",
          className
        )}
      >
        <button
          onClick={onClose}
          className="absolute right-3 top-3 rounded p-1 hover:bg-[rgb(var(--accent))]"
          aria-label="Close"
        >
          <X className="h-4 w-4" />
        </button>
        {title && <h2 className="mb-4 pr-8 text-lg font-semibold">{title}</h2>}
        {children}
      </div>
    </div>
  );
}
