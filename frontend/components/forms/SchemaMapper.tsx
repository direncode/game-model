"use client";

import React, { useState, useMemo } from "react";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import { cn } from "@/lib/utils";

export interface SchemaMapping {
  source_column: string;
  target_column: string;
  entity_type_column?: string;
  relationship_type_column?: string;
  attribute_columns: string[];
}

export interface SchemaMapperProps {
  headers: string[];
  sampleRows: string[][];
  onMapping: (mapping: SchemaMapping) => void;
}

export default function SchemaMapper({
  headers,
  sampleRows,
  onMapping,
}: SchemaMapperProps) {
  const [sourceCol, setSourceCol] = useState("");
  const [targetCol, setTargetCol] = useState("");
  const [entityTypeCol, setEntityTypeCol] = useState("");
  const [relTypeCol, setRelTypeCol] = useState("");
  const [attrCols, setAttrCols] = useState<string[]>([]);

  const columnOptions = headers.map((h) => ({ value: h, label: h }));

  const previewRows = sampleRows.slice(0, 5);

  // Estimate counts
  const entityCount = useMemo(() => {
    if (!sourceCol || !targetCol) return 0;
    const si = headers.indexOf(sourceCol);
    const ti = headers.indexOf(targetCol);
    if (si === -1 || ti === -1) return 0;
    const entities = new Set<string>();
    sampleRows.forEach((row) => {
      if (row[si]) entities.add(row[si]);
      if (row[ti]) entities.add(row[ti]);
    });
    return entities.size;
  }, [sourceCol, targetCol, headers, sampleRows]);

  function toggleAttr(col: string) {
    setAttrCols((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
    );
  }

  function handleSubmit() {
    if (!sourceCol || !targetCol) return;
    onMapping({
      source_column: sourceCol,
      target_column: targetCol,
      entity_type_column: entityTypeCol || undefined,
      relationship_type_column: relTypeCol || undefined,
      attribute_columns: attrCols,
    });
  }

  return (
    <div className="space-y-6">
      {/* Table preview */}
      <div className="overflow-x-auto border border-li-border rounded-lg">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-li-border bg-li-bg">
              {headers.map((h) => (
                <th
                  key={h}
                  className="px-3 py-2 text-left font-display font-medium text-li-text-muted"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-li-border">
            {previewRows.map((row, i) => (
              <tr key={i}>
                {row.map((cell, j) => (
                  <td key={j} className="px-3 py-2 text-li-text-secondary truncate max-w-[150px]">
                    {cell}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Column mapping */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Select
          label="Source Column"
          options={columnOptions}
          value={sourceCol}
          onChange={setSourceCol}
          placeholder="Select source entity column..."
        />
        <Select
          label="Target Column"
          options={columnOptions}
          value={targetCol}
          onChange={setTargetCol}
          placeholder="Select target entity column..."
        />
        <Select
          label="Entity Type Column (optional)"
          options={[{ value: "", label: "None" }, ...columnOptions]}
          value={entityTypeCol}
          onChange={setEntityTypeCol}
          placeholder="Select entity type column..."
        />
        <Select
          label="Relationship Type Column (optional)"
          options={[{ value: "", label: "None" }, ...columnOptions]}
          value={relTypeCol}
          onChange={setRelTypeCol}
          placeholder="Select relationship type column..."
        />
      </div>

      {/* Attribute columns multi-select */}
      <div className="space-y-2">
        <label className="block text-sm font-medium text-li-text-secondary">
          Attribute Columns
        </label>
        <div className="flex flex-wrap gap-2">
          {headers.map((h) => {
            const selected = attrCols.includes(h);
            const isMapped = [sourceCol, targetCol, entityTypeCol, relTypeCol].includes(h);
            return (
              <button
                key={h}
                type="button"
                onClick={() => !isMapped && toggleAttr(h)}
                disabled={isMapped}
                className={cn(
                  "px-2.5 py-1 rounded-md text-xs border transition-colors",
                  selected
                    ? "bg-li-primary/10 border-li-primary text-li-primary"
                    : isMapped
                    ? "bg-li-bg border-li-border text-li-text-muted opacity-50 cursor-not-allowed"
                    : "bg-li-bg border-li-border text-li-text-secondary hover:border-li-border-light"
                )}
              >
                {h}
              </button>
            );
          })}
        </div>
      </div>

      {/* Preview counts */}
      {sourceCol && targetCol && (
        <div className="li-card flex items-center gap-6 text-xs">
          <div>
            <span className="text-li-text-muted">Entities (sample): </span>
            <span className="font-display text-li-text-primary">{entityCount}</span>
          </div>
          <div>
            <span className="text-li-text-muted">Relationships (sample): </span>
            <span className="font-display text-li-text-primary">{sampleRows.length}</span>
          </div>
        </div>
      )}

      <Button
        variant="primary"
        onClick={handleSubmit}
        disabled={!sourceCol || !targetCol}
      >
        Apply Mapping
      </Button>
    </div>
  );
}
