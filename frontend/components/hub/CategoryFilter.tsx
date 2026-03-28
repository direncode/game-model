"use client";

import { cn } from "@/lib/utils";

interface CategoryFilterProps {
  categories: Array<{ name: string; tags: string[] }>;
  selected: string | null;
  onSelect: (category: string | null) => void;
}

export default function CategoryFilter({
  categories,
  selected,
  onSelect,
}: CategoryFilterProps) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => onSelect(null)}
        className={cn(
          "px-3 py-1.5 rounded-full text-xs font-medium transition-colors border",
          !selected
            ? "bg-li-primary/10 text-li-primary border-li-primary/30"
            : "text-li-text-secondary border-li-border hover:text-li-text-primary hover:border-li-text-muted"
        )}
      >
        All
      </button>
      {categories.map((cat) => (
        <button
          key={cat.name}
          onClick={() => onSelect(cat.name === selected ? null : cat.name)}
          className={cn(
            "px-3 py-1.5 rounded-full text-xs font-medium transition-colors border",
            cat.name === selected
              ? "bg-li-primary/10 text-li-primary border-li-primary/30"
              : "text-li-text-secondary border-li-border hover:text-li-text-primary hover:border-li-text-muted"
          )}
        >
          {cat.name}
        </button>
      ))}
    </div>
  );
}
