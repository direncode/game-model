"use client";

import { useEffect, useState } from "react";
import { useAppStore } from "@/stores/app";
import { api } from "@/lib/api";
import toast from "react-hot-toast";
import {
  User,
  Shield,
  Monitor,
  Eye,
  EyeOff,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Mail,
} from "lucide-react";

type Tab = "profile" | "security" | "sessions";

interface SessionInfo {
  id: string;
  ip_address: string | null;
  device_name: string | null;
  last_active_at: string | null;
  created_at: string;
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>("profile");
  const user = useAppStore((s) => s.user);

  const tabs = [
    { id: "profile" as Tab, label: "Profile", icon: User },
    { id: "security" as Tab, label: "Security", icon: Shield },
    { id: "sessions" as Tab, label: "Sessions", icon: Monitor },
  ];

  return (
    <div className="max-w-4xl mx-auto p-6">
      <h1 className="font-display text-3xl text-white mb-8 tracking-tight">
        Account Settings
      </h1>

      {/* Tabs */}
      <div className="flex gap-1 mb-8 border-b border-li-border">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`flex items-center gap-2 px-4 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab.id
                ? "border-li-primary text-li-primary"
                : "border-transparent text-li-text-muted hover:text-li-text-secondary"
            }`}
          >
            <tab.icon className="w-4 h-4" />
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "profile" && <ProfileTab />}
      {activeTab === "security" && <SecurityTab />}
      {activeTab === "sessions" && <SessionsTab />}
    </div>
  );
}

// ── Profile Tab ─────────────────────────────────────────────────────

function ProfileTab() {
  const user = useAppStore((s) => s.user);
  const fetchUser = useAppStore((s) => s.fetchUser);
  const [name, setName] = useState(user?.name || "");
  const [avatarUrl, setAvatarUrl] = useState(user?.avatar_url || "");
  const [saving, setSaving] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.updateProfile({ name, avatar_url: avatarUrl || undefined });
      await fetchUser();
      toast.success("Profile updated");
    } catch (err: any) {
      toast.error(err.message || "Failed to update profile");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="li-card space-y-5">
        <div>
          <label className="block text-sm font-medium text-li-text-secondary mb-1.5">
            Email
          </label>
          <div className="flex items-center gap-2">
            <input
              type="email"
              value={user?.email || ""}
              disabled
              className="li-input opacity-60 cursor-not-allowed flex-1"
            />
            {user?.email_verified ? (
              <span className="text-green-400 text-xs flex items-center gap-1">
                <CheckCircle2 className="w-3 h-3" /> Verified
              </span>
            ) : (
              <VerifyEmailButton />
            )}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-li-text-secondary mb-1.5">
            Full Name
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="li-input"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-li-text-secondary mb-1.5">
            Avatar URL
          </label>
          <input
            type="url"
            value={avatarUrl}
            onChange={(e) => setAvatarUrl(e.target.value)}
            className="li-input"
            placeholder="https://..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-li-text-secondary mb-1.5">
            Role
          </label>
          <input
            type="text"
            value={user?.role || ""}
            disabled
            className="li-input opacity-60 cursor-not-allowed capitalize"
          />
        </div>

        <button
          onClick={handleSave}
          disabled={saving}
          className="li-btn-primary"
        >
          {saving ? "Saving..." : "Save Changes"}
        </button>
      </div>
    </div>
  );
}

function VerifyEmailButton() {
  const [sending, setSending] = useState(false);

  const handleResend = async () => {
    setSending(true);
    try {
      await api.resendVerification();
      toast.success("Verification email sent");
    } catch {
      toast.error("Failed to send verification email");
    } finally {
      setSending(false);
    }
  };

  return (
    <button
      onClick={handleResend}
      disabled={sending}
      className="text-amber-400 text-xs flex items-center gap-1 hover:underline"
    >
      <Mail className="w-3 h-3" />
      {sending ? "Sending..." : "Verify"}
    </button>
  );
}

// ── Security Tab ────────────────────────────────────────────────────

function SecurityTab() {
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const logout = useAppStore((s) => s.logout);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    if (newPassword.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    setSaving(true);
    try {
      await api.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      toast.success("Password changed. Please log in again.");
      await logout();
      window.location.href = "/login";
    } catch (err: any) {
      toast.error(err.message || "Failed to change password");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="li-card">
        <h3 className="text-white font-medium mb-4">Change Password</h3>
        <form onSubmit={handleChangePassword} className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-li-text-secondary mb-1.5">
              Current Password
            </label>
            <div className="relative">
              <input
                type={showCurrent ? "text" : "password"}
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                className="li-input pr-10"
                required
              />
              <button
                type="button"
                onClick={() => setShowCurrent(!showCurrent)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-li-text-muted"
              >
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-li-text-secondary mb-1.5">
              New Password
            </label>
            <div className="relative">
              <input
                type={showNew ? "text" : "password"}
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                className="li-input pr-10"
                placeholder="Minimum 8 characters"
                minLength={8}
                required
              />
              <button
                type="button"
                onClick={() => setShowNew(!showNew)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-li-text-muted"
              >
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-li-text-secondary mb-1.5">
              Confirm New Password
            </label>
            <input
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="li-input"
              required
            />
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button type="submit" disabled={saving} className="li-btn-primary">
              {saving ? "Changing..." : "Change Password"}
            </button>
            <p className="text-xs text-li-text-muted">
              <AlertCircle className="w-3 h-3 inline mr-1" />
              You&apos;ll be logged out of all devices
            </p>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Sessions Tab ────────────────────────────────────────────────────

function SessionsTab() {
  const [sessions, setSessions] = useState<SessionInfo[]>([]);
  const [loading, setLoading] = useState(true);

  const loadSessions = async () => {
    setLoading(true);
    try {
      const data = await api.getSessions();
      setSessions(data);
    } catch {
      toast.error("Failed to load sessions");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSessions();
  }, []);

  const handleRevoke = async (sessionId: string) => {
    try {
      await api.revokeSession(sessionId);
      toast.success("Session revoked");
      loadSessions();
    } catch {
      toast.error("Failed to revoke session");
    }
  };

  const handleRevokeAll = async () => {
    try {
      await api.logoutAll();
      toast.success("All sessions revoked. Please log in again.");
      window.location.href = "/login";
    } catch {
      toast.error("Failed to revoke sessions");
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "Never";
    return new Date(dateStr).toLocaleString();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-white font-medium">Active Sessions</h3>
          <p className="text-xs text-li-text-muted mt-1">
            Manage devices logged into your account
          </p>
        </div>
        <button
          onClick={handleRevokeAll}
          className="text-red-400 text-sm hover:underline"
        >
          Revoke all sessions
        </button>
      </div>

      {loading ? (
        <div className="text-center py-8 text-li-text-muted">Loading sessions...</div>
      ) : sessions.length === 0 ? (
        <div className="text-center py-8 text-li-text-muted">No active sessions</div>
      ) : (
        <div className="space-y-3">
          {sessions.map((session) => (
            <div
              key={session.id}
              className="li-card flex items-center justify-between"
            >
              <div className="flex items-center gap-3">
                <Monitor className="w-5 h-5 text-li-text-muted" />
                <div>
                  <p className="text-sm text-white">
                    {session.device_name || "Unknown Device"}
                  </p>
                  <p className="text-xs text-li-text-muted">
                    {session.ip_address || "Unknown IP"} &middot; Last active{" "}
                    {formatDate(session.last_active_at)}
                  </p>
                  <p className="text-xs text-li-text-muted">
                    Created {formatDate(session.created_at)}
                  </p>
                </div>
              </div>
              <button
                onClick={() => handleRevoke(session.id)}
                className="text-red-400 hover:text-red-300 p-2"
                title="Revoke session"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
