"use client";

import Link from "next/link";
import { Navbar } from "@/components/Navbar";
import { Sidebar } from "@/components/Sidebar";
import { Users, FileText, Shield, Activity } from "lucide-react";

const adminLinks = [
  {
    href: "/admin/users",
    label: "User Management",
    description: "Manage users, roles, and permissions",
    icon: Users,
    color: "text-li-primary bg-li-primary/10",
  },
  {
    href: "/admin/audit",
    label: "Audit Log",
    description: "View system activity and audit trail",
    icon: FileText,
    color: "text-li-accent bg-li-accent/10",
  },
  {
    href: "/admin/compliance",
    label: "Compliance",
    description: "SOC 2 controls, GDPR readiness, and data inventory",
    icon: Shield,
    color: "text-li-warning bg-li-warning/10",
  },
];

export default function AdminPage() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <Sidebar />
      <main className="ml-64 pt-16">
        <div className="p-8">
          <div className="mb-8">
            <h1 className="text-2xl font-display text-li-text-primary">
              Administration
            </h1>
            <p className="text-sm text-li-text-secondary mt-1">
              System management and compliance controls
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {adminLinks.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="li-card group cursor-pointer"
              >
                <div
                  className={`w-12 h-12 rounded-xl ${item.color} flex items-center justify-center mb-4`}
                >
                  <item.icon className="w-6 h-6" />
                </div>
                <h3 className="text-base font-display text-li-text-primary group-hover:text-li-primary transition-colors mb-2">
                  {item.label}
                </h3>
                <p className="text-sm text-li-text-secondary">
                  {item.description}
                </p>
              </Link>
            ))}
          </div>
        </div>
      </main>
    </div>
  );
}
