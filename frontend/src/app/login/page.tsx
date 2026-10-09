"use client";

import { useState, FormEvent, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { login } from "@/lib/api";
import { saveSession, getDashboardPath } from "@/lib/auth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { StatusBadge } from "@/components/StatusBadge";
import { AlertCircle, Building2, User, ShieldCheck, ArrowRight } from "lucide-react";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const redirectTarget = searchParams.get("redirect");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const data = await login(email, password);
      saveSession(data);
      if (redirectTarget && data.role === "applicant") {
        router.push(redirectTarget);
      } else {
        router.push(getDashboardPath(data.role));
      }
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data
          ?.detail || "Login failed. Please check your credentials.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  function handleDemoSelect(demoEmail: string) {
    setEmail(demoEmail);
    setPassword("Demo@12345");
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans">
      {/* Header */}
      <header className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-blue-700 p-2 rounded text-white">
              <Building2 className="h-5 w-5" />
            </div>
            <div>
              <div className="text-sm font-bold text-gray-900">
                PRAMAN — Industrial Approvals Portal
              </div>
              <div className="text-xs text-gray-500">
                Maharashtra Industrial Single-Window System
              </div>
            </div>
          </div>
          <div>
            <StatusBadge status="DEMO" />
          </div>
        </div>
      </header>

      {/* Main Form Container */}
      <main className="flex-1 flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          {/* Quick Demo Account Selector (Top Banner) */}
          {/* Quick Demo Account Selector (Top Banner) */}
          <div className="mb-4 bg-white rounded border border-gray-200 p-4">
            <div className="text-[11px] font-bold text-gray-800 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
              <ShieldCheck className="h-4 w-4 text-blue-700" />
              Pre-Configured Demo Credentials
            </div>
            <p className="text-xs text-gray-500 mb-2.5">
              Select an account to auto-fill credentials for evaluation:
            </p>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleDemoSelect("applicant@demo.rop")}
                className={`p-2.5 rounded border text-left transition-colors text-xs flex flex-col justify-between ${
                  email === "applicant@demo.rop"
                    ? "bg-blue-50 border-blue-700 text-blue-900 font-semibold"
                    : "bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-800"
                }`}
              >
                <span className="font-semibold text-gray-900">Applicant</span>
                <span className="text-[10px] text-gray-500 mt-1">Industrialist</span>
              </button>

              <button
                type="button"
                onClick={() => handleDemoSelect("officer@demo.rop")}
                className={`p-2.5 rounded border text-left transition-colors text-xs flex flex-col justify-between ${
                  email === "officer@demo.rop"
                    ? "bg-blue-50 border-blue-700 text-blue-900 font-semibold"
                    : "bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-800"
                }`}
              >
                <span className="font-semibold text-gray-900">Officer</span>
                <span className="text-[10px] text-gray-500 mt-1">Scrutiny Desk</span>
              </button>

              <button
                type="button"
                onClick={() => handleDemoSelect("admin@demo.rop")}
                className={`p-2.5 rounded border text-left transition-colors text-xs flex flex-col justify-between ${
                  email === "admin@demo.rop"
                    ? "bg-blue-50 border-blue-700 text-blue-900 font-semibold"
                    : "bg-gray-50 hover:bg-gray-100 border-gray-200 text-gray-800"
                }`}
              >
                <span className="font-semibold text-gray-900">Admin</span>
                <span className="text-[10px] text-gray-500 mt-1">Executive Console</span>
              </button>
            </div>
          </div>

          {/* Login Form Box */}
          <div className="bg-white rounded border border-gray-200 p-6 sm:p-7">
            <div className="mb-5">
              <h1 className="text-lg font-bold text-gray-900 tracking-tight">Portal Authentication</h1>
              <p className="text-xs text-gray-500 mt-0.5">
                Sign in with registered credentials to access approvals and services
              </p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-1">
                <Label htmlFor="email" className="text-xs font-semibold text-gray-700">
                  Email Address
                </Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="name@company.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  autoComplete="username"
                  className="text-xs h-9 rounded border-gray-300"
                />
              </div>

              <div className="space-y-1">
                <Label htmlFor="password" className="text-xs font-semibold text-gray-700">
                  Password
                </Label>
                <Input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  className="text-xs h-9 rounded border-gray-300"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 p-3 rounded-md bg-red-50 border border-red-200 text-xs text-red-700">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  {error}
                </div>
              )}

              <Button
                type="submit"
                className="w-full bg-blue-700 hover:bg-blue-800 text-white text-xs h-10 font-semibold"
                disabled={loading}
              >
                {loading ? "Signing in..." : "Sign In"}
              </Button>
            </form>
          </div>

          {/* Footer Notice */}
          <div className="text-center text-xs text-gray-400 mt-6 leading-relaxed">
            SIH 2026 Problem Statement 26130 Prototype.
            <br />
            All regulatory records default to DEMO status.
          </div>
        </div>
      </main>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-gray-50 flex items-center justify-center text-xs text-gray-500">Loading portal...</div>}>
      <LoginForm />
    </Suspense>
  );
}
