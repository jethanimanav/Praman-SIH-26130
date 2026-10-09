"use client";

import { useEffect, useState, useMemo } from "react";
import { AdminLayout } from "@/components/layout/AdminLayout";
import { api } from "@/lib/api";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Users,
  UserCheck,
  Shield,
  Briefcase,
  Search,
  Filter,
  RefreshCw,
  Copy,
  Check,
  AlertOctagon,
  Key,
  Info,
  Calendar,
  Lock,
  ExternalLink,
} from "lucide-react";

export interface AdminUserUI {
  id: number;
  email: string;
  full_name: string;
  role: string;
  is_active: boolean;
  created_at: string;
}

export default function AdminUsersPage() {
  const [users, setUsers] = useState<AdminUserUI[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [refreshing, setRefreshing] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Search & Filters
  const [searchTerm, setSearchTerm] = useState<string>("");
  const [selectedRole, setSelectedRole] = useState<string>("ALL");
  const [selectedStatus, setSelectedStatus] = useState<string>("ALL");

  // Copy feedback state
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  useEffect(() => {
    fetchUsers();
  }, []);

  async function fetchUsers() {
    setLoading(true);
    setError(null);
    try {
      const response = await api.get<AdminUserUI[]>("/api/admin/users");
      setUsers(response.data || []);
    } catch (err: any) {
      console.error("Failed to load users:", err);
      setError(
        err?.response?.data?.detail ||
          err?.message ||
          "Failed to load user accounts from backend server."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }

  function handleRefresh() {
    setRefreshing(true);
    fetchUsers();
  }

  function copyToClipboard(text: string, key: string) {
    navigator.clipboard.writeText(text);
    setCopiedKey(key);
    setTimeout(() => {
      setCopiedKey(null);
    }, 2000);
  }

  // Role counters
  const counters = useMemo(() => {
    let applicants = 0;
    let officers = 0;
    let admins = 0;

    users.forEach((u) => {
      const r = u.role.toLowerCase();
      if (r === "applicant") applicants++;
      else if (r === "officer") officers++;
      else if (r === "admin") admins++;
    });

    return {
      total: users.length,
      applicants,
      officers,
      admins,
    };
  }, [users]);

  // Filtered users
  const filteredUsers = useMemo(() => {
    return users.filter((u) => {
      const search = searchTerm.toLowerCase();
      const matchesSearch =
        searchTerm === "" ||
        u.full_name.toLowerCase().includes(search) ||
        u.email.toLowerCase().includes(search);

      const matchesRole =
        selectedRole === "ALL" || u.role.toLowerCase() === selectedRole.toLowerCase();

      const matchesStatus =
        selectedStatus === "ALL" ||
        (selectedStatus === "ACTIVE" && u.is_active) ||
        (selectedStatus === "INACTIVE" && !u.is_active);

      return matchesSearch && matchesRole && matchesStatus;
    });
  }, [users, searchTerm, selectedRole, selectedStatus]);

  function getRoleBadge(role: string) {
    const r = role.toLowerCase();
    if (r === "admin") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-semibold bg-violet-100 text-violet-800 border border-violet-200">
          <Shield className="h-3 w-3 text-violet-600" />
          Administrator
        </span>
      );
    }
    if (r === "officer") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-semibold bg-blue-100 text-blue-800 border border-blue-200">
          <Briefcase className="h-3 w-3 text-blue-600" />
          Regulatory Officer
        </span>
      );
    }
    if (r === "applicant") {
      return (
        <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded text-xs font-semibold bg-emerald-100 text-emerald-800 border border-emerald-200">
          <UserCheck className="h-3 w-3 text-emerald-600" />
          Applicant
        </span>
      );
    }
    return (
      <span className="px-2.5 py-0.5 rounded text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-200">
        {role}
      </span>
    );
  }

  const demoAccounts = [
    {
      roleTitle: "Industrial Applicant",
      roleKey: "applicant",
      email: "applicant@demo.rop",
      password: "Demo@12345",
      badgeColor: "bg-emerald-100 text-emerald-800 border-emerald-200",
      description:
        "Industrial unit promoter. Files Consent to Establish (CTE), uploads environmental blueprints, tracks statutory SLA timers, and files periodic post-approval returns.",
      actions: ["Consent application filing", "Document repository uploads", "Compliance returns"],
    },
    {
      roleTitle: "Regulatory Scrutiny Officer",
      roleKey: "officer",
      email: "officer@demo.rop",
      password: "Demo@12345",
      badgeColor: "bg-blue-100 text-blue-800 border-blue-200",
      description:
        "Department scrutiny officer (MPCB, DISH, MIDC, Fire Services). Reviews statutory documents, acknowledges escalations, coordinates joint inspections (CIS), and executes step approvals.",
      actions: ["Document scrutiny & queries", "SLA escalation resolution", "Joint inspection reports"],
    },
    {
      roleTitle: "Platform Administrator",
      roleKey: "admin",
      email: "admin@demo.rop",
      password: "Demo@12345",
      badgeColor: "bg-violet-100 text-violet-800 border-violet-200",
      description:
        "Executive oversight authority. Controls time-travel SLA simulation clock, inspects cross-department bottlenecks, and audits tamper-evident security ledgers.",
      actions: ["Executive analytics & BRAP", "Time-travel clock advances", "Security audit ledger"],
    },
  ];

  return (
    <AdminLayout
      title="User & Role Governance"
      subtitle="Manage registered applicants, regulatory officers, and platform administrators"
    >
      <div className="space-y-6 max-w-7xl mx-auto pb-12">
        {/* Top Header Card */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-violet-100 text-violet-700 rounded-lg">
              <Users className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-sm font-semibold text-gray-900">
                  Role-Based Access Control (RBAC) Console
                </span>
                <StatusBadge status="DEMO" />
              </div>
              <p className="text-xs text-gray-500">
                Governance and credential management for Maharashtra Single-Window industrial portals
              </p>
            </div>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefresh}
            disabled={loading || refreshing}
            className="gap-2 text-xs"
          >
            <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
            Refresh Directory
          </Button>
        </div>

        {/* 1. ROLE SUMMARY COUNTERS */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {/* Total Users */}
          <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-gray-500">Total Users</span>
              <div className="p-1.5 bg-gray-100 rounded text-gray-600">
                <Users className="h-4 w-4" />
              </div>
            </div>
            <div className="text-3xl font-bold text-gray-900 mt-2">{counters.total}</div>
            <div className="text-xs text-gray-400 mt-1">Enrolled across platform</div>
          </div>

          {/* Applicants */}
          <div className="bg-white p-4 rounded-xl border border-emerald-200 shadow-sm bg-gradient-to-br from-white to-emerald-50/20">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-emerald-700">Applicants</span>
              <div className="p-1.5 bg-emerald-100 rounded text-emerald-700">
                <UserCheck className="h-4 w-4" />
              </div>
            </div>
            <div className="text-3xl font-bold text-emerald-900 mt-2">{counters.applicants}</div>
            <div className="text-xs text-emerald-600 mt-1">Industrial unit promoters</div>
          </div>

          {/* Officers */}
          <div className="bg-white p-4 rounded-xl border border-blue-200 shadow-sm bg-gradient-to-br from-white to-blue-50/20">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-blue-700">Officers</span>
              <div className="p-1.5 bg-blue-100 rounded text-blue-700">
                <Briefcase className="h-4 w-4" />
              </div>
            </div>
            <div className="text-3xl font-bold text-blue-900 mt-2">{counters.officers}</div>
            <div className="text-xs text-blue-600 mt-1">Regulatory scrutiny staff</div>
          </div>

          {/* Administrators */}
          <div className="bg-white p-4 rounded-xl border border-violet-200 shadow-sm bg-gradient-to-br from-white to-violet-50/20">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold uppercase text-violet-700">Administrators</span>
              <div className="p-1.5 bg-violet-100 rounded text-violet-700">
                <Shield className="h-4 w-4" />
              </div>
            </div>
            <div className="text-3xl font-bold text-violet-900 mt-2">{counters.admins}</div>
            <div className="text-xs text-violet-600 mt-1">System superusers</div>
          </div>
        </div>

        {/* 2. DEMO CREDENTIALS REFERENCE GUIDE FOR SIH EVALUATORS */}
        <div className="bg-gradient-to-r from-violet-50 via-slate-50 to-blue-50 rounded-xl border border-violet-200 p-5 shadow-sm">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <div className="flex items-center gap-2">
              <Key className="h-5 w-5 text-violet-700" />
              <h2 className="font-bold text-sm text-gray-900 uppercase tracking-wide">
                Demo Credentials Reference Guide (SIH Evaluators)
              </h2>
              <span className="text-[10px] font-bold bg-violet-600 text-white px-2 py-0.5 rounded-full">
                READY TO EVALUATE
              </span>
            </div>
            <span className="text-xs text-gray-500">
              Pre-seeded accounts for role transition and functional validation
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {demoAccounts.map((account) => (
              <div
                key={account.roleKey}
                className="bg-white rounded-lg border border-gray-200 p-4 shadow-2xs flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-xs font-bold text-gray-900">{account.roleTitle}</span>
                    <span
                      className={`text-[10px] font-semibold px-2 py-0.5 rounded uppercase border ${account.badgeColor}`}
                    >
                      {account.roleKey}
                    </span>
                  </div>

                  <p className="text-[11px] text-gray-600 leading-relaxed mb-3">
                    {account.description}
                  </p>

                  {/* Credentials Box */}
                  <div className="bg-gray-50 border border-gray-200 rounded p-2.5 space-y-1.5 text-xs font-mono">
                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 text-[10px] uppercase font-sans">Email:</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-gray-800">{account.email}</span>
                        <button
                          onClick={() => copyToClipboard(account.email, `${account.roleKey}-email`)}
                          title="Copy Email"
                          className="text-gray-400 hover:text-gray-700 p-0.5"
                        >
                          {copiedKey === `${account.roleKey}-email` ? (
                            <Check className="h-3 w-3 text-emerald-600" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-gray-400 text-[10px] uppercase font-sans">Password:</span>
                      <div className="flex items-center gap-1.5">
                        <span className="font-medium text-gray-800">{account.password}</span>
                        <button
                          onClick={() => copyToClipboard(account.password, `${account.roleKey}-pass`)}
                          title="Copy Password"
                          className="text-gray-400 hover:text-gray-700 p-0.5"
                        >
                          {copiedKey === `${account.roleKey}-pass` ? (
                            <Check className="h-3 w-3 text-emerald-600" />
                          ) : (
                            <Copy className="h-3 w-3" />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Key evaluation actions */}
                <div className="mt-3 pt-2.5 border-t border-gray-100">
                  <span className="text-[10px] font-semibold text-gray-400 uppercase block mb-1">
                    Key Features to Test:
                  </span>
                  <div className="flex flex-wrap gap-1">
                    {account.actions.map((act, i) => (
                      <span
                        key={i}
                        className="text-[10px] bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded border border-gray-200"
                      >
                        {act}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Error Notice */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-6 text-center">
            <AlertOctagon className="h-8 w-8 text-red-600 mx-auto mb-2" />
            <h3 className="text-sm font-bold text-red-900">User Directory Query Failed</h3>
            <p className="text-xs text-red-700 mt-1 max-w-md mx-auto">{error}</p>
            <Button
              variant="outline"
              size="sm"
              onClick={fetchUsers}
              className="mt-4 border-red-300 text-red-800 hover:bg-red-100"
            >
              Retry
            </Button>
          </div>
        )}

        {/* Loading Spinner */}
        {loading && users.length === 0 && (
          <div className="bg-white rounded-xl border border-gray-200 p-12 text-center shadow-sm">
            <RefreshCw className="h-8 w-8 text-violet-600 animate-spin mx-auto mb-3" />
            <p className="text-sm font-medium text-gray-700">Loading User Governance Registry...</p>
            <p className="text-xs text-gray-400 mt-1">
              Fetching registered applicants and regulatory officers
            </p>
          </div>
        )}

        {/* Search & Filter Toolbar */}
        <div className="bg-white p-4 rounded-xl border border-gray-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
          <div className="relative w-full md:w-80">
            <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search user name or email..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 text-xs h-9"
            />
          </div>

          <div className="flex items-center gap-3 w-full md:w-auto flex-wrap justify-end">
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500 flex items-center gap-1">
                <Filter className="h-3.5 w-3.5" /> Role:
              </span>
              <select
                value={selectedRole}
                onChange={(e) => setSelectedRole(e.target.value)}
                className="text-xs border border-gray-300 rounded-md px-2.5 py-1.5 bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-violet-500"
              >
                <option value="ALL">All Roles</option>
                <option value="applicant">Applicant</option>
                <option value="officer">Officer</option>
                <option value="admin">Administrator</option>
              </select>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Status:</span>
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="text-xs border border-gray-300 rounded-md px-2.5 py-1.5 bg-white text-gray-800 focus:outline-none focus:ring-1 focus:ring-violet-500"
              >
                <option value="ALL">All Status</option>
                <option value="ACTIVE">Active Only</option>
                <option value="INACTIVE">Inactive Only</option>
              </select>
            </div>

            {(searchTerm || selectedRole !== "ALL" || selectedStatus !== "ALL") && (
              <Button
                variant="ghost"
                size="xs"
                onClick={() => {
                  setSearchTerm("");
                  setSelectedRole("ALL");
                  setSelectedStatus("ALL");
                }}
                className="text-xs text-gray-500 hover:text-gray-900"
              >
                Reset
              </Button>
            )}
          </div>
        </div>

        {/* 3. USERS TABLE */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
          <div className="p-4 border-b border-gray-200 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900 text-sm flex items-center gap-2">
                <Users className="h-4 w-4 text-violet-700" />
                Registered Accounts Directory ({filteredUsers.length})
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Regulated industrial promoters and Maharashtra single-window officers
              </p>
            </div>
            <div className="text-xs text-gray-400">
              Showing {filteredUsers.length} of {users.length} accounts
            </div>
          </div>

          {filteredUsers.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <Users className="h-10 w-10 text-gray-400 mx-auto mb-2" />
              <p className="text-sm font-semibold text-gray-800">No Users Found</p>
              <p className="text-xs text-gray-500 mt-1 max-w-md mx-auto">
                {users.length === 0
                  ? "No user accounts are registered in the database."
                  : "No registered accounts match your selected search criteria."}
              </p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-gray-50 text-gray-500 font-semibold uppercase tracking-wider border-b border-gray-200">
                  <tr>
                    <th className="py-3 px-4">Full Name</th>
                    <th className="py-3 px-4">Email Address</th>
                    <th className="py-3 px-4 text-center">Role</th>
                    <th className="py-3 px-4 text-center">Status</th>
                    <th className="py-3 px-4 text-right">Created At</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {filteredUsers.map((user) => {
                    const formattedDate = user.created_at
                      ? new Date(user.created_at).toLocaleDateString("en-IN", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                        })
                      : "—";

                    // Initial letters for avatar
                    const initials = user.full_name
                      .split(" ")
                      .map((n) => n[0])
                      .join("")
                      .substring(0, 2)
                      .toUpperCase();

                    return (
                      <tr key={user.id} className="hover:bg-gray-50/70 transition-colors">
                        {/* Full Name */}
                        <td className="py-3.5 px-4 font-semibold text-gray-900">
                          <div className="flex items-center gap-2.5">
                            <div className="w-7 h-7 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center font-bold text-[11px] flex-shrink-0">
                              {initials || "U"}
                            </div>
                            <div>
                              <div>{user.full_name}</div>
                              <div className="text-[10px] text-gray-400 font-normal">User #{user.id}</div>
                            </div>
                          </div>
                        </td>

                        {/* Email Address */}
                        <td className="py-3.5 px-4 font-mono text-gray-700">
                          {user.email}
                        </td>

                        {/* Role */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          {getRoleBadge(user.role)}
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4 text-center whitespace-nowrap">
                          {user.is_active ? (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                              Active
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1.5 px-2 py-0.5 rounded text-[11px] font-semibold bg-gray-100 text-gray-600 border border-gray-200">
                              <span className="w-1.5 h-1.5 rounded-full bg-gray-400"></span>
                              Inactive
                            </span>
                          )}
                        </td>

                        {/* Created At */}
                        <td className="py-3.5 px-4 text-right text-gray-600 font-mono">
                          {formattedDate}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}
