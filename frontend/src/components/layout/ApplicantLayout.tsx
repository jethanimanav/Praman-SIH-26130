"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { ReactNode, useEffect, useState } from "react";
import { getSession, clearSession, User } from "@/lib/auth";
import {
  getBusinesses,
  BusinessItem,
  getProjects,
  ProjectItem,
  getNotifications,
  getUnreadNotificationCount,
  markNotificationRead,
  markAllNotificationsRead,
  NotificationItemUI,
} from "@/lib/api";
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
  ChevronDown,
  Menu,
  X,
  Factory,
  Plus,
  Check,
  CheckCheck,
  ExternalLink,
  AlertTriangle,
  Info,
  RefreshCw,
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
  const [projects, setProjects] = useState<ProjectItem[]>([]);
  const [activeProject, setActiveProject] = useState<ProjectItem | null>(null);
  const [projectSwitcherOpen, setProjectSwitcherOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Unified Notifications State
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notifications, setNotifications] = useState<NotificationItemUI[]>([]);
  const [loadingNotifications, setLoadingNotifications] = useState(false);

  useEffect(() => {
    const session = getSession();
    if (!session || (session.role !== "applicant" && session.role !== "admin")) {
      router.push("/login");
    } else {
      setUser(session);
      loadProjectsAndBusiness();
      loadUnreadCount();
    }
  }, [router]);

  function loadUnreadCount() {
    getUnreadNotificationCount()
      .then((res) => setUnreadCount(res.unread_count))
      .catch(() => {});
  }

  function handleToggleNotifications() {
    const next = !notificationsOpen;
    setNotificationsOpen(next);
    if (next) {
      setLoadingNotifications(true);
      getNotifications(false)
        .then((data) => {
          setNotifications(data.items);
          setUnreadCount(data.unread_count);
        })
        .catch(() => {})
        .finally(() => setLoadingNotifications(false));
    }
  }

  async function handleMarkAllRead() {
    try {
      await markAllNotificationsRead();
      setUnreadCount(0);
      setNotifications((prev) =>
        prev.map((n) => ({ ...n, is_read: true, read_at: new Date().toISOString() }))
      );
    } catch {
      // ignore
    }
  }

  async function handleNotificationClick(item: NotificationItemUI) {
    if (!item.is_read) {
      markNotificationRead(item.id).catch(() => {});
      setUnreadCount((prev) => Math.max(0, prev - 1));
      setNotifications((prev) =>
        prev.map((n) => (n.id === item.id ? { ...n, is_read: true } : n))
      );
    }
    setNotificationsOpen(false);
    if (item.action_url) {
      router.push(item.action_url);
    }
  }

  function loadProjectsAndBusiness() {
    Promise.all([
      getBusinesses().catch(() => []),
      getProjects().catch(() => []),
    ]).then(([bizs, projs]) => {
      if (bizs.length > 0) setBusiness(bizs[0]);
      setProjects(projs);

      const storedId = typeof window !== "undefined" ? localStorage.getItem("rop_active_project_id") : null;
      const matched = storedId ? projs.find((p) => p.id === Number(storedId)) : null;
      const selected = matched || (projs.length > 0 ? projs[0] : null);
      setActiveProject(selected);
      if (selected && typeof window !== "undefined") {
        localStorage.setItem("rop_active_project_id", String(selected.id));
      }
    });
  }

  useEffect(() => {
    function handleProjectChanged(e: any) {
      if (e.detail?.project) {
        setActiveProject(e.detail.project);
      } else {
        loadProjectsAndBusiness();
      }
    }
    window.addEventListener("project-switched", handleProjectChanged);
    window.addEventListener("project-updated", handleProjectChanged);
    return () => {
      window.removeEventListener("project-switched", handleProjectChanged);
      window.removeEventListener("project-updated", handleProjectChanged);
    };
  }, []);

  function handleSelectProject(proj: ProjectItem) {
    setActiveProject(proj);
    setProjectSwitcherOpen(false);
    if (typeof window !== "undefined") {
      localStorage.setItem("rop_active_project_id", String(proj.id));
      window.dispatchEvent(
        new CustomEvent("project-switched", { detail: { project: proj, projectId: proj.id } })
      );
    }
  }

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

        {/* Active Establishment & Facility Selector */}
        <div className="p-3 border-t border-gray-200 bg-gray-50/70 space-y-2 relative">
          {/* Active Facility Card with Dropdown Switcher */}
          <div className="relative">
            <button
              onClick={() => setProjectSwitcherOpen(!projectSwitcherOpen)}
              className="w-full text-left p-2 rounded-lg bg-white border border-gray-200 hover:border-blue-400 hover:shadow-xs transition-all flex items-center justify-between group"
            >
              <div className="flex items-center gap-2 min-w-0">
                <div className="w-6 h-6 rounded bg-blue-50 flex items-center justify-center shrink-0 border border-blue-100">
                  <Factory className="h-3.5 w-3.5 text-blue-700" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="text-[11px] font-bold text-gray-900 truncate group-hover:text-blue-700">
                    {activeProject ? activeProject.name : business?.name || "Apex Precision Auto Components"}
                  </div>
                  <div className="text-[10px] text-gray-500 truncate flex items-center gap-1">
                    <span>{activeProject?.district || "Pune"}, Maharashtra</span>
                    {activeProject?.pollution_category && (
                      <span className="text-[9px] px-1 py-0.2 bg-gray-100 rounded text-gray-600 font-medium">
                        {activeProject.pollution_category}
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <ChevronDown className="h-3.5 w-3.5 text-gray-400 shrink-0 ml-1 group-hover:text-blue-700 transition-colors" />
            </button>

            {/* Dropdown Menu for Switching Projects */}
            {projectSwitcherOpen && (
              <div className="absolute bottom-full left-0 mb-1 w-full bg-white rounded-lg border border-gray-200 shadow-lg z-50 py-1 overflow-hidden">
                <div className="px-3 py-1.5 border-b border-gray-100 flex items-center justify-between text-[11px] font-bold text-gray-700 bg-gray-50/60">
                  <span>Facilities / Projects ({projects.length})</span>
                  <Link
                    href="/applicant/project?action=new"
                    onClick={() => setProjectSwitcherOpen(false)}
                    className="text-[10px] text-blue-700 hover:underline flex items-center gap-0.5"
                  >
                    <Plus className="h-3 w-3" /> New
                  </Link>
                </div>
                <div className="max-h-48 overflow-y-auto py-1">
                  {projects.map((p) => {
                    const isSelected = activeProject?.id === p.id;
                    return (
                      <button
                        key={p.id}
                        onClick={() => handleSelectProject(p)}
                        className={`w-full text-left px-3 py-1.5 text-xs flex items-center justify-between hover:bg-blue-50/60 transition-colors ${
                          isSelected ? "bg-blue-50/80 font-bold text-blue-800" : "text-gray-700"
                        }`}
                      >
                        <div className="min-w-0 flex-1 mr-2">
                          <div className="truncate text-[11px]">{p.name}</div>
                          <div className="text-[10px] text-gray-400 truncate">
                            {p.district || "Maharashtra"} • {p.project_type || "Setup"}
                          </div>
                        </div>
                        {isSelected && <Check className="h-3.5 w-3.5 text-blue-700 shrink-0" />}
                      </button>
                    );
                  })}
                  {projects.length === 0 && (
                    <div className="px-3 py-2 text-[11px] text-gray-400 text-center">
                      No facilities yet
                    </div>
                  )}
                </div>
                <div className="p-1 border-t border-gray-100 bg-gray-50/50">
                  <Link
                    href="/applicant/project"
                    onClick={() => setProjectSwitcherOpen(false)}
                    className="block text-center py-1 text-[11px] font-medium text-blue-700 hover:bg-blue-100/50 rounded"
                  >
                    Manage Facility Profiles &rarr;
                  </Link>
                </div>
              </div>
            )}
          </div>

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

          {/* Search, Active Facility Pill, Notifications & Demo Badge */}
          <div className="flex items-center gap-3">
            {/* Active Facility Pill */}
            {activeProject && (
              <div className="hidden lg:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-slate-100 border border-slate-200 text-slate-700 text-[11px]">
                <Factory className="h-3 w-3 text-slate-500" />
                <span className="font-semibold text-slate-900 truncate max-w-[140px]">{activeProject.name}</span>
                <span className="text-slate-400">•</span>
                <span className="text-slate-500">{activeProject.district || "Maharashtra"}</span>
              </div>
            )}

            {/* Contextual search input */}
            <div className="hidden md:flex items-center relative w-60 lg:w-72">
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

            {/* Interactive Notification Bell & Dropdown Centre */}
            <div className="relative">
              <button
                type="button"
                title="Notifications"
                onClick={handleToggleNotifications}
                className="relative p-1.5 rounded-lg text-gray-500 hover:text-gray-800 hover:bg-gray-100 transition-colors"
              >
                <Bell className="h-4 w-4" />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 min-w-[14px] h-3.5 px-1 rounded-full bg-rose-600 text-white font-mono text-[9px] font-bold flex items-center justify-center ring-2 ring-white">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </button>

              {notificationsOpen && (
                <>
                  <div
                    className="fixed inset-0 z-40"
                    onClick={() => setNotificationsOpen(false)}
                  />
                  <div className="absolute right-0 top-full mt-2 w-80 sm:w-96 bg-white border border-gray-200 rounded-xl shadow-xl z-50 overflow-hidden text-xs">
                    <div className="px-4 py-3 bg-gray-50/80 border-b border-gray-200 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="font-bold text-gray-900 text-sm">Notifications</span>
                        {unreadCount > 0 ? (
                          <span className="px-1.5 py-0.2 rounded-full bg-rose-100 text-rose-800 font-bold text-[10px]">
                            {unreadCount} unread
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.2 rounded-full bg-gray-100 text-gray-600 font-medium text-[10px]">
                            All caught up
                          </span>
                        )}
                      </div>
                      <div className="flex items-center gap-1">
                        {unreadCount > 0 && (
                          <button
                            type="button"
                            onClick={handleMarkAllRead}
                            className="text-[11px] font-semibold text-blue-700 hover:text-blue-900 flex items-center gap-1 hover:underline p-1"
                          >
                            <CheckCheck className="h-3 w-3" /> Mark all read
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => setNotificationsOpen(false)}
                          className="text-gray-400 hover:text-gray-600 p-1"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>

                    <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
                      {loadingNotifications ? (
                        <div className="p-6 text-center text-gray-400">
                          <RefreshCw className="h-4 w-4 animate-spin mx-auto mb-1.5 text-blue-600" />
                          Loading notifications...
                        </div>
                      ) : notifications.length === 0 ? (
                        <div className="p-6 text-center text-gray-500 space-y-1">
                          <Bell className="h-6 w-6 text-gray-300 mx-auto" />
                          <div className="font-semibold text-gray-700">No notifications yet</div>
                          <div className="text-[11px] text-gray-400">
                            Updates regarding applications, queries, and statutory deadlines will appear here.
                          </div>
                        </div>
                      ) : (
                        notifications.map((item) => {
                          const isUnread = !item.is_read;
                          const severityBadge =
                            item.severity === "URGENT"
                              ? "bg-rose-50 text-rose-700 border-rose-200"
                              : item.severity === "WARNING"
                              ? "bg-amber-50 text-amber-700 border-amber-200"
                              : item.severity === "SUCCESS"
                              ? "bg-emerald-50 text-emerald-700 border-emerald-200"
                              : "bg-blue-50 text-blue-700 border-blue-200";

                          return (
                            <div
                              key={item.id}
                              onClick={() => handleNotificationClick(item)}
                              className={`p-3 transition-colors cursor-pointer hover:bg-gray-50 flex items-start gap-2.5 ${
                                isUnread ? "bg-blue-50/20" : ""
                              }`}
                            >
                              <div className="mt-0.5">
                                {isUnread ? (
                                  <span className="w-2 h-2 rounded-full bg-blue-600 block mt-1" />
                                ) : (
                                  <span className="w-2 h-2 rounded-full bg-transparent block mt-1" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0 space-y-1">
                                <div className="flex items-center justify-between gap-2">
                                  <span className="font-bold text-gray-900 truncate">
                                    {item.title}
                                  </span>
                                  <span
                                    className={`text-[9px] px-1.5 py-0.2 rounded border font-bold uppercase shrink-0 ${severityBadge}`}
                                  >
                                    {item.severity}
                                  </span>
                                </div>
                                <p className="text-[11px] text-gray-600 line-clamp-2 leading-relaxed">
                                  {item.message}
                                </p>
                                <div className="flex items-center justify-between text-[10px] text-gray-400 pt-0.5">
                                  <span>{new Date(item.created_at).toLocaleDateString()}</span>
                                  {item.action_url && (
                                    <span className="text-blue-700 font-semibold flex items-center gap-0.5">
                                      View <ExternalLink className="h-2.5 w-2.5" />
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>

                    <div className="p-2 border-t border-gray-100 bg-gray-50/60 text-center text-[10px] text-gray-400">
                      Workflow Event Notifications • DEMO
                    </div>
                  </div>
                </>
              )}
            </div>

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

