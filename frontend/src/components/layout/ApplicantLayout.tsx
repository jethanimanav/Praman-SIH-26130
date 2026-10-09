"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { getSession, clearSession, User } from "@/lib/auth";
import { getBusinesses, BusinessItem } from "@/lib/api";
import {
  Building2,
  LayoutDashboard,
  Search,
  FolderOpen,
  FileText,
  CalendarCheck2,
  CalendarDays,
  HelpCircle,
  LogOut,
  Bell,
  ChevronRight,
  Menu,
  X,
  Factory,
} from "lucide-react";

interface BreadcrumbItem {
  label: string;
  href?: string;
}

interface ApplicantLayoutProps {
  children: ReactNode;
  title?: string;
  subtitle?: string;
  breadcrumbs?: BreadcrumbItem[];
}

export function ApplicantLayout({
  children,
  title,
  subtitle,
  breadcrumbs,
}: ApplicantLayoutProps) {
  const pathname = usePathname();
  const router = useRouter();
  const [user, setUser] = useState<User | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [business, setBusiness] = useState<BusinessItem | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    const session = getSession();
    if (!session || (session.role !== "applicant" && session.role !== "admin")) {
      router.push("/login");
    } else {
      setUser(session);
      getBusinesses()
        .then((bizs) => {
          if (bizs.length > 0) setBusiness(bizs[0]);
        })
        .catch(() => {});
    }
  }, [router]);

  function handleLogout() {
    clearSession();
    router.push("/login");
  }

  // Derive default breadcrumbs if none provided
  const derivedBreadcrumbs: BreadcrumbItem[] = breadcrumbs || (() => {
    if (pathname === "/applicant/dashboard") return [{ label: "Home" }];
    if (pathname.startsWith("/applicant/project"))
      return [{ label: "Home", href: "/applicant/dashboard" }, { label: "My Project" }];
    if (pathname.startsWith("/applicant/approvals"))
      return [{ label: "Home", href: "/applicant/dashboard" }, { label: "Find Approvals" }];
    if (pathname.startsWith("/applicant/applications"))
      return [{ label: "Home", href: "/applicant/dashboard" }, { label: "My Applications" }];
    if (pathname.startsWith("/applicant/workflow"))
      return [
        { label: "My Applications", href: "/applicant/applications" },
        { label: "Application Workspace" },
      ];
    if (pathname.startsWith("/applicant/documents"))
      return [{ label: "Home", href: "/applicant/dashboard" }, { label: "Documents" }];
    if (pathname.startsWith("/applicant/inspections"))
      return [{ label: "Home", href: "/applicant/dashboard" }, { label: "Inspections" }];
    if (pathname.startsWith("/applicant/compliance"))
      return [{ label: "Home", href: "/applicant/dashboard" }, { label: "Compliance" }];
    if (pathname.startsWith("/applicant/help"))
      return [{ label: "Home", href: "/applicant/dashboard" }, { label: "Help & Support" }];
    return [{ label: "Home", href: "/applicant/dashboard" }];
  })();

  const navItems = [
    { href: "/applicant/dashboard", label: "Home", icon: LayoutDashboard },
    { href: "/applicant/project", label: "My Project", icon: Building2 },
    { href: "/applicant/approvals", label: "Find Approvals", icon: Search },
    { href: "/applicant/applications", label: "My Applications", icon: FolderOpen },
    { href: "/applicant/documents", label: "Documents", icon: FileText },
    { href: "/applicant/inspections", label: "Inspections", icon: CalendarDays },
    { href: "/applicant/compliance", label: "Compliance", icon: CalendarCheck2 },
    { href: "/applicant/help", label: "Help", icon: HelpCircle },
  ];

  if (!user) return null;

  const userInitials = user.full_name
    ? user.full_name
        .split(" ")
        .map((n) => n[0])
        .slice(0, 2)
        .join("")
        .toUpperCase()
    : "MJ";

  return (
    <div className="min-h-screen bg-slate-50 flex font-sans text-gray-900">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 bg-black/40 z-40 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Desktop Persistent Sidebar (Screen 2-10 Reference) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 w-60 bg-white border-r border-gray-200 flex flex-col transform transition-transform lg:translate-x-0 lg:static lg:flex ${
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        }`}
      >
        {/* Logo / Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <Link href="/applicant/dashboard" className="flex items-center gap-2.5">
            <div className="bg-blue-700 p-1.5 rounded-md text-white shadow-xs">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <div className="text-base font-extrabold tracking-tight text-gray-900 leading-tight">
                PRAMAN
              </div>
              <div className="text-[10px] text-gray-500 font-medium">
                Maharashtra Industrial Approvals
              </div>
            </div>
          </Link>
          <button
            className="lg:hidden text-gray-400 hover:text-gray-600 p-1"
            onClick={() => setSidebarOpen(false)}
            aria-label="Close menu"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Primary Navigation List */}
        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {navItems.map(({ href, label, icon: Icon }) => {
            const isActive =
              pathname === href ||
              (href !== "/applicant/dashboard" && pathname.startsWith(href));

            return (
              <Link
                key={href}
                href={href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg text-xs font-semibold transition-colors ${
                  isActive
                    ? "bg-blue-50 text-blue-800 shadow-2xs font-bold"
                    : "text-gray-600 hover:bg-gray-100/80 hover:text-gray-900"
                }`}
              >
                <Icon
                  className={`h-4 w-4 shrink-0 ${
                    isActive ? "text-blue-700" : "text-gray-400"
                  }`}
                />
                <span>{label}</span>
                {isActive && (
                  <span className="ml-auto w-1.5 h-1.5 rounded-full bg-blue-700" />
                )}
              </Link>
            );
          })}
        </nav>

        {/* Active Establishment & User Footer */}
        <div className="p-3 border-t border-gray-200 bg-gray-50/70 space-y-2">
          {/* Active Establishment snippet */}
          <Link
            href="/applicant/project"
            className="block p-2 rounded-lg bg-white border border-gray-200 hover:border-gray-300 transition-colors"
          >
            <div className="flex items-center gap-2">
              <div className="w-5 h-5 rounded bg-blue-50 flex items-center justify-center shrink-0">
                <Factory className="h-3 w-3 text-blue-700" />
              </div>
              <div className="min-w-0 flex-1">
                <div className="text-[11px] font-bold text-gray-900 truncate">
                  {business?.name || "Apex Precision Auto Components"}
                </div>
                <div className="text-[10px] text-gray-500 truncate">
                  Pune, Maharashtra
                </div>
              </div>
            </div>
          </Link>

          {/* User Profile Card */}
          <div className="flex items-center justify-between p-2 rounded-lg bg-white border border-gray-200">
            <div className="flex items-center gap-2 min-w-0">
              <div className="w-7 h-7 rounded-full bg-slate-900 text-white font-bold text-[11px] flex items-center justify-center shrink-0">
                {userInitials}
              </div>
              <div className="min-w-0">
                <div className="text-xs font-bold text-gray-900 truncate">
                  {user.full_name}
                </div>
                <div className="text-[10px] text-gray-500 capitalize">Applicant</div>
              </div>
            </div>
            <button
              onClick={handleLogout}
              title="Sign Out"
              className="text-gray-400 hover:text-rose-600 p-1 transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </aside>

      {/* Main Workspace Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Header (Compact, Screen 2-10 Reference) */}
        <header className="bg-white border-b border-gray-200 px-4 sm:px-6 py-2.5 flex items-center justify-between sticky top-0 z-30">
          <div className="flex items-center gap-3 min-w-0">
            <button
              className="lg:hidden text-gray-500 hover:text-gray-700 p-1"
              onClick={() => setSidebarOpen(true)}
              aria-label="Open menu"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Breadcrumb Navigation */}
            <nav className="flex items-center gap-1.5 text-xs text-gray-500 truncate">
              {derivedBreadcrumbs.map((crumb, idx) => {
                const isLast = idx === derivedBreadcrumbs.length - 1;
                return (
                  <span key={idx} className="flex items-center gap-1.5 truncate">
                    {idx > 0 && <ChevronRight className="h-3 w-3 text-gray-400 shrink-0" />}
                    {crumb.href && !isLast ? (
                      <Link
                        href={crumb.href}
                        className="hover:text-blue-700 hover:underline transition-colors"
                      >
                        {crumb.label}
                      </Link>
                    ) : (
                      <span className={isLast ? "font-semibold text-gray-900" : ""}>
                        {crumb.label}
                      </span>
                    )}
                  </span>
                );
              })}
            </nav>
          </div>

          {/* Search, Notifications & Demo Badge */}
          <div className="flex items-center gap-3">
            {/* Contextual search input */}
            <div className="hidden md:flex items-center relative w-64 lg:w-80">
              <Search className="absolute left-2.5 h-3.5 w-3.5 text-gray-400" />
              <input
                type="text"
                placeholder="Search approvals, applications, documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && searchQuery.trim()) {
                    router.push(
                      `/applicant/approvals?q=${encodeURIComponent(searchQuery.trim())}`
                    );
                  }
                }}
                className="w-full text-xs pl-8 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-blue-600 focus:bg-white transition-colors"
              />
            </div>

            {/* Notification bell with indicator */}
            <button
              title="Notifications"
              className="relative p-1.5 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors"
            >
              <Bell className="h-4 w-4" />
              <span className="absolute top-1 right-1 w-2 h-2 rounded-full bg-rose-600 ring-2 ring-white" />
            </button>

            {/* Environment Badge */}
            <span className="hidden sm:inline-flex items-center text-[10px] font-semibold text-amber-800 bg-amber-50 border border-amber-200 rounded px-2 py-0.5">
              Demonstration Environment
            </span>

            {/* Profile Avatar */}
            <div className="w-7 h-7 rounded-full bg-slate-900 text-white font-bold text-xs flex items-center justify-center shrink-0">
              {userInitials}
            </div>
          </div>
        </header>

        {/* Page Content Viewport */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8 max-w-7xl mx-auto w-full space-y-6">
          {(title || subtitle) && (
            <div className="pb-1 border-b border-gray-200/60">
              {title && (
                <h1 className="text-xl sm:text-2xl font-extrabold text-gray-900 tracking-tight">
                  {title}
                </h1>
              )}
              {subtitle && (
                <p className="text-xs sm:text-sm text-gray-500 mt-1">{subtitle}</p>
              )}
            </div>
          )}
          {children}
        </main>
      </div>
    </div>
  );
}

