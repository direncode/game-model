"use client";

import { useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useDropzone } from "react-dropzone";
import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { api } from "@/lib/api";
import { cn, formatBytes } from "@/lib/utils";
import toast from "react-hot-toast";
import {
  Upload,
  FileText,
  ArrowRight,
  ArrowLeft,
  Check,
  X,
  AlertCircle,
} from "lucide-react";

type Step = 1 | 2 | 3 | 4;

const stepLabels: Record<Step, string> = {
  1: "Details",
  2: "Upload",
  3: "Preview",
  4: "Processing",
};

export default function NewDatasetPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>(1);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [datasetId, setDatasetId] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);

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
      "application/xml": [".graphml"],
    },
    maxFiles: 1,
    multiple: false,
  });

  const handleStep1Submit = async () => {
    if (!name.trim()) {
      toast.error("Please enter a dataset name");
      return;
    }
    try {
      const dataset = (await api.createDataset({
        name: name.trim(),
        description: description.trim() || undefined,
      })) as any;
      setDatasetId(dataset.id);
      setStep(2);
    } catch (err: any) {
      toast.error(err.message || "Failed to create dataset");
    }
  };

  const handleStep2Submit = async () => {
    if (!file || !datasetId) return;

    setUploading(true);
    try {
      const result = await api.uploadDataset(datasetId, file);
      setPreviewData(result);
      setStep(3);
    } catch (err: any) {
      toast.error(err.message || "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleStep3Submit = async () => {
    setStep(4);
    setProcessing(true);

    // Poll for profile readiness
    const pollInterval = setInterval(async () => {
      try {
        const dataset = (await api.getDataset(datasetId!)) as any;
        if (dataset.status === "ready") {
          clearInterval(pollInterval);
          setProcessing(false);
          toast.success("Dataset ready!");
          router.push(`/datasets/${datasetId}`);
        } else if (dataset.status === "error") {
          clearInterval(pollInterval);
          setProcessing(false);
          toast.error("Processing failed");
        }
      } catch {
        // Keep polling
      }
    }, 2000);

    // Safety timeout
    setTimeout(() => {
      clearInterval(pollInterval);
      if (processing) {
        setProcessing(false);
        router.push(`/datasets/${datasetId}`);
      }
    }, 120000);
  };

  return (
    <div className="min-h-screen">
      <Navbar />
      <Sidebar />
      <main className="ml-60 pt-14">
        <div className="p-8 max-w-3xl mx-auto">
          {/* Header */}
          <h1 className="text-2xl font-display text-li-text-primary mb-2">
            New Dataset
          </h1>
          <p className="text-sm text-li-text-secondary mb-8">
            Upload and configure your graph dataset
          </p>

          {/* Steps indicator */}
          <div className="flex items-center gap-2 mb-10">
            {([1, 2, 3, 4] as Step[]).map((s) => (
              <div key={s} className="flex items-center gap-2">
                <div
                  className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center text-sm font-data",
                    step === s
                      ? "bg-li-primary text-white"
                      : step > s
                      ? "bg-li-accent text-white"
                      : "bg-li-surface border border-li-border text-li-text-muted"
                  )}
                >
                  {step > s ? <Check className="w-4 h-4" /> : s}
                </div>
                <span
                  className={cn(
                    "text-sm hidden sm:block",
                    step === s
                      ? "text-li-text-primary font-medium"
                      : "text-li-text-muted"
                  )}
                >
                  {stepLabels[s]}
                </span>
                {s < 4 && (
                  <div
                    className={cn(
                      "w-8 h-px",
                      step > s ? "bg-li-accent" : "bg-li-border"
                    )}
                  />
                )}
              </div>
            ))}
          </div>

          {/* Step 1: Name & Description */}
          {step === 1 && (
            <div className="li-card space-y-6">
              <div>
                <label
                  htmlFor="name"
                  className="block text-sm font-medium text-li-text-secondary mb-1.5"
                >
                  Dataset Name
                </label>
                <input
                  id="name"
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="li-input"
                  placeholder="e.g., Financial Entities Q4 2025"
                  autoFocus
                />
              </div>
              <div>
                <label
                  htmlFor="description"
                  className="block text-sm font-medium text-li-text-secondary mb-1.5"
                >
                  Description{" "}
                  <span className="text-li-text-muted">(optional)</span>
                </label>
                <textarea
                  id="description"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="li-input min-h-[100px] resize-y"
                  placeholder="Describe the dataset contents and purpose..."
                />
              </div>
              <div className="flex justify-end">
                <button
                  onClick={handleStep1Submit}
                  className="li-btn-primary flex items-center gap-2"
                >
                  Continue
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 2: File Upload */}
          {step === 2 && (
            <div className="li-card space-y-6">
              <div
                {...getRootProps()}
                className={cn(
                  "border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-all",
                  isDragActive
                    ? "border-li-primary bg-li-primary/5"
                    : file
                    ? "border-li-accent bg-li-accent/5"
                    : "border-li-border hover:border-li-border-light"
                )}
              >
                <input {...getInputProps()} />
                {file ? (
                  <div className="space-y-3">
                    <div className="w-12 h-12 rounded-xl bg-li-accent/10 flex items-center justify-center mx-auto">
                      <FileText className="w-6 h-6 text-li-accent" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-li-text-primary">
                        {file.name}
                      </p>
                      <p className="text-xs text-li-text-muted font-data">
                        {formatBytes(file.size)}
                      </p>
                    </div>
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        setFile(null);
                      }}
                      className="text-xs text-li-danger hover:underline"
                    >
                      Remove file
                    </button>
                  </div>
                ) : (
                  <div className="space-y-3">
                    <div className="w-12 h-12 rounded-xl bg-li-primary/10 flex items-center justify-center mx-auto">
                      <Upload className="w-6 h-6 text-li-primary" />
                    </div>
                    <div>
                      <p className="text-sm text-li-text-primary">
                        {isDragActive
                          ? "Drop file here..."
                          : "Drag & drop your file here, or click to browse"}
                      </p>
                      <p className="text-xs text-li-text-muted mt-1">
                        Supports CSV, JSON, and GraphML formats
                      </p>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex justify-between">
                <button
                  onClick={() => setStep(1)}
                  className="li-btn-ghost flex items-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
                <button
                  onClick={handleStep2Submit}
                  disabled={!file || uploading}
                  className="li-btn-primary flex items-center gap-2"
                >
                  {uploading ? (
                    <>
                      <LoadingSpinner size="sm" />
                      Uploading...
                    </>
                  ) : (
                    <>
                      Upload
                      <ArrowRight className="w-4 h-4" />
                    </>
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Step 3: Schema Preview */}
          {step === 3 && (
            <div className="li-card space-y-6">
              <div>
                <h3 className="text-lg font-display text-li-text-primary mb-2">
                  Schema Preview
                </h3>
                <p className="text-sm text-li-text-secondary">
                  Review the auto-detected schema before processing.
                </p>
              </div>

              {previewData ? (
                <div className="bg-li-bg rounded-lg p-4 border border-li-border">
                  <pre className="text-xs font-data text-li-text-secondary overflow-auto max-h-64">
                    {JSON.stringify(previewData, null, 2)}
                  </pre>
                </div>
              ) : (
                <div className="flex items-center gap-3 p-4 rounded-lg bg-li-accent/5 border border-li-accent/20">
                  <Check className="w-5 h-5 text-li-accent flex-shrink-0" />
                  <p className="text-sm text-li-text-secondary">
                    Schema auto-detected successfully. Ready to process.
                  </p>
                </div>
              )}

              <div className="flex justify-between">
                <button
                  onClick={() => setStep(2)}
                  className="li-btn-ghost flex items-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" />
                  Back
                </button>
                <button
                  onClick={handleStep3Submit}
                  className="li-btn-primary flex items-center gap-2"
                >
                  Start Processing
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}

          {/* Step 4: Processing */}
          {step === 4 && (
            <div className="li-card text-center py-12 space-y-6">
              {processing ? (
                <>
                  <LoadingSpinner size="lg" className="mb-4" />
                  <div>
                    <h3 className="text-lg font-display text-li-text-primary mb-2">
                      Processing Dataset
                    </h3>
                    <p className="text-sm text-li-text-secondary">
                      Your dataset is being profiled. This may take a few
                      moments...
                    </p>
                  </div>
                  <div className="flex items-center justify-center gap-6 text-sm font-data">
                    <span className="text-li-accent flex items-center gap-2">
                      <Check className="w-4 h-4" /> Uploaded
                    </span>
                    <span className="text-li-primary flex items-center gap-2">
                      <LoadingSpinner size="sm" /> Profiling
                    </span>
                    <span className="text-li-text-muted">Ready</span>
                  </div>
                </>
              ) : (
                <>
                  <div className="w-16 h-16 rounded-2xl bg-li-accent/10 flex items-center justify-center mx-auto">
                    <Check className="w-8 h-8 text-li-accent" />
                  </div>
                  <div>
                    <h3 className="text-lg font-display text-li-text-primary mb-2">
                      Dataset Ready
                    </h3>
                    <p className="text-sm text-li-text-secondary">
                      Your dataset has been processed and is ready for analysis.
                    </p>
                  </div>
                </>
              )}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
