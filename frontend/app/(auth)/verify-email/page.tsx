"use client";

import { useEffect, useState, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";

function VerifyEmailContent() {
  const searchParams = useSearchParams();
  const token = searchParams.get("token");
  const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
  const [message, setMessage] = useState("");

  useEffect(() => {
    if (!token) {
      setStatus("error");
      setMessage("Invalid verification link.");
      return;
    }

    api
      .verifyEmail(token)
      .then(() => {
        setStatus("success");
        setMessage("Your email has been verified successfully.");
      })
      .catch((err: any) => {
        setStatus("error");
        setMessage(err.message || "Verification failed. The link may have expired.");
      });
  }, [token]);

  return (
    <div className="text-center py-6">
      {status === "loading" && (
        <>
          <Loader2 className="w-12 h-12 text-li-primary mx-auto mb-4 animate-spin" />
          <p className="text-sm text-li-text-secondary">Verifying your email...</p>
        </>
      )}

      {status === "success" && (
        <>
          <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-4" />
          <p className="text-sm text-li-text-secondary mb-4">{message}</p>
          <Link href="/" className="li-btn-primary inline-flex items-center gap-2">
            Go to Dashboard
          </Link>
        </>
      )}

      {status === "error" && (
        <>
          <XCircle className="w-12 h-12 text-red-400 mx-auto mb-4" />
          <p className="text-sm text-red-400 mb-4">{message}</p>
          <Link href="/login" className="text-li-primary hover:underline text-sm">
            Back to sign in
          </Link>
        </>
      )}
    </div>
  );
}

export default function VerifyEmailPage() {
  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <div className="w-12 h-12 rounded-xl bg-li-primary flex items-center justify-center mx-auto mb-4">
          <span className="text-white font-display text-lg">LI</span>
        </div>
        <h1 className="font-display text-lg tracking-widest text-li-text-primary mb-2">
          EMAIL VERIFICATION
        </h1>
      </div>

      <div className="li-card">
        <Suspense fallback={<div className="text-center py-4 text-li-text-muted">Loading...</div>}>
          <VerifyEmailContent />
        </Suspense>
      </div>
    </div>
  );
}
