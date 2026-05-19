"use client";

import { Suspense, useState } from "react";
import { signIn } from "next-auth/react";
import { useSearchParams } from "next/navigation";
import { Loader2, Zap, Eye, EyeOff, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

function MicrosoftIcon() {
  return (
    <svg viewBox="0 0 21 21" className="size-4 shrink-0" fill="none">
      <rect x="1"  y="1"  width="9" height="9" fill="#F25022" />
      <rect x="11" y="1"  width="9" height="9" fill="#7FBA00" />
      <rect x="1"  y="11" width="9" height="9" fill="#00A4EF" />
      <rect x="11" y="11" width="9" height="9" fill="#FFB900" />
    </svg>
  );
}

function LoginForm() {
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "/api/auth/role-redirect";

  const [email, setEmail]               = useState("");
  const [password, setPassword]         = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError]               = useState("");
  const [loading, setLoading]           = useState(false);
  const [azureLoading, setAzureLoading] = useState(false);

  const handleCredentials = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const res = await signIn("credentials", { email, password, callbackUrl, redirect: false });
    setLoading(false);
    if (res?.error) setError("Invalid email or password. Please try again.");
    else if (res?.url) window.location.href = res.url;
  };

  const inputCls = "w-full h-10 rounded-lg border border-border bg-background px-3.5 text-sm placeholder:text-muted-foreground/50 outline-none focus:ring-2 focus:ring-primary/25 focus:border-primary/60 transition-all";

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4">
      {/* Background decoration */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 size-80 rounded-full bg-primary/5 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 size-80 rounded-full bg-primary/5 blur-3xl" />
      </div>

      <div className="relative w-full max-w-[360px]">
        {/* Card */}
        <div className="rounded-2xl border bg-card shadow-xl shadow-black/5 p-8 space-y-6">

          {/* Brand */}
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex size-12 items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-md">
              <Zap className="size-5" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-foreground tracking-tight">Welcome back</h1>
              <p className="text-sm text-muted-foreground mt-0.5">Sign in to your AI Platform account</p>
            </div>
          </div>

          {/* Microsoft SSO */}
          <Button
            variant="outline"
            className="w-full gap-2.5 h-10 font-medium"
            onClick={() => { setAzureLoading(true); signIn("azure-ad", { callbackUrl }); }}
            disabled={azureLoading}
          >
            {azureLoading ? <Loader2 className="size-4 animate-spin" /> : <MicrosoftIcon />}
            Continue with Microsoft
          </Button>

          {/* Divider */}
          <div className="flex items-center gap-3">
            <div className="flex-1 h-px bg-border" />
            <span className="text-xs text-muted-foreground font-medium">or sign in with email</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Credentials form */}
          <form onSubmit={handleCredentials} className="space-y-3">
            <div>
              <input
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address"
                className={inputCls}
              />
            </div>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className={`${inputCls} pr-10`}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                tabIndex={-1}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>

            {error && (
              <div className="rounded-lg bg-destructive/10 border border-destructive/20 px-3 py-2.5 text-xs text-destructive font-medium">
                {error}
              </div>
            )}

            <Button type="submit" className="w-full h-10 gap-2 font-medium" disabled={loading}>
              {loading
                ? <Loader2 className="size-4 animate-spin" />
                : <ArrowRight className="size-4" />
              }
              Sign in
            </Button>
          </form>
        </div>

        {/* Footer note */}
        <p className="text-center text-xs text-muted-foreground mt-4">
          Protected by enterprise authentication
        </p>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginForm />
    </Suspense>
  );
}
