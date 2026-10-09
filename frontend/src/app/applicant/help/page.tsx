"use client";

import { useState } from "react";
import Link from "next/link";
import { ApplicantLayout } from "@/components/layout/ApplicantLayout";
import { StatusBadge, DataStatus } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  HelpCircle,
  Search,
  BookOpen,
  Building2,
  Phone,
  Mail,
  Globe,
  ExternalLink,
  ChevronDown,
  ChevronUp,
  Cpu,
  Layers,
  Clock,
  ShieldAlert,
  Tag,
  CheckCircle2,
  AlertTriangle,
  Info,
  Scale,
  FileText,
  UserCheck,
} from "lucide-react";

interface FAQItem {
  id: string;
  category: string;
  question: string;
  shortSummary: string;
  detailedContent: React.ReactNode;
}

const FAQS: FAQItem[] = [
  {
    id: "deterministic-engine",
    category: "Regulatory Discovery",
    question: "How does PRAMAN identify my required approvals?",
    shortSummary:
      "Deterministic rule engine using 3-valued logic (TRUE, FALSE, UNKNOWN) with zero hallucinated government requirements.",
    detailedContent: (
      <div className="space-y-3 text-xs leading-relaxed text-gray-700">
        <p>
          Unlike generic generative AI portals that might guess or hallucinate legal requirements,
          <strong> PRAMAN operates on an auditable, deterministic Boolean evaluation engine</strong>.
        </p>
        <p>
          Every clearance item (e.g. MPCB Consent to Establish, DISH Factory Plan Approval, Fire NOC, High-Tension Power Sanction)
          is codified as an exact logical rule grounded in statutory acts:
        </p>
        <ul className="list-disc list-inside space-y-1 pl-2 text-gray-800">
          <li>
            <strong>3-Valued Logic:</strong> Conditions evaluate to <code className="bg-gray-100 px-1 py-0.5 rounded font-mono text-blue-700">TRUE</code> (mandated), <code className="bg-gray-100 px-1 py-0.5 rounded font-mono text-gray-600">FALSE</code> (exempt), or <code className="bg-gray-100 px-1 py-0.5 rounded font-mono text-purple-700">UNKNOWN</code> (additional business profile information required).
          </li>
          <li>
            <strong>Zero Hallucinated Facts:</strong> Requirements are strictly mapped to formal Government of Maharashtra Government Resolutions (GRs), Central CPCB pollution categorizations (Red/Orange/Green/White), and MIDC development control regulations.
          </li>
          <li>
            <strong>Missing Field Guidance:</strong> When an approval is conditional on parameters like daily effluent discharge (KLD) or connected power load (kVA), PRAMAN explicitly informs you which profile field to supply.
          </li>
        </ul>
      </div>
    ),
  },
  {
    id: "central-inspection-system",
    category: "Site Inspections",
    question: "What is the Central Inspection System (CIS)?",
    shortSummary:
      "Unified joint physical inspection synchronized under DPIIT Business Reforms Action Plan (BRAP).",
    detailedContent: (
      <div className="space-y-3 text-xs leading-relaxed text-gray-700">
        <p>
          The <strong>Central Inspection System (CIS)</strong> is mandated by the Department for Promotion of Industry
          and Internal Trade (DPIIT) under the Business Reforms Action Plan (BRAP) for all state Single Window Systems.
        </p>
        <p>
          In traditional processes, multiple regulatory bodies—MPCB (Pollution), DISH (Factory Safety & Health),
          State Fire Services, and MIDC—conducted uncoordinated, independent site visits at arbitrary dates.
        </p>
        <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-blue-900 space-y-1.5">
          <div className="font-semibold">How PRAMAN Implements CIS:</div>
          <ul className="list-disc list-inside space-y-1 pl-1 text-blue-800">
            <li><strong>Joint Schedule:</strong> A designated Nodal Lead Inspector convenes participating departments for a single joint visit.</li>
            <li><strong>Synchronized Checklist:</strong> Inspection items across environmental emissions, fire exits, and structural safety are evaluated together.</li>
            <li><strong>Single Consolidated Report:</strong> All officers file observations into PRAMAN within 48 hours of site completion.</li>
          </ul>
        </div>
      </div>
    ),
  },
  {
    id: "sla-breach-escalations",
    category: "SLA & Timelines",
    question: "What happens when an SLA breaches?",
    shortSummary:
      "Automatic 3-level escalation engine strictly enforced under Maharashtra Right to Public Services Act (RTSA 2015).",
    detailedContent: (
      <div className="space-y-3 text-xs leading-relaxed text-gray-700">
        <p>
          The <strong>Maharashtra Right to Public Services Act, 2015 (RTSA)</strong> guarantees time-bound delivery
          of industrial clearances. When a clearance step is delayed, PRAMAN triggers an automated 3-level escalation engine:
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5 pt-1">
          <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
            <div className="font-bold text-amber-900 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-amber-500" /> Level 1
            </div>
            <div className="text-[11px] font-semibold text-amber-800 mt-0.5">Assigned Scrutiny Officer</div>
            <div className="text-[11px] text-amber-700 mt-1">
              Triggered at statutory SLA deadline. Direct warning notification issued on officer desk.
            </div>
          </div>

          <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <div className="font-bold text-orange-900 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-orange-500" /> Level 2
            </div>
            <div className="text-[11px] font-semibold text-orange-800 mt-0.5">Head of Department (HoD)</div>
            <div className="text-[11px] text-orange-700 mt-1">
              Triggered if unresolved after +3 business days. First Appellate Authority notified for review.
            </div>
          </div>

          <div className="p-3 bg-red-50 border border-red-200 rounded-lg">
            <div className="font-bold text-red-900 flex items-center gap-1">
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" /> Level 3
            </div>
            <div className="text-[11px] font-semibold text-red-800 mt-0.5">State Appellate / Secretary</div>
            <div className="text-[11px] text-red-700 mt-1">
              Triggered after +7 business days. Escalated to Principal Secretary (Industries) for statutory intervention.
            </div>
          </div>
        </div>
        <p className="text-[11px] text-gray-500 pt-1">
          <em>Note:</em> The clock pauses legitimately when the department raises a written deficiency query, and resumes immediately upon applicant re-upload.
        </p>
      </div>
    ),
  },
  {
    id: "data-labels-meaning",
    category: "System Transparency",
    question: "What do the data status labels mean?",
    shortSummary:
      "Clear distinction between VERIFIED, DEMO, MOCK, and VERIFICATION_REQUIRED data items.",
    detailedContent: (
      <div className="space-y-3 text-xs leading-relaxed text-gray-700">
        <p>
          In adherence to strict truth-in-software standards, PRAMAN explicitly tags every data entity
          so applicants and evaluators understand its provenance:
        </p>
        <div className="space-y-2">
          <div className="flex items-start gap-2.5 p-2 bg-gray-50 rounded border border-gray-200">
            <StatusBadge status="VERIFIED" />
            <div className="text-[11px] text-gray-700">
              <strong>VERIFIED:</strong> Grounded in official Government of Maharashtra gazette notifications, DPIIT BRAP mandates, or verified department regulations.
            </div>
          </div>

          <div className="flex items-start gap-2.5 p-2 bg-gray-50 rounded border border-gray-200">
            <StatusBadge status="DEMO" />
            <div className="text-[11px] text-gray-700">
              <strong>DEMO:</strong> Simulated operational scenario data generated for hackathon benchmarking and flow verification.
            </div>
          </div>

          <div className="flex items-start gap-2.5 p-2 bg-gray-50 rounded border border-gray-200">
            <StatusBadge status="MOCK" />
            <div className="text-[11px] text-gray-700">
              <strong>MOCK:</strong> Synthetic placeholder data for external departmental webhooks or legacy system bridges.
            </div>
          </div>

          <div className="flex items-start gap-2.5 p-2 bg-gray-50 rounded border border-gray-200">
            <StatusBadge status="VERIFICATION_REQUIRED" />
            <div className="text-[11px] text-gray-700">
              <strong>VERIFICATION REQUIRED:</strong> Department rules or thresholds that require confirmation by nodal state officers prior to live gazette adoption.
            </div>
          </div>

          <div className="flex items-start gap-2.5 p-2 bg-gray-50 rounded border border-gray-200">
            <StatusBadge status="CONFIGURATION_REQUIRED" />
            <div className="text-[11px] text-gray-700">
              <strong>CONFIGURATION REQUIRED:</strong> Escalation matrix or officer assignment email addresses that require system administrator setup.
            </div>
          </div>
        </div>
      </div>
    ),
  },
];

interface DirectoryEntry {
  code: string;
  name: string;
  fullName: string;
  mandate: string;
  portalUrl: string;
  helpline: string;
  email: string;
  address: string;
}

const DEPARTMENTS: DirectoryEntry[] = [
  {
    code: "MIDC",
    name: "MIDC",
    fullName: "Maharashtra Industrial Development Corporation",
    mandate: "Industrial land allotment, building plan approvals, water supply connection, and drainage infrastructure in MIDC zones.",
    portalUrl: "https://midcindia.org",
    helpline: "1800-22-6432 (Toll Free / Simulated)",
    email: "helpdesk@midcindia.org (Simulated)",
    address: "Udyog Dhavan, Mahakali Caves Road, Andheri (E), Mumbai - 400093",
  },
  {
    code: "MPCB",
    name: "MPCB",
    fullName: "Maharashtra Pollution Control Board",
    mandate: "Consent to Establish (CTE) and Consent to Operate (CTO) under Water Act 1974, Air Act 1981, and Hazardous Waste Rules.",
    portalUrl: "https://mpcb.gov.in",
    helpline: "022-24020781 (Simulated)",
    email: "consent@mpcb.gov.in (Simulated)",
    address: "Kalpataru Point, 3rd and 4th Floor, Opp. Cine Planet, Sion Circle, Mumbai - 400022",
  },
  {
    code: "DISH",
    name: "DISH",
    fullName: "Directorate of Industrial Safety & Health",
    mandate: "Factory plan scrutiny, factory license registration under Maharashtra Factories Rules 1963, worker welfare & boiler safety.",
    portalUrl: "https://dish.maharashtra.gov.in",
    helpline: "022-26572522 (Simulated)",
    email: "info.dish@maharashtra.gov.in (Simulated)",
    address: "Kamgar Bhavan, C-20, E-Block, Bandra Kurla Complex, Mumbai - 400051",
  },
  {
    code: "FIRE",
    name: "Fire Services",
    fullName: "Maharashtra Fire Prevention & Life Safety Services",
    mandate: "Provisional and Final Fire NOC for industrial plant layouts, high-rise warehouses, and chemical storage installations.",
    portalUrl: "https://nsws.gov.in",
    helpline: "022-23076111 (Simulated)",
    email: "firecell@maharashtra.gov.in (Simulated)",
    address: "Maharashtra State Fire Academy, Vidyanagari, Kalina, Santacruz (E), Mumbai - 400098",
  },
  {
    code: "MSEDCL",
    name: "MSEDCL / DISCOM",
    fullName: "Maharashtra State Electricity Distribution Co. Ltd.",
    mandate: "High-Tension (HT) and Low-Tension (LT) industrial power sanctions, sub-station feasibility, and net-metering solar sanctions.",
    portalUrl: "https://mahadiscom.in",
    helpline: "1912 / 1800-233-3435 (Simulated)",
    email: "customercare@mahadiscom.in (Simulated)",
    address: "Hongkong Bank Building, M.G. Road, Fort, Mumbai - 400001",
  },
];

export default function ApplicantHelpPage() {
  const [searchQuery, setSearchQuery] = useState("");
  const [expandedFaqId, setExpandedFaqId] = useState<string>("deterministic-engine");
  const [selectedCategory, setSelectedCategory] = useState<string>("ALL");

  const filteredFaqs = FAQS.filter((faq) => {
    const matchesSearch =
      faq.question.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.shortSummary.toLowerCase().includes(searchQuery.toLowerCase()) ||
      faq.category.toLowerCase().includes(searchQuery.toLowerCase());

    const matchesCategory =
      selectedCategory === "ALL" || faq.category === selectedCategory;

    return matchesSearch && matchesCategory;
  });

  const categories = ["ALL", ...Array.from(new Set(FAQS.map((f) => f.category)))];

  return (
    <ApplicantLayout
      title="Help & Regulatory Knowledge Center"
      subtitle="Explanations of PRAMAN regulatory algorithms, DPIIT CIS joint visits, RTSA escalations, and official department directory"
    >
      <div className="space-y-8">
        {/* Search & Knowledge Banner */}
        <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 rounded-2xl p-6 sm:p-8 text-white shadow-md">
          <div className="max-w-2xl space-y-3">
            <span className="bg-blue-600 text-white text-[10px] uppercase font-bold tracking-widest px-2.5 py-0.5 rounded-full">
              PRAMAN Knowledge Base
            </span>
            <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
              Regulatory Guidance & Platform Principles
            </h2>
            <p className="text-xs text-blue-200 leading-relaxed">
              Understand how clearance requirements are deterministically inferred, how joint physical inspections
              are harmonized under DPIIT BRAP, and how time-bound SLAs are legally enforced under Maharashtra RTSA 2015.
            </p>
            <div className="pt-2 relative">
              <Search className="absolute left-3.5 top-5 h-4 w-4 text-gray-400" />
              <Input
                type="text"
                placeholder="Search FAQs, regulations, escalation levels, or department names..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10 bg-white text-gray-900 text-xs h-10 rounded-xl border-0 shadow-lg"
              />
            </div>
          </div>
        </div>

        {/* Section 1: Detailed Regulatory FAQs */}
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
                <BookOpen className="h-5 w-5 text-blue-600" />
                Frequently Asked Regulatory Questions
              </h3>
              <p className="text-xs text-gray-500 mt-0.5">
                Core architectural answers on how PRAMAN ensures compliance with state industrial mandates
              </p>
            </div>

            {/* Category Filter Pills */}
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
              {categories.map((cat) => (
                <button
                  key={cat}
                  onClick={() => setSelectedCategory(cat)}
                  className={`text-xs px-2.5 py-1 rounded-full border transition-colors shrink-0 ${
                    selectedCategory === cat
                      ? "bg-blue-600 text-white border-blue-600 font-semibold"
                      : "bg-white text-gray-600 border-gray-200 hover:bg-gray-50"
                  }`}
                >
                  {cat === "ALL" ? "All Topics" : cat}
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-3">
            {filteredFaqs.length === 0 ? (
              <div className="bg-white rounded-xl border border-gray-200 p-8 text-center text-gray-500 text-sm">
                No help articles match your search query. Try searching for &quot;SLA&quot;, &quot;CIS&quot;, or &quot;Rule Engine&quot;.
              </div>
            ) : (
              filteredFaqs.map((faq) => {
                const isExpanded = expandedFaqId === faq.id;

                return (
                  <div
                    key={faq.id}
                    className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden transition-all"
                  >
                    <button
                      onClick={() => setExpandedFaqId(isExpanded ? "" : faq.id)}
                      className="w-full text-left p-5 flex items-start justify-between gap-4 hover:bg-gray-50/70 transition-colors"
                    >
                      <div className="space-y-1">
                        <div className="flex items-center gap-2">
                          <span className="text-[10px] font-semibold uppercase tracking-wider text-blue-700 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">
                            {faq.category}
                          </span>
                          <span className="text-xs font-mono text-gray-400">ID: {faq.id}</span>
                        </div>
                        <h4 className="text-sm font-bold text-gray-900">{faq.question}</h4>
                        <p className="text-xs text-gray-500 leading-relaxed">{faq.shortSummary}</p>
                      </div>

                      <div className="shrink-0 p-1.5 rounded-lg bg-gray-50 border border-gray-200 text-gray-500">
                        {isExpanded ? (
                          <ChevronUp className="h-4 w-4" />
                        ) : (
                          <ChevronDown className="h-4 w-4" />
                        )}
                      </div>
                    </button>

                    {isExpanded && (
                      <div className="px-5 pb-5 pt-2 border-t border-gray-100 bg-gray-50/40">
                        {faq.detailedContent}
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Section 2: Regulatory Department Directory */}
        <div className="space-y-4">
          <div>
            <h3 className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Building2 className="h-5 w-5 text-blue-600" />
              Maharashtra Regulatory Department Directory
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Nodal departments integrated under PRAMAN single-window orchestration
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {DEPARTMENTS.map((dept) => (
              <div
                key={dept.code}
                className="bg-white rounded-xl border border-gray-200 p-5 shadow-sm space-y-3 flex flex-col justify-between"
              >
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-base text-gray-900">{dept.name}</span>
                    <span className="text-[10px] font-bold px-2 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-200 font-mono">
                      {dept.code}
                    </span>
                  </div>
                  <div className="text-xs font-semibold text-gray-700">{dept.fullName}</div>
                  <p className="text-xs text-gray-600 leading-relaxed">{dept.mandate}</p>
                </div>

                <div className="pt-3 border-t border-gray-100 space-y-2 text-xs text-gray-600">
                  <div className="flex items-center gap-2">
                    <Phone className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                    <span className="truncate">{dept.helpline}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <Mail className="h-3.5 w-3.5 text-gray-400 shrink-0" />
                    <span className="truncate">{dept.email}</span>
                  </div>
                  <div className="pt-1">
                    <a
                      href={dept.portalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1.5 text-blue-600 hover:text-blue-800 font-semibold text-xs"
                    >
                      Official Department Portal <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Section 3: SIH 2026 Academic Prototype Notice & Demo Credentials */}
        <div className="bg-slate-900 text-white rounded-2xl p-6 sm:p-8 space-y-4">
          <div className="flex items-center gap-2">
            <span className="bg-amber-500 text-slate-950 text-[10px] font-bold uppercase tracking-wider px-2.5 py-0.5 rounded-full">
              SIH 2026 Academic Prototype Notice
            </span>
            <span className="text-xs text-slate-400 font-mono">Problem Statement 26130</span>
          </div>

          <h3 className="text-lg font-bold text-white">
            Smart India Hackathon 2026 — Regulatory Orchestration Platform (PRAMAN)
          </h3>

          <p className="text-xs text-slate-300 leading-relaxed max-w-3xl">
            PRAMAN is an academic engineering prototype developed for the SIH 2026 Grand Finale.
            It demonstrates deterministic regulatory rule compilation, automated 3-level SLA escalations under Maharashtra RTSA 2015,
            DPIIT BRAP synchronized joint inspections, and multi-tier officer scrutiny.
            This portal does not replace official state platforms (MAITRI, NSWS, MPCB e-Consent, or MIDC Single Window).
          </p>

          <div className="pt-2 border-t border-slate-800">
            <div className="text-xs font-semibold text-slate-300 mb-2 flex items-center gap-1.5">
              <UserCheck className="h-3.5 w-3.5 text-amber-400" />
              Demo Roles & Credentials for System Evaluators:
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 bg-slate-800/80 rounded-lg border border-slate-700">
                <span className="text-slate-400 block text-[11px]">Applicant Portal Role</span>
                <span className="font-mono text-amber-300 font-bold block mt-0.5">applicant@demo.rop</span>
                <span className="text-slate-400 text-[11px] block mt-0.5">Password: Demo@12345</span>
              </div>

              <div className="p-3 bg-slate-800/80 rounded-lg border border-slate-700">
                <span className="text-slate-400 block text-[11px]">Officer Scrutiny & CIS Role</span>
                <span className="font-mono text-blue-300 font-bold block mt-0.5">officer@demo.rop</span>
                <span className="text-slate-400 text-[11px] block mt-0.5">Password: Demo@12345</span>
              </div>

              <div className="p-3 bg-slate-800/80 rounded-lg border border-slate-700">
                <span className="text-slate-400 block text-[11px]">State Administrator & Executive</span>
                <span className="font-mono text-emerald-300 font-bold block mt-0.5">admin@demo.rop</span>
                <span className="text-slate-400 text-[11px] block mt-0.5">Password: Demo@12345</span>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-gray-400 border-t border-gray-200 pt-4">
          PRAMAN Regulatory Orchestration Platform • Academic Prototype for SIH 2026 (PS 26130) •
          All regulatory data in this prototype is DEMO status unless explicitly marked VERIFIED.
        </div>
      </div>
    </ApplicantLayout>
  );
}
