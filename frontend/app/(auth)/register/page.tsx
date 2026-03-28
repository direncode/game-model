"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAppStore } from "@/stores/app";
import { api } from "@/lib/api";
import toast from "react-hot-toast";
import { Eye, EyeOff, ArrowRight } from "lucide-react";

export default function RegisterPage() {
  const router = useRouter();
  const appLogin = useAppStore((s) => s.login);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [organization, setOrganization] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

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
      await api.register({ email, name, password, organization_name: organization || undefined });
      // Auto-login after registration
      await appLogin(email, password);
      toast.success("Account created! Check your email to verify.");
      router.push("/");
    } catch (err: any) {
      toast.error(err.message || "Registration failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="w-full max-w-md">
      {/* Logo */}
      <div className="text-center mb-8">
        <div className="w-12 h-12 rounded-xl bg-li-primary flex items-center justify-center mx-auto mb-4">
          <span className="text-white font-display text-lg">LI</span>
        </div>
        <h1 className="font-display text-lg tracking-widest text-li-text-primary mb-2">
          LATENT INTELLIGENCE
        </h1>
        <p className="text-sm text-li-text-secondary">
          Create your account
        </p>
      </div>

      {/* Form */}
      <div className="li-card">
        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label
              htmlFor="name"
              className="block text-sm font-medium text-li-text-secondary mb-1.5"
            >
              Full Name
            </label>
            <input
              id="name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="li-input"
              placeholder="Jane Doe"
              required
              autoComplete="name"
            />
          </div>

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

          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium text-li-text-secondary mb-1.5"
            >
              Password
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
                {showPassword ? (
                  <EyeOff className="w-4 h-4" />
                ) : (
                  <Eye className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="block text-sm font-medium text-li-text-secondary mb-1.5"
            >
              Confirm Password
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

          <div>
            <label
              htmlFor="organization"
              className="block text-sm font-medium text-li-text-secondary mb-1.5"
            >
              Organization{" "}
              <span className="text-li-text-muted">(optional)</span>
            </label>
            <input
              id="organization"
              type="text"
              value={organization}
              onChange={(e) => setOrganization(e.target.value)}
              className="li-input"
              placeholder="Acme Corp"
              autoComplete="organization"
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
                Create Account
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>

      <p className="text-center text-sm text-li-text-muted mt-6">
        Already have an account?{" "}
        <Link href="/login" className="text-li-primary hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
