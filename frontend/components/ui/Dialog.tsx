"use client";

import React, { Fragment } from "react";
import { Dialog as HeadlessDialog, Transition } from "@headlessui/react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

const sizeStyles = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
};

export interface DialogProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  size?: keyof typeof sizeStyles;
}

export default function Dialog({
  open,
  onClose,
  title,
  children,
  size = "md",
}: DialogProps) {
  return (
    <Transition appear show={open} as={Fragment}>
      <HeadlessDialog as="div" className="relative z-[100]" onClose={onClose}>
        <Transition.Child
          as={Fragment}
          enter="ease-out duration-200"
          enterFrom="opacity-0"
          enterTo="opacity-100"
          leave="ease-in duration-150"
          leaveFrom="opacity-100"
          leaveTo="opacity-0"
        >
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" />
        </Transition.Child>

        <div className="fixed inset-0 overflow-y-auto">
          <div className="flex min-h-full items-center justify-center p-4">
            <Transition.Child
              as={Fragment}
              enter="ease-out duration-200"
              enterFrom="opacity-0 scale-95"
              enterTo="opacity-100 scale-100"
              leave="ease-in duration-150"
              leaveFrom="opacity-100 scale-100"
              leaveTo="opacity-0 scale-95"
            >
              <HeadlessDialog.Panel
                className={cn(
                  "w-full transform bg-li-surface border border-li-border rounded-xl shadow-2xl transition-all",
                  sizeStyles[size]
                )}
              >
                {title && (
                  <div className="flex items-center justify-between px-6 py-4 border-b border-li-border">
                    <HeadlessDialog.Title className="text-lg font-display font-semibold text-li-text-primary">
                      {title}
                    </HeadlessDialog.Title>
                    <button
                      onClick={onClose}
                      className="p-1 rounded-md text-li-text-muted hover:text-li-text-primary hover:bg-li-surface-hover transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                )}
                <div className="px-6 py-4">{children}</div>
              </HeadlessDialog.Panel>
            </Transition.Child>
          </div>
        </div>
      </HeadlessDialog>
    </Transition>
  );
}
