"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { useAppStore } from "@/stores/app";
import { PageLoader } from "@/components/LoadingSpinner";
import { Building2, Users, Database, Box } from "lucide-react";

export default function OrganizationsPage() {
  const user = useAppStore((s) => s.user);

  // For now, display the current user's organization info
  // Backend CRUD endpoints for organizations don't exist yet
  const { data: userData, isLoading } = useQuery({
    queryKey: ["me"],
    queryFn: () => api.getMe() as Promise<any>,
  });

  if (isLoading) return <PageLoader />;

  const currentUser = userData || user;

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-8">
        <h1 className="font-display text-3xl text-white tracking-tight">
          Organizations
        </h1>
        <p className="text-sm text-li-text-secondary mt-2">
          Manage organization settings and member access
        </p>
      </div>

      {currentUser?.organization_id ? (
        <div className="space-y-6">
          {/* Organization Info */}
          <div className="li-card">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-12 h-12 rounded-xl bg-li-primary/10 flex items-center justify-center">
                <Building2 className="w-6 h-6 text-li-primary" />
              </div>
              <div>
                <h2 className="text-lg font-display text-white">
                  Your Organization
                </h2>
                <p className="text-xs text-li-text-muted font-data">
                  ID: {currentUser.organization_id}
                </p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-4">
              <div className="p-4 rounded-lg bg-li-bg border border-li-border">
                <div className="flex items-center gap-2 mb-2">
                  <Users className="w-4 h-4 text-li-text-muted" />
                  <span className="text-xs text-li-text-muted">Members</span>
                </div>
                <p className="text-2xl font-display text-white">—</p>
                <p className="text-xs text-li-text-muted mt-1">Organization-wide endpoint coming soon</p>
              </div>

              <div className="p-4 rounded-lg bg-li-bg border border-li-border">
                <div className="flex items-center gap-2 mb-2">
                  <Database className="w-4 h-4 text-li-text-muted" />
                  <span className="text-xs text-li-text-muted">Datasets</span>
                </div>
                <p className="text-2xl font-display text-white">—</p>
                <p className="text-xs text-li-text-muted mt-1">Cross-org dataset limit</p>
              </div>

              <div className="p-4 rounded-lg bg-li-bg border border-li-border">
                <div className="flex items-center gap-2 mb-2">
                  <Box className="w-4 h-4 text-li-text-muted" />
                  <span className="text-xs text-li-text-muted">Plan</span>
                </div>
                <p className="text-2xl font-display text-white capitalize">—</p>
                <p className="text-xs text-li-text-muted mt-1">Organization plan tier</p>
              </div>
            </div>
          </div>

          {/* Placeholder for member management */}
          <div className="li-card">
            <h3 className="text-sm font-display text-li-text-primary mb-3">
              Members
            </h3>
            <div className="text-center py-8">
              <Users className="w-8 h-8 text-li-text-muted mx-auto mb-2" />
              <p className="text-sm text-li-text-muted">
                Organization member management is coming soon.
              </p>
              <p className="text-xs text-li-text-muted mt-1">
                Backend CRUD endpoints for organizations are in development.
              </p>
            </div>
          </div>
        </div>
      ) : (
        <div className="li-card text-center py-12">
          <Building2 className="w-12 h-12 text-li-text-muted mx-auto mb-4" />
          <h3 className="text-lg text-li-text-secondary mb-2">
            No organization
          </h3>
          <p className="text-sm text-li-text-muted max-w-md mx-auto">
            You&apos;re not part of an organization. Create one during registration
            or ask an admin to invite you.
          </p>
        </div>
      )}
    </div>
  );
}
