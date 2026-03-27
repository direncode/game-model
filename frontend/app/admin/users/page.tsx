"use client";

import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";
import { PageLoader } from "@/components/LoadingSpinner";
import { formatDateTime } from "@/lib/utils";
import type { User } from "@/lib/types";
import toast from "react-hot-toast";
import { Users, Shield } from "lucide-react";

const roles = ["admin", "operator", "analyst", "viewer"] as const;

const roleColors: Record<string, string> = {
  admin: "bg-li-danger/20 text-li-danger",
  operator: "bg-li-primary/20 text-li-primary",
  analyst: "bg-li-accent/20 text-li-accent",
  viewer: "bg-li-text-muted/20 text-li-text-muted",
};

export default function UsersPage() {
  const queryClient = useQueryClient();

  const { data: users, isLoading } = useQuery({
    queryKey: ["admin-users"],
    queryFn: () => api.listUsers() as Promise<User[]>,
  });

  const updateRoleMutation = useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: string }) =>
      api.updateUserRole(userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["admin-users"] });
      toast.success("Role updated");
    },
    onError: (err: any) => toast.error(err.message || "Failed to update role"),
  });

  return (
    <div className="min-h-screen">
      <Navbar />
      <Sidebar />
      <main className="ml-64 pt-16">
        <div className="p-8">
          <div className="mb-8">
            <h1 className="text-2xl font-display text-li-text-primary flex items-center gap-3">
              <Users className="w-6 h-6 text-li-primary" />
              User Management
            </h1>
            <p className="text-sm text-li-text-secondary mt-1">
              Manage user accounts and role assignments
            </p>
          </div>

          {isLoading ? (
            <PageLoader />
          ) : (
            <div className="li-card overflow-x-auto p-0">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-li-border">
                    <th className="text-left text-xs font-data font-medium text-li-text-muted uppercase tracking-wider py-3 px-4">
                      Name
                    </th>
                    <th className="text-left text-xs font-data font-medium text-li-text-muted uppercase tracking-wider py-3 px-4">
                      Email
                    </th>
                    <th className="text-left text-xs font-data font-medium text-li-text-muted uppercase tracking-wider py-3 px-4">
                      Role
                    </th>
                    <th className="text-left text-xs font-data font-medium text-li-text-muted uppercase tracking-wider py-3 px-4">
                      Last Login
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-li-border">
                  {(users as User[] | undefined)?.map((user) => (
                    <tr
                      key={user.id}
                      className="hover:bg-li-surface-hover transition-colors"
                    >
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-full bg-li-primary/10 flex items-center justify-center">
                            <span className="text-xs font-display text-li-primary">
                              {user.name
                                .split(" ")
                                .map((n) => n[0])
                                .join("")
                                .slice(0, 2)
                                .toUpperCase()}
                            </span>
                          </div>
                          <span className="text-sm font-medium text-li-text-primary">
                            {user.name}
                          </span>
                        </div>
                      </td>
                      <td className="py-3 px-4 text-sm text-li-text-secondary font-data">
                        {user.email}
                      </td>
                      <td className="py-3 px-4">
                        <select
                          value={user.role}
                          onChange={(e) =>
                            updateRoleMutation.mutate({
                              userId: user.id,
                              role: e.target.value,
                            })
                          }
                          className="li-input py-1 px-2 text-sm w-auto"
                        >
                          {roles.map((role) => (
                            <option key={role} value={role}>
                              {role.charAt(0).toUpperCase() + role.slice(1)}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="py-3 px-4 text-sm text-li-text-muted font-data">
                        {user.last_login
                          ? formatDateTime(user.last_login)
                          : "Never"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
