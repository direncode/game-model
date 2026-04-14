"use client";

import { useState } from "react";
import { Sidebar } from "@/components/Sidebar";
import { Navbar } from "@/components/Navbar";
import { useDataEstateStore } from "@/lib/data-estate/store";
import { submitDocument } from "@/lib/data-estate/api";
import { FileText, Send, CheckCircle2, AlertCircle } from "lucide-react";

export default function SubmitDocumentPage() {
  const [title, setTitle] = useState("");
  const [rawText, setRawText] = useState("");
  const [estateTag, setEstateTag] = useState("default");
  const [submitting, setSubmitting] = useState(false);
  const [toast, setToast] = useState<{ type: "success" | "error"; message: string } | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!title.trim() || !rawText.trim()) return;

    setSubmitting(true);
    setToast(null);
    try {
      await submitDocument(title.trim(), rawText.trim(), estateTag.trim() || "default");
      setToast({ type: "success", message: "Document submitted successfully. It will be reviewed before appearing in the Scroll." });
      setTitle("");
      setRawText("");
      setEstateTag("default");
    } catch (err: any) {
      setToast({ type: "error", message: err.message || "Submission failed. Please try again." });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-li-bg">
      <Navbar />
      <Sidebar />
      <main className="ml-60 pt-14 p-6">
        {/* Header */}
        <div className="mb-6">
          <h1 className="text-2xl font-semibold text-white flex items-center gap-2">
            <FileText className="w-6 h-6 text-cyan-400" />
            Submit Document
          </h1>
          <p className="text-sm text-li-text-muted mt-1">
            Add a new document to the estate for review and crystallization
          </p>
        </div>

        {/* Toast */}
        {toast && (
          <div
            className={`mb-5 flex items-center gap-2 px-4 py-3 rounded-lg text-sm border ${
              toast.type === "success"
                ? "bg-green-400/10 text-green-400 border-green-400/20"
                : "bg-red-400/10 text-red-400 border-red-400/20"
            }`}
          >
            {toast.type === "success" ? (
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 flex-shrink-0" />
            )}
            {toast.message}
          </div>
        )}

        {/* Form */}
        <form onSubmit={handleSubmit} className="li-card p-6 max-w-2xl space-y-5">
          <div>
            <label htmlFor="title" className="block text-sm font-medium text-li-text-muted mb-1.5">
              Title
            </label>
            <input
              id="title"
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Document title"
              required
              className="w-full px-3 py-2.5 bg-li-gray-900 border border-li-gray-800 rounded-lg text-sm text-white placeholder:text-li-text-muted focus:outline-none focus:border-cyan-500/40"
            />
          </div>

          <div>
            <label htmlFor="raw_text" className="block text-sm font-medium text-li-text-muted mb-1.5">
              Content
            </label>
            <textarea
              id="raw_text"
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder="Paste the document text here..."
              required
              rows={10}
              className="w-full px-3 py-2.5 bg-li-gray-900 border border-li-gray-800 rounded-lg text-sm text-white placeholder:text-li-text-muted focus:outline-none focus:border-cyan-500/40 resize-y"
            />
          </div>

          <div>
            <label htmlFor="estate_tag" className="block text-sm font-medium text-li-text-muted mb-1.5">
              Estate Tag
            </label>
            <input
              id="estate_tag"
              type="text"
              value={estateTag}
              onChange={(e) => setEstateTag(e.target.value)}
              placeholder="default"
              className="w-full px-3 py-2.5 bg-li-gray-900 border border-li-gray-800 rounded-lg text-sm text-white placeholder:text-li-text-muted focus:outline-none focus:border-cyan-500/40"
            />
            <p className="text-xs text-li-text-muted mt-1">
              Optional tag for organizing documents within the estate
            </p>
          </div>

          <button
            type="submit"
            disabled={submitting || !title.trim() || !rawText.trim()}
            className="flex items-center gap-2 px-5 py-2.5 bg-cyan-500 hover:bg-cyan-600 disabled:bg-cyan-500/30 disabled:cursor-not-allowed text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Send className="w-4 h-4" />
            {submitting ? "Submitting..." : "Submit Document"}
          </button>
        </form>
      </main>
    </div>
  );
}
