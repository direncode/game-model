"use client";

import React, { useState, useCallback } from "react";
import { useDropzone } from "react-dropzone";
import {
  Upload,
  File as FileIcon,
  Check,
  Loader2,
  ArrowLeft,
  ArrowRight,
} from "lucide-react";
import { cn } from "@/lib/utils";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";

interface DataUploadWizardProps {
  onComplete: (data: {
    name: string;
    description: string;
    file: File;
  }) => void;
}

const steps = [
  { label: "Details", number: 1 },
  { label: "Upload", number: 2 },
  { label: "Preview", number: 3 },
  { label: "Process", number: 4 },
];

export default function DataUploadWizard({ onComplete }: DataUploadWizardProps) {
  const [step, setStep] = useState(1);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [processing, setProcessing] = useState(false);

  const onDrop = useCallback((acceptedFiles: File[]) => {
    if (acceptedFiles.length > 0) {
      setFile(acceptedFiles[0]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "text/csv": [".csv"],
      "application/json": [".json"],
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet": [".xlsx"],
    },
    maxFiles: 1,
  });

  function canNext(): boolean {
    if (step === 1) return name.trim().length > 0;
    if (step === 2) return file !== null;
    return true;
  }

  function handleNext() {
    if (step === 3) {
      setProcessing(true);
      setStep(4);
      if (file) {
        onComplete({ name, description, file });
      }
      return;
    }
    setStep(step + 1);
  }

  return (
    <div className="space-y-6">
      {/* Step indicator */}
      <div className="flex items-center justify-center gap-2">
        {steps.map((s, i) => (
          <React.Fragment key={s.number}>
            {i > 0 && (
              <div
                className={cn(
                  "w-8 h-px",
                  step > s.number - 1 ? "bg-li-primary" : "bg-li-border"
                )}
              />
            )}
            <div className="flex items-center gap-2">
              <div
                className={cn(
                  "w-7 h-7 rounded-full flex items-center justify-center text-xs font-display font-medium",
                  step === s.number
                    ? "bg-li-primary text-white"
                    : step > s.number
                    ? "bg-li-accent text-white"
                    : "bg-li-bg border border-li-border text-li-text-muted"
                )}
              >
                {step > s.number ? <Check className="w-3.5 h-3.5" /> : s.number}
              </div>
              <span
                className={cn(
                  "text-xs hidden sm:inline",
                  step === s.number ? "text-li-text-primary" : "text-li-text-muted"
                )}
              >
                {s.label}
              </span>
            </div>
          </React.Fragment>
        ))}
      </div>

      {/* Step content */}
      <div className="min-h-[200px]">
        {step === 1 && (
          <div className="space-y-4 max-w-md mx-auto">
            <Input
              label="Dataset Name"
              placeholder="e.g., Financial Entities Q4 2024"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-li-text-secondary">
                Description
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description of the dataset..."
                rows={3}
                className="li-input w-full resize-none"
              />
            </div>
          </div>
        )}

        {step === 2 && (
          <div className="max-w-md mx-auto">
            <div
              {...getRootProps()}
              className={cn(
                "border-2 border-dashed rounded-xl p-8 text-center transition-colors cursor-pointer",
                isDragActive
                  ? "border-li-primary bg-li-primary/5"
                  : file
                  ? "border-li-accent bg-li-accent/5"
                  : "border-li-border hover:border-li-border-light"
              )}
            >
              <input {...getInputProps()} />
              {file ? (
                <div className="flex flex-col items-center gap-2">
                  <FileIcon className="w-8 h-8 text-li-accent" />
                  <p className="text-sm text-li-text-primary">{file.name}</p>
                  <p className="text-xs text-li-text-muted">
                    {(file.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                  <p className="text-xs text-li-accent">Click or drag to replace</p>
                </div>
              ) : (
                <div className="flex flex-col items-center gap-2">
                  <Upload className="w-8 h-8 text-li-text-muted" />
                  <p className="text-sm text-li-text-primary">
                    {isDragActive ? "Drop file here" : "Drag & drop or click to upload"}
                  </p>
                  <p className="text-xs text-li-text-muted">
                    CSV, JSON, or XLSX files supported
                  </p>
                </div>
              )}
            </div>
          </div>
        )}

        {step === 3 && file && (
          <div className="max-w-md mx-auto space-y-4">
            <div className="li-card">
              <h4 className="text-sm font-display font-medium text-li-text-primary mb-2">
                Summary
              </h4>
              <div className="space-y-2 text-xs text-li-text-secondary">
                <div className="flex justify-between">
                  <span className="text-li-text-muted">Name</span>
                  <span>{name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-li-text-muted">File</span>
                  <span>{file.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-li-text-muted">Size</span>
                  <span>{(file.size / 1024 / 1024).toFixed(2)} MB</span>
                </div>
                {description && (
                  <div className="flex justify-between">
                    <span className="text-li-text-muted">Description</span>
                    <span className="text-right max-w-[200px] truncate">
                      {description}
                    </span>
                  </div>
                )}
              </div>
            </div>
            <p className="text-xs text-li-text-muted text-center">
              Schema mapping will be configured after upload.
            </p>
          </div>
        )}

        {step === 4 && (
          <div className="flex flex-col items-center justify-center gap-4 py-8">
            {processing ? (
              <>
                <Loader2 className="w-8 h-8 text-li-primary animate-spin" />
                <p className="text-sm text-li-text-secondary">
                  Uploading and processing...
                </p>
              </>
            ) : (
              <>
                <Check className="w-8 h-8 text-li-accent" />
                <p className="text-sm text-li-text-primary">Upload complete</p>
              </>
            )}
          </div>
        )}
      </div>

      {/* Navigation buttons */}
      {step < 4 && (
        <div className="flex items-center justify-between">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => setStep(step - 1)}
            disabled={step === 1}
            icon={<ArrowLeft className="w-3.5 h-3.5" />}
          >
            Back
          </Button>
          <Button
            variant="primary"
            size="sm"
            onClick={handleNext}
            disabled={!canNext()}
          >
            {step === 3 ? "Start Upload" : "Next"}
            <ArrowRight className="w-3.5 h-3.5 ml-1" />
          </Button>
        </div>
      )}
    </div>
  );
}
