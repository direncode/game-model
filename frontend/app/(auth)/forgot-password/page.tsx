"use client";

import { useState } from "react";
import Link from "next/link";
import { api } from "@/lib/api";
import toast from "react-hot-toast";
import { ArrowLeft, Mail } from "lucide-react";

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      await api.forgotPassword(email);
      setSent(true);
    } catch (err: any) {
      toast.error(err.message || "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <div className="w-12 h-12 rounded-xl bg-li-primary flex items-center justify-center mx-auto mb-4">
          <span className="text-white font-display text-lg">LI</span>
        </div>
        <h1 className="font-display text-lg tracking-widest text-li-text-primary mb-2">
          RESET PASSWORD
        </h1>
        <p className="text-sm text-li-text-secondary">
          {sent
            ? "Check your email for a reset link"
            : "Enter your email to receive a reset link"}
        </p>
      </div>

      <div className="li-card">
        {sent ? (
          <div className="text-center py-4">
            <Mail className="w-12 h-12 text-li-primary mx-auto mb-4" />
            <p className="text-sm text-li-text-secondary mb-2">
              If an account exists for <strong className="text-white">{email}</strong>,
              you&apos;ll receive a password reset link shortly.
            </p>
            <p className="text-xs text-li-text-muted">
              Didn&apos;t receive it? Check your spam folder or try again.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label
                htmlFor="email"
                className="block text-sm font-medium text-li-text-secondary mb-1.5"
              >
                Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="li-input"
                placeholder="you@company.com"
                required
                autoComplete="email"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="li-btn-primary w-full flex items-center justify-center gap-2"
            >
              {loading ? (
                <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
              ) : (
                "Send Reset Link"
              )}
            </button>
          </form>
        )}
      </div>

      <p className="text-center text-sm text-li-text-muted mt-6">
        <Link href="/login" className="text-li-primary hover:underline inline-flex items-center gap-1">
          <ArrowLeft className="w-3 h-3" />
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
