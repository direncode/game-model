"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { api } from "@/lib/api";
import toast from "react-hot-toast";
import { ArrowRight, CheckCircle2, Eye, EyeOff } from "lucide-react";

function ResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const token = searchParams.get("token");

  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState(false);

  if (!token) {
    return (
      <div className="text-center py-4">
        <p className="text-sm text-red-400">Invalid reset link. Please request a new one.</p>
        <Link href="/forgot-password" className="text-li-primary hover:underline text-sm mt-4 inline-block">
          Request new reset link
        </Link>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    setLoading(true);

    try {
      await api.resetPassword({ token, new_password: password });
      setSuccess(true);
      setTimeout(() => router.push("/login"), 3000);
    } catch (err: any) {
      toast.error(err.message || "Reset failed. The link may have expired.");
    } finally {
      setLoading(false);
    }
  };

  if (success) {
    return (
      <div className="text-center py-4">
        <CheckCircle2 className="w-12 h-12 text-green-400 mx-auto mb-4" />
        <p className="text-sm text-li-text-secondary">
          Password reset successfully. Redirecting to login...
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-li-text-secondary mb-1.5">
          New Password
        </label>
        <div className="relative">
          <input
            id="password"
            type={showPassword ? "text" : "password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="li-input pr-10"
            placeholder="Minimum 8 characters"
            required
            minLength={8}
            autoComplete="new-password"
          />
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-li-text-muted hover:text-li-text-secondary"
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        </div>
      </div>

      <div>
        <label htmlFor="confirmPassword" className="block text-sm font-medium text-li-text-secondary mb-1.5">
          Confirm New Password
        </label>
        <input
          id="confirmPassword"
          type="password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className="li-input"
          placeholder="Re-enter your password"
          required
          autoComplete="new-password"
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
          <>
            Reset Password
            <ArrowRight className="w-4 h-4" />
          </>
        )}
      </button>
    </form>
  );
}

export default function ResetPasswordPage() {
  return (
    <div className="w-full max-w-md">
      <div className="text-center mb-8">
        <div className="w-12 h-12 rounded-xl bg-li-primary flex items-center justify-center mx-auto mb-4">
          <span className="text-white font-display text-lg">LI</span>
        </div>
        <h1 className="font-display text-lg tracking-widest text-li-text-primary mb-2">
          SET NEW PASSWORD
        </h1>
      </div>

      <div className="li-card">
        <Suspense fallback={<div className="text-center py-4 text-li-text-muted">Loading...</div>}>
          <ResetPasswordForm />
        </Suspense>
      </div>

      <p className="text-center text-sm text-li-text-muted mt-6">
        <Link href="/login" className="text-li-primary hover:underline">
          Back to sign in
        </Link>
      </p>
    </div>
  );
}
