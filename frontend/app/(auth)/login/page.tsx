"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useAuthStore } from "@/store/auth";
import { api } from "@/lib/api";
import toast from "react-hot-toast";
import { Eye, EyeOff, ArrowRight } from "lucide-react";

export default function LoginPage() {
  const router = useRouter();
  const { setAuth } = useAuthStore();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await api.login({ email, password });
      // Fetch user info after login
      api.setToken(res.access_token);
      const user = await api.getMe();
      setAuth(user as any, res.access_token);
      toast.success("Welcome back!");
      router.push("/");
    } catch (err: any) {
      toast.error(err.message || "Invalid credentials");
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
          Sign in to your account
        </p>
      </div>

      {/* Form */}
      <div className="li-card">
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
                placeholder="Enter your password"
                required
                autoComplete="current-password"
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

          <button
            type="submit"
            disabled={loading}
            className="li-btn-primary w-full flex items-center justify-center gap-2"
          >
            {loading ? (
              <div className="w-5 h-5 rounded-full border-2 border-white/30 border-t-white animate-spin" />
            ) : (
              <>
                Sign In
                <ArrowRight className="w-4 h-4" />
              </>
            )}
          </button>
        </form>
      </div>

      <p className="text-center text-sm text-li-text-muted mt-6">
        Don&apos;t have an account?{" "}
        <Link href="/register" className="text-li-primary hover:underline">
          Create one
        </Link>
      </p>
    </div>
  );
}
