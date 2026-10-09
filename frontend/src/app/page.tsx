"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { getSession } from "@/lib/auth";
import {
  Building2,
  ArrowRight,
  Search,
  FileText,
  Clock,
  Shield,
  CheckCircle2,
  CalendarCheck2,
  AlertTriangle,
  FolderOpen,
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function LandingPage() {
  const router = useRouter();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    const session = getSession();
    if (session) {
      const path =
        session.role === "officer"
          ? "/officer/dashboard"
          : session.role === "admin"
          ? "/admin/dashboard"
          : "/applicant/dashboard";
      router.replace(path);
    }
  }, [router]);

  if (!mounted) return null;

  return (
    <div className="min-h-screen bg-white text-gray-900 flex flex-col font-sans">
      {/* Top Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-700 p-2 rounded text-white">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <div className="text-base font-bold text-gray-900 tracking-tight leading-tight">
                PRAMAN
              </div>
              <div className="text-xs text-gray-500">Industrial Approvals Portal</div>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline-flex items-center text-xs text-blue-700 bg-blue-50 border border-blue-200 rounded-full px-2.5 py-0.5 font-medium">
              Maharashtra Industrial Single-Window
            </span>
            <Link href="/login">
              <Button variant="outline" size="sm" className="text-xs">
                Sign In
              </Button>
            </Link>
            <Link href="/login">
              <Button size="sm" className="bg-blue-700 hover:bg-blue-800 text-white text-xs">
                Start a Project
              </Button>
            </Link>
          </div>
        </div>
      </header>

      {/* Hero Section — Pass the 5-Second Test */}
      <section className="bg-slate-50 border-b border-gray-200 py-10 sm:py-14">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-12 items-center">
            {/* Left Column: Clear Core Positioning & CTAs */}
            <div className="lg:col-span-7 space-y-5 text-left">
              {/* Eyebrow */}
              <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded bg-blue-50 text-blue-900 border border-blue-200 text-xs font-semibold uppercase tracking-wider">
                <Shield className="h-3.5 w-3.5 text-blue-700 shrink-0" />
                Maharashtra Industrial Single-Window Workspace
              </div>

              {/* Main Headline */}
              <h1 className="text-3xl sm:text-4xl lg:text-[2.75rem] font-extrabold text-gray-900 tracking-tight leading-[1.15]">
                Industrial approvals, <span className="text-blue-800">made simpler.</span>
              </h1>

              {/* Supporting Text */}
              <p className="text-base sm:text-lg text-gray-600 leading-relaxed max-w-2xl">
                Find the approvals your business may need, manage applications and documents, track progress, and stay on top of compliance — all in one place.
              </p>

              {/* Target Audience Notice */}
              <div className="flex items-center gap-2 text-xs text-gray-500 font-medium pt-0.5">
                <span className="w-1.5 h-1.5 rounded-full bg-blue-700 shrink-0" />
                <span>For businesses setting up, expanding, or operating industrial projects in Maharashtra.</span>
              </div>

              {/* Primary & Secondary CTAs */}
              <div className="pt-2 flex flex-wrap items-center gap-3">
                <Link href="/login?redirect=/applicant/project">
                  <Button size="lg" className="bg-blue-700 hover:bg-blue-800 text-white font-semibold px-6 text-sm h-11 rounded shadow-none">
                    Start a Project <ArrowRight className="ml-2 h-4 w-4" />
                  </Button>
                </Link>
                <Link href="/login?redirect=/applicant/approvals">
                  <Button size="lg" variant="outline" className="border-gray-300 bg-white text-gray-800 hover:bg-gray-100 font-semibold px-5 text-sm h-11 rounded shadow-none">
                    <Search className="mr-2 h-4 w-4 text-gray-500" />
                    Find My Approvals
                  </Button>
                </Link>
              </div>

              {/* Simple Visual Workflow Diagram */}
              <div className="pt-4 border-t border-gray-200/80">
                <div className="text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2">
                  How PRAMAN Works
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  <div className="bg-white border border-gray-200 rounded p-2.5">
                    <div className="text-[10px] font-mono font-bold text-blue-700">01</div>
                    <div className="text-xs font-semibold text-gray-900 mt-0.5">Tell us about your business</div>
                  </div>
                  <div className="bg-white border border-gray-200 rounded p-2.5">
                    <div className="text-[10px] font-mono font-bold text-blue-700">02</div>
                    <div className="text-xs font-semibold text-gray-900 mt-0.5">Find your approvals</div>
                  </div>
                  <div className="bg-white border border-gray-200 rounded p-2.5">
                    <div className="text-[10px] font-mono font-bold text-blue-700">03</div>
                    <div className="text-xs font-semibold text-gray-900 mt-0.5">Manage applications</div>
                  </div>
                  <div className="bg-white border border-gray-200 rounded p-2.5">
                    <div className="text-[10px] font-mono font-bold text-blue-700">04</div>
                    <div className="text-xs font-semibold text-gray-900 mt-0.5">Stay compliant</div>
                  </div>
                </div>
              </div>
            </div>

            {/* Right Column: Restrained Real Product Preview Panel */}
            <div className="lg:col-span-5">
              <div className="bg-white rounded border border-gray-200 shadow-sm overflow-hidden">
                {/* Panel Header */}
                <div className="bg-slate-100/80 border-b border-gray-200 px-4 py-2.5 flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-2.5 h-2.5 rounded-full bg-emerald-500" />
                    <span className="text-xs font-semibold text-gray-700 uppercase tracking-wider">Your Project Workspace</span>
                  </div>
                  <span className="text-[11px] font-mono text-gray-500">MH-PUN-2026-001</span>
                </div>

                {/* Panel Content */}
                <div className="p-5 space-y-4">
                  <div>
                    <div className="text-xs text-gray-500 font-medium">Active Establishment</div>
                    <div className="text-base font-bold text-gray-900">
                      Apex Precision Automotive Components
                    </div>
                    <div className="text-xs text-gray-500 mt-0.5">
                      Chakan MIDC Phase II, Pune • Automotive Sector
                    </div>
                  </div>

                  {/* Progress Meter */}
                  <div className="bg-slate-50 border border-slate-200 rounded p-3 space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold text-gray-800">Clearance Roadmap</span>
                      <span className="font-mono font-bold text-blue-800">3 of 7 Approved (43%)</span>
                    </div>
                    <div className="w-full bg-gray-200 h-2 rounded overflow-hidden">
                      <div className="bg-blue-700 h-full rounded" style={{ width: "43%" }} />
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-gray-500 pt-0.5">
                      <span>4 clearances in progress</span>
                      <span>SLA: 28 days remaining</span>
                    </div>
                  </div>

                  {/* Attention Alert */}
                  <div className="bg-amber-50 border border-amber-200 rounded p-3 flex items-start gap-2.5">
                    <AlertTriangle className="h-4 w-4 text-amber-700 shrink-0 mt-0.5" />
                    <div className="text-xs">
                      <div className="font-bold text-amber-900">1 action requires your attention</div>
                      <div className="text-amber-800 mt-0.5">
                        MPCB Consent to Establish: Awaiting clarification on hazardous waste manifest.
                      </div>
                    </div>
                  </div>

                  {/* Direct Link */}
                  <div className="pt-1">
                    <Link href="/login?redirect=/applicant/dashboard">
                      <Button variant="outline" className="w-full justify-between text-xs h-9 font-semibold border-gray-300 text-blue-900 hover:bg-slate-50">
                        <span>View project dashboard</span>
                        <ArrowRight className="h-3.5 w-3.5 text-blue-700" />
                      </Button>
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 3-Step Simple Explanation */}
      <section className="py-12 bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-8">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
              How the Clearance Process Works
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Three structured stages to establish and operate an industrial unit
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* Step 1 */}
            <div className="p-5 rounded border border-gray-200 bg-white flex flex-col items-start text-left">
              <div className="w-7 h-7 rounded bg-blue-700 text-white font-bold flex items-center justify-center text-xs mb-3 font-mono">
                1
              </div>
              <h3 className="text-sm font-bold text-gray-900 mb-1">
                Establishment Intake
              </h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                Provide specifications regarding industry sector, location, power demand, fuel usage, and operations.
              </p>
            </div>

            {/* Step 2 */}
            <div className="p-5 rounded border border-gray-200 bg-white flex flex-col items-start text-left">
              <div className="w-7 h-7 rounded bg-blue-700 text-white font-bold flex items-center justify-center text-xs mb-3 font-mono">
                2
              </div>
              <h3 className="text-sm font-bold text-gray-900 mb-1">
                Deterministic Discovery
              </h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                The engine evaluates central and state regulatory acts to determine mandatory, conditional, and exempt clearances.
              </p>
            </div>

            {/* Step 3 */}
            <div className="p-5 rounded border border-gray-200 bg-white flex flex-col items-start text-left">
              <div className="w-7 h-7 rounded bg-blue-700 text-white font-bold flex items-center justify-center text-xs mb-3 font-mono">
                3
              </div>
              <h3 className="text-sm font-bold text-gray-900 mb-1">
                Workflow, Scrutiny & SLA
              </h3>
              <p className="text-xs text-gray-600 leading-relaxed">
                Submit documents, track department SLAs with statutory escalation guarantees, coordinate joint site visits, and file returns.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Answering 4 Core Questions */}
      <section className="py-12 bg-slate-50 border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="text-center mb-10">
            <h2 className="text-xl sm:text-2xl font-bold text-gray-900 tracking-tight">
              Core Single-Window Objectives
            </h2>
            <p className="text-xs text-gray-500 mt-1">
              Providing clarity and predictability to industrial applicants
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white p-4.5 rounded border border-gray-200">
              <div className="text-[11px] font-bold text-blue-800 uppercase tracking-wider mb-1">
                WHAT IS REQUIRED?
              </div>
              <p className="text-xs text-gray-600 mt-1.5 leading-relaxed">
                Comprehensive directory of every consent, license, and no-objection certificate mapped to the facility profile.
              </p>
            </div>

            <div className="bg-white p-4.5 rounded border border-gray-200">
              <div className="text-[11px] font-bold text-blue-800 uppercase tracking-wider mb-1">
                WHY DOES IT APPLY?
              </div>
              <p className="text-xs text-gray-600 mt-1.5 leading-relaxed">
                Clear statutory basis citing applicable central and state Acts, schedules, and notifications.
              </p>
            </div>

            <div className="bg-white p-4.5 rounded border border-gray-200">
              <div className="text-[11px] font-bold text-blue-800 uppercase tracking-wider mb-1">
                WHERE TO APPLY?
              </div>
              <p className="text-xs text-gray-600 mt-1.5 leading-relaxed">
                Competent authority contacts, verified document checklists, and statutory turnaround timelines.
              </p>
            </div>

            <div className="bg-white p-4.5 rounded border border-gray-200">
              <div className="text-[11px] font-bold text-blue-800 uppercase tracking-wider mb-1">
                WHAT BLOCKS PROGRESS?
              </div>
              <p className="text-xs text-gray-600 mt-1.5 leading-relaxed">
                Critical path dependency analysis, officer scrutiny queries, and joint inspection scheduling.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Demo Notice */}
      <section className="bg-amber-50 border-b border-amber-200 py-4 px-4 text-center">
        <div className="max-w-4xl mx-auto flex items-center justify-center gap-2 text-xs text-amber-900">
          <Shield className="h-4 w-4 text-amber-700 shrink-0" />
          <span>
            <strong>Demo Notice:</strong> PRAMAN is an independent academic prototype developed for SIH 2026 (PS 26130).
            Regulatory data is labelled DEMO unless verified against official government notifications.
          </span>
        </div>
      </section>

      {/* CTA Bottom Banner */}
      <section className="py-16 bg-blue-900 text-white">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 text-center space-y-4">
          <h2 className="text-2xl sm:text-3xl font-bold">
            Ready to streamline your industrial approvals?
          </h2>
          <p className="text-blue-100 text-sm max-w-xl mx-auto">
            Sign in with a demo account to explore applicant, officer, and administrative portals.
          </p>
          <div className="pt-2">
            <Link href="/login">
              <Button size="lg" className="bg-white text-blue-900 hover:bg-gray-100 font-semibold text-sm">
                Sign In to Demo <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
            </Link>
          </div>
          <div className="text-xs text-blue-200 pt-4">
            Pre-configured accounts: <code className="bg-blue-800 px-1.5 py-0.5 rounded font-mono">applicant@demo.rop</code> • Password: <code className="bg-blue-800 px-1.5 py-0.5 rounded font-mono">Demo@12345</code>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-gray-400 py-6 text-xs border-t border-gray-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-gray-500" />
            <span className="text-gray-300 font-semibold">PRAMAN</span>
            <span>— Industrial Approvals Portal</span>
          </div>
          <div>
            SIH 2026 • Problem Statement 26130 • Academic Prototype
          </div>
        </div>
      </footer>
    </div>
  );
}
