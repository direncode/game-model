'use client';

import { useState, useCallback, useRef } from 'react';

const ACCEPTED_EXTENSIONS = ['.csv', '.tsv', '.json', '.jsonl', '.parquet', '.xlsx', '.xls'];
const ACCEPTED_MIME_TYPES = [
  'text/csv',
  'text/tab-separated-values',
  'application/json',
  'application/vnd.apache.parquet',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
];

interface FileDropProps {
  onFileDrop: (file: File) => void;
}

function isAcceptedFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return ACCEPTED_EXTENSIONS.some((ext) => name.endsWith(ext)) ||
    ACCEPTED_MIME_TYPES.includes(file.type);
}

export function FileDrop({ onFileDrop }: FileDropProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounter = useRef(0);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current++;
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragOver(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      e.stopPropagation();
      setIsDragOver(false);
      dragCounter.current = 0;

      const file = e.dataTransfer.files?.[0];
      if (file && isAcceptedFile(file)) {
        onFileDrop(file);
      }
    },
    [onFileDrop]
  );

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className={`w-full border border-dashed rounded-lg px-5 py-4 text-center transition-all duration-200 cursor-default ${
        isDragOver
          ? 'border-li-cyan/40 bg-li-cyan/[0.03]'
          : 'border-white/[0.04] hover:border-white/[0.08]'
      }`}
    >
      <p
        className={`text-[11px] font-mono transition-colors duration-200 ${
          isDragOver ? 'text-li-cyan/60' : 'text-white/15'
        }`}
      >
        {isDragOver
          ? 'Drop to analyze'
          : 'or drag a file here \u2014 csv, json, parquet, excel'}
      </p>
    </div>
  );
}

/**
 * Full-page drag overlay used by the parent page.
 * Renders a translucent overlay when a file is being dragged over the window.
 */
export function PageFileDrop({ onFileDrop }: FileDropProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const dragCounter = useRef(0);

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current++;
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragOver(true);
    }
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    dragCounter.current--;
    if (dragCounter.current === 0) {
      setIsDragOver(false);
    }
  }, []);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
  }, []);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      dragCounter.current = 0;

      const file = e.dataTransfer.files?.[0];
      if (file && isAcceptedFile(file)) {
        onFileDrop(file);
      }
    },
    [onFileDrop]
  );

  return (
    <div
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
      className="fixed inset-0 z-0"
    >
      {isDragOver && (
        <div className="fixed inset-0 z-50 bg-li-depth-1/80 backdrop-blur-sm flex items-center justify-center pointer-events-none">
          <div className="border border-dashed border-li-cyan/30 rounded-2xl px-16 py-12 text-center">
            <p className="text-sm font-mono text-li-cyan/60">Drop your file to analyze</p>
            <p className="text-[10px] font-mono text-white/20 mt-2">
              csv, json, parquet, excel
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
