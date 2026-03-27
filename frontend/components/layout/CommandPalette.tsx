"use client";

import React, { useEffect, useState } from "react";
import { Command } from "cmdk";
import { useRouter } from "next/navigation";
import {
  LayoutDashboard,
  Database,
  Box,
  GitBranch,
  Swords,
  Plus,
  Sparkles,
  Search,
} from "lucide-react";

interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  recentDatasets?: Array<{ id: string; name: string }>;
}

export default function CommandPalette({
  open,
  onOpenChange,
  recentDatasets = [],
}: CommandPaletteProps) {
  const router = useRouter();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        onOpenChange(!open);
      }
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [open, onOpenChange]);

  function navigate(path: string) {
    router.push(path);
    onOpenChange(false);
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100]">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={() => onOpenChange(false)}
      />

      {/* Dialog */}
      <div className="absolute top-[20%] left-1/2 -translate-x-1/2 w-full max-w-lg">
        <Command
          className="bg-li-surface border border-li-border rounded-xl shadow-2xl overflow-hidden"
          onKeyDown={(e: React.KeyboardEvent) => {
            if (e.key === "Escape") onOpenChange(false);
          }}
        >
          <div className="flex items-center gap-2 px-4 border-b border-li-border">
            <Search className="w-4 h-4 text-li-text-muted flex-shrink-0" />
            <Command.Input
              autoFocus
              placeholder="Search commands, datasets, modules..."
              className="flex-1 py-3 bg-transparent text-sm text-li-text-primary placeholder-li-text-muted outline-none"
            />
          </div>

          <Command.List className="max-h-80 overflow-y-auto p-2">
            <Command.Empty className="py-6 text-center text-sm text-li-text-muted">
              No results found.
            </Command.Empty>

            <Command.Group
              heading="Navigation"
              className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-display [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-li-text-muted [&_[cmdk-group-heading]]:uppercase"
            >
              <Command.Item
                onSelect={() => navigate("/dashboard")}
                className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-li-text-secondary cursor-pointer data-[selected=true]:bg-li-primary/10 data-[selected=true]:text-li-primary"
              >
                <LayoutDashboard className="w-4 h-4" />
                Dashboard
              </Command.Item>
              <Command.Item
                onSelect={() => navigate("/datasets")}
                className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-li-text-secondary cursor-pointer data-[selected=true]:bg-li-primary/10 data-[selected=true]:text-li-primary"
              >
                <Database className="w-4 h-4" />
                Datasets
              </Command.Item>
              <Command.Item
                onSelect={() => navigate("/modules")}
                className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-li-text-secondary cursor-pointer data-[selected=true]:bg-li-primary/10 data-[selected=true]:text-li-primary"
              >
                <Box className="w-4 h-4" />
                Modules
              </Command.Item>
              <Command.Item
                onSelect={() => navigate("/connections")}
                className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-li-text-secondary cursor-pointer data-[selected=true]:bg-li-primary/10 data-[selected=true]:text-li-primary"
              >
                <GitBranch className="w-4 h-4" />
                Connections
              </Command.Item>
              <Command.Item
                onSelect={() => navigate("/challenges")}
                className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-li-text-secondary cursor-pointer data-[selected=true]:bg-li-primary/10 data-[selected=true]:text-li-primary"
              >
                <Swords className="w-4 h-4" />
                Challenges
              </Command.Item>
            </Command.Group>

            {recentDatasets.length > 0 && (
              <Command.Group
                heading="Recent Datasets"
                className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-display [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-li-text-muted [&_[cmdk-group-heading]]:uppercase"
              >
                {recentDatasets.map((ds) => (
                  <Command.Item
                    key={ds.id}
                    onSelect={() => navigate(`/datasets/${ds.id}`)}
                    className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-li-text-secondary cursor-pointer data-[selected=true]:bg-li-primary/10 data-[selected=true]:text-li-primary"
                  >
                    <Database className="w-4 h-4" />
                    {ds.name}
                  </Command.Item>
                ))}
              </Command.Group>
            )}

            <Command.Group
              heading="Actions"
              className="[&_[cmdk-group-heading]]:px-2 [&_[cmdk-group-heading]]:py-1.5 [&_[cmdk-group-heading]]:text-[10px] [&_[cmdk-group-heading]]:font-display [&_[cmdk-group-heading]]:tracking-widest [&_[cmdk-group-heading]]:text-li-text-muted [&_[cmdk-group-heading]]:uppercase"
            >
              <Command.Item
                onSelect={() => navigate("/datasets/new")}
                className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-li-text-secondary cursor-pointer data-[selected=true]:bg-li-primary/10 data-[selected=true]:text-li-primary"
              >
                <Plus className="w-4 h-4" />
                Create Dataset
              </Command.Item>
              <Command.Item
                onSelect={() => navigate("/datasets?action=crystallize")}
                className="flex items-center gap-3 px-3 py-2 rounded-md text-sm text-li-text-secondary cursor-pointer data-[selected=true]:bg-li-primary/10 data-[selected=true]:text-li-primary"
              >
                <Sparkles className="w-4 h-4" />
                Start Crystallization
              </Command.Item>
            </Command.Group>
          </Command.List>
        </Command>
      </div>
    </div>
  );
}
