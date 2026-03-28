"use client";

import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api } from "@/lib/api";
import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";
import { PageLoader } from "@/components/LoadingSpinner";
import { cn } from "@/lib/utils";
import toast from "react-hot-toast";
import {
  Bell,
  Plus,
  Edit2,
  Trash2,
  X,
  AlertTriangle,
} from "lucide-react";

interface AlertRule {
  id: string;
  rule_type: string;
  conditions: Record<string, unknown>;
  delivery_method: string;
  delivery_config: Record<string, unknown>;
  active: boolean;
  created_at: string;
  updated_at: string;
}

const RULE_TYPES = [
  { value: "purity_drop", label: "Purity Drop" },
  { value: "new_connection", label: "New Connection" },
  { value: "module_change", label: "Module Change" },
  { value: "anomaly", label: "Anomaly" },
];

const DELIVERY_METHODS = [
  { value: "email", label: "Email" },
  { value: "webhook", label: "Webhook" },
  { value: "in_app", label: "In-App" },
];

function summarizeConditions(conditions: Record<string, unknown>): string {
  const entries = Object.entries(conditions);
  if (entries.length === 0) return "No conditions";
  return entries
    .slice(0, 3)
    .map(([k, v]) => `${k}: ${JSON.stringify(v)}`)
    .join(", ")
    + (entries.length > 3 ? ` (+${entries.length - 3} more)` : "");
}

interface AlertFormData {
  rule_type: string;
  conditions: string;
  delivery_method: string;
  delivery_config: string;
}

const defaultFormData: AlertFormData = {
  rule_type: "purity_drop",
  conditions: "{}",
  delivery_method: "email",
  delivery_config: '{"email": ""}',
};

export default function AlertsPage() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingAlert, setEditingAlert] = useState<AlertRule | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);
  const [formData, setFormData] = useState<AlertFormData>(defaultFormData);

  const { data: alerts, isLoading } = useQuery({
    queryKey: ["alerts"],
    queryFn: () => api.listAlerts() as Promise<AlertRule[]>,
  });

  const createMutation = useMutation({
    mutationFn: (data: object) => api.createAlert(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      toast.success("Alert rule created");
      closeModal();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: object }) =>
      api.updateAlert(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      toast.success("Alert rule updated");
      closeModal();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => api.deleteAlert(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
      toast.success("Alert rule deleted");
      setDeleteConfirm(null);
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleMutation = useMutation({
    mutationFn: ({ id, active }: { id: string; active: boolean }) =>
      api.updateAlert(id, { active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alerts"] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  function openCreate() {
    setEditingAlert(null);
    setFormData(defaultFormData);
    setShowModal(true);
  }

  function openEdit(alert: AlertRule) {
    setEditingAlert(alert);
    setFormData({
      rule_type: alert.rule_type,
      conditions: JSON.stringify(alert.conditions, null, 2),
      delivery_method: alert.delivery_method,
      delivery_config: JSON.stringify(alert.delivery_config, null, 2),
    });
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingAlert(null);
    setFormData(defaultFormData);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    let conditions: Record<string, unknown>;
    let deliveryConfig: Record<string, unknown>;

    try {
      conditions = JSON.parse(formData.conditions);
    } catch {
      toast.error("Invalid JSON in conditions");
      return;
    }
    try {
      deliveryConfig = JSON.parse(formData.delivery_config);
    } catch {
      toast.error("Invalid JSON in delivery config");
      return;
    }

    const payload = {
      rule_type: formData.rule_type,
      conditions,
      delivery_method: formData.delivery_method,
      delivery_config: deliveryConfig,
    };

    if (editingAlert) {
      updateMutation.mutate({ id: editingAlert.id, data: payload });
    } else {
      createMutation.mutate(payload);
    }
  }

  const isSaving = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="min-h-screen">
      <Navbar />
      <Sidebar />
      <main className="ml-64 pt-16">
        <div className="p-8">
          {/* Header */}
          <div className="flex items-center justify-between mb-8">
            <div>
              <h1 className="text-2xl font-display text-li-text-primary flex items-center gap-3">
                <Bell className="w-6 h-6 text-li-warning" />
                Alert Rules
              </h1>
              <p className="text-sm text-li-text-secondary mt-1">
                Configure automated alerts for data events
              </p>
            </div>
            <button onClick={openCreate} className="li-btn-primary flex items-center gap-2">
              <Plus className="w-4 h-4" />
              Create Rule
            </button>
          </div>

          {/* Table */}
          {isLoading ? (
            <PageLoader />
          ) : (
            <div className="li-card overflow-x-auto p-0">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-li-border">
                    <th className="text-left text-xs font-data font-medium text-li-text-muted uppercase tracking-wider py-3 px-4">
                      Rule Type
                    </th>
                    <th className="text-left text-xs font-data font-medium text-li-text-muted uppercase tracking-wider py-3 px-4">
                      Conditions
                    </th>
                    <th className="text-left text-xs font-data font-medium text-li-text-muted uppercase tracking-wider py-3 px-4">
                      Delivery
                    </th>
                    <th className="text-left text-xs font-data font-medium text-li-text-muted uppercase tracking-wider py-3 px-4">
                      Active
                    </th>
                    <th className="text-left text-xs font-data font-medium text-li-text-muted uppercase tracking-wider py-3 px-4">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-li-border">
                  {alerts?.map((alert) => (
                    <tr
                      key={alert.id}
                      className="hover:bg-li-surface-hover transition-colors"
                    >
                      <td className="py-3 px-4">
                        <span className="li-badge bg-li-primary/20 text-li-primary">
                          {alert.rule_type.replace(/_/g, " ")}
                        </span>
                      </td>
                      <td className="py-3 px-4 text-xs font-data text-li-text-secondary max-w-xs truncate">
                        {summarizeConditions(alert.conditions)}
                      </td>
                      <td className="py-3 px-4 text-sm text-li-text-secondary capitalize">
                        {alert.delivery_method.replace(/_/g, " ")}
                      </td>
                      <td className="py-3 px-4">
                        <button
                          onClick={() =>
                            toggleMutation.mutate({
                              id: alert.id,
                              active: !alert.active,
                            })
                          }
                          className={cn(
                            "relative inline-flex h-6 w-11 items-center rounded-full transition-colors",
                            alert.active ? "bg-li-accent" : "bg-li-border"
                          )}
                        >
                          <span
                            className={cn(
                              "inline-block h-4 w-4 transform rounded-full bg-white transition-transform",
                              alert.active ? "translate-x-6" : "translate-x-1"
                            )}
                          />
                        </button>
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => openEdit(alert)}
                            className="p-1.5 rounded-md hover:bg-li-surface-hover text-li-text-muted hover:text-li-text-primary transition-colors"
                            title="Edit"
                          >
                            <Edit2 className="w-4 h-4" />
                          </button>
                          {deleteConfirm === alert.id ? (
                            <div className="flex items-center gap-1">
                              <button
                                onClick={() => deleteMutation.mutate(alert.id)}
                                className="text-xs text-li-danger hover:underline"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => setDeleteConfirm(null)}
                                className="text-xs text-li-text-muted hover:underline"
                              >
                                Cancel
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setDeleteConfirm(alert.id)}
                              className="p-1.5 rounded-md hover:bg-li-surface-hover text-li-text-muted hover:text-li-danger transition-colors"
                              title="Delete"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              {(!alerts || alerts.length === 0) && (
                <div className="py-12 text-center text-sm text-li-text-muted">
                  <AlertTriangle className="w-8 h-8 mx-auto mb-2 opacity-50" />
                  No alert rules configured yet
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
          <div className="li-card w-full max-w-lg mx-4">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-display text-li-text-primary">
                {editingAlert ? "Edit Alert Rule" : "Create Alert Rule"}
              </h2>
              <button
                onClick={closeModal}
                className="p-1 rounded-md hover:bg-li-surface-hover text-li-text-muted"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Rule Type */}
              <div>
                <label className="block text-sm text-li-text-secondary mb-1.5">
                  Rule Type
                </label>
                <select
                  value={formData.rule_type}
                  onChange={(e) =>
                    setFormData({ ...formData, rule_type: e.target.value })
                  }
                  className="li-input w-full"
                >
                  {RULE_TYPES.map((rt) => (
                    <option key={rt.value} value={rt.value}>
                      {rt.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Conditions */}
              <div>
                <label className="block text-sm text-li-text-secondary mb-1.5">
                  Conditions (JSON)
                </label>
                <textarea
                  value={formData.conditions}
                  onChange={(e) =>
                    setFormData({ ...formData, conditions: e.target.value })
                  }
                  className="li-input w-full font-data text-xs"
                  rows={4}
                  placeholder='{"threshold": 0.8}'
                />
              </div>

              {/* Delivery Method */}
              <div>
                <label className="block text-sm text-li-text-secondary mb-1.5">
                  Delivery Method
                </label>
                <select
                  value={formData.delivery_method}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      delivery_method: e.target.value,
                    })
                  }
                  className="li-input w-full"
                >
                  {DELIVERY_METHODS.map((dm) => (
                    <option key={dm.value} value={dm.value}>
                      {dm.label}
                    </option>
                  ))}
                </select>
              </div>

              {/* Delivery Config */}
              <div>
                <label className="block text-sm text-li-text-secondary mb-1.5">
                  Delivery Config (JSON)
                </label>
                <textarea
                  value={formData.delivery_config}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      delivery_config: e.target.value,
                    })
                  }
                  className="li-input w-full font-data text-xs"
                  rows={3}
                  placeholder='{"email": "user@example.com"}'
                />
              </div>

              {/* Buttons */}
              <div className="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={closeModal}
                  className="li-btn-secondary"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSaving}
                  className="li-btn-primary"
                >
                  {isSaving
                    ? "Saving..."
                    : editingAlert
                    ? "Update Rule"
                    : "Create Rule"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
