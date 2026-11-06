"use client";

import React, { useState } from "react";
import {
  Activity,
  Lock,
  Mail,
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
} from "lucide-react";
import { api } from "../../lib/api";
import { Button } from "../../components/ui/Button";
import { Input } from "../../components/ui/Input";
import { Card } from "../../components/ui/Card";
import { useTheme } from "../../components/ThemeProvider";

export default function AuthPage() {
  const { resolvedTheme, toggleTheme } = useTheme();
  const [tab, setTab] = useState<"login" | "register" | "forgot">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [resetToken, setResetToken] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);
    try {
      await api.auth.login({ email: email.trim(), password });
      window.location.href = "/";
    } catch (err: any) {
      setErrorMsg(err.message || "Invalid credentials.");
      setIsLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);

    const cleanEmail = email.trim();
    if (!cleanEmail.includes("@") || !cleanEmail.includes(".")) {
      setErrorMsg("Please enter a valid email address (e.g. user@example.com).");
      setIsLoading(false);
      return;
    }

    if (password.length < 12) {
      setErrorMsg("Password must be at least 12 characters to meet VitalSense security requirements.");
      setIsLoading(false);
      return;
    }

    if (password !== confirmPassword) {
      setErrorMsg("Passwords do not match.");
      setIsLoading(false);
      return;
    }

    try {
      await api.auth.register({ email: cleanEmail, password });
      window.location.href = "/";
    } catch (err: any) {
      setErrorMsg(err.message || "Registration failed.");
      setIsLoading(false);
    }
  };

  const handleForgotRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);
    try {
      await api.auth.requestReset(email.trim());
      setSuccessMsg("If an account exists for this email, password reset instructions have been generated.");
      setIsLoading(false);
    } catch (err: any) {
      setErrorMsg(err.message || "Password reset request failed.");
      setIsLoading(false);
    }
  };

  const handleResetConfirm = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setErrorMsg(null);

    if (password.length < 12) {
      setErrorMsg("New password must be at least 12 characters.");
      setIsLoading(false);
      return;
    }

    try {
      await api.auth.confirmReset({ token: resetToken, new_password: password });
      setSuccessMsg("Password reset successfully. You may now sign in.");
      setTab("login");
      setIsLoading(false);
    } catch (err: any) {
      setErrorMsg(err.message || "Password reset failed. Token may be expired or already consumed.");
      setIsLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4 sm:p-6 bg-canvas text-text-primary selection:bg-brand selection:text-white relative">
      {/* Top right theme toggle */}
      <div className="absolute top-4 right-4">
        <button
          onClick={toggleTheme}
          className="h-9 px-3 rounded-pill border border-border bg-surface text-xs font-medium text-text-secondary hover:text-text-primary flex items-center gap-1.5 transition-colors"
        >
          {resolvedTheme === "dark" ? "Light Mode" : "Dark Mode"}
        </button>
      </div>

      <div className="w-full max-w-md space-y-6">
        {/* Brand Header */}
        <div className="text-center">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-pill bg-brand text-white mb-4 shadow-sm">
            <Activity className="h-7 w-7" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-text-primary font-display">
            VitalSense
          </h1>
          <p className="text-xs sm:text-sm text-text-secondary mt-1 max-w-xs mx-auto">
            Privacy-first personal health intelligence & biometric synchronization.
          </p>
        </div>

        {/* Auth Card Container */}
        <Card variant="elevated" className="p-6 sm:p-8">
          {/* Tabs */}
          <div className="flex rounded-pill bg-surface-subtle p-1 border border-border mb-6">
            <button
              onClick={() => {
                setTab("login");
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className={`flex-1 py-1.5 text-xs font-medium rounded-pill transition-all ${
                tab === "login"
                  ? "bg-surface-elevated text-brand font-semibold shadow-xs"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              Sign In
            </button>
            <button
              onClick={() => {
                setTab("register");
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className={`flex-1 py-1.5 text-xs font-medium rounded-pill transition-all ${
                tab === "register"
                  ? "bg-surface-elevated text-brand font-semibold shadow-xs"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              Create Account
            </button>
            <button
              onClick={() => {
                setTab("forgot");
                setErrorMsg(null);
                setSuccessMsg(null);
              }}
              className={`flex-1 py-1.5 text-xs font-medium rounded-pill transition-all ${
                tab === "forgot"
                  ? "bg-surface-elevated text-brand font-semibold shadow-xs"
                  : "text-text-secondary hover:text-text-primary"
              }`}
            >
              Recovery
            </button>
          </div>

          {/* Feedback Banners */}
          {errorMsg && (
            <div className="mb-5 flex items-start gap-2.5 rounded-xl bg-danger/10 border border-danger/30 p-3.5 text-xs text-danger">
              <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{errorMsg}</div>
            </div>
          )}

          {successMsg && (
            <div className="mb-5 flex items-start gap-2.5 rounded-xl bg-positive/10 border border-positive/30 p-3.5 text-xs text-positive">
              <CheckCircle2 className="h-4 w-4 shrink-0 mt-0.5" />
              <div className="leading-relaxed">{successMsg}</div>
            </div>
          )}

          {/* 1. Login Form */}
          {tab === "login" && (
            <form onSubmit={handleLogin} className="space-y-4">
              <Input
                label="Email Address"
                type="email"
                required
                autoComplete="email"
                placeholder="you@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                leftIcon={<Mail className="h-4 w-4" />}
              />

              <Input
                label="Password"
                type={showPassword ? "text" : "password"}
                required
                autoComplete="current-password"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                leftIcon={<Lock className="h-4 w-4" />}
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="p-1 hover:text-text-primary focus:outline-none"
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                }
              />

              <div className="flex items-center justify-between pt-1">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    className="h-4 w-4 rounded border-border text-brand focus:ring-brand/40"
                  />
                  <span className="text-xs text-text-secondary">Remember session</span>
                </label>

                <button
                  type="button"
                  onClick={() => setTab("forgot")}
                  className="text-xs font-medium text-brand hover:underline"
                >
                  Forgot password?
                </button>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="md"
                isLoading={isLoading}
                className="w-full mt-2"
                rightIcon={<ArrowRight className="h-4 w-4" />}
              >
                Sign In
              </Button>
            </form>
          )}

          {/* 2. Registration Form */}
          {tab === "register" && (
            <form onSubmit={handleRegister} className="space-y-4">
              <Input
                label="Email Address"
                type="email"
                required
                autoComplete="email"
                placeholder="you@domain.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                leftIcon={<Mail className="h-4 w-4" />}
              />

              <Input
                label="Password (min 12 characters)"
                type={showPassword ? "text" : "password"}
                required
                autoComplete="new-password"
                placeholder="••••••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                leftIcon={<Lock className="h-4 w-4" />}
                rightIcon={
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="p-1 hover:text-text-primary focus:outline-none"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                }
              />

              <Input
                label="Confirm Password"
                type={showPassword ? "text" : "password"}
                required
                autoComplete="new-password"
                placeholder="••••••••••••"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                leftIcon={<Lock className="h-4 w-4" />}
              />

              <div className="p-3 rounded-xl bg-surface-subtle text-[11px] text-text-muted space-y-1">
                <p className="font-medium text-text-secondary flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5 text-brand" />
                  Privacy-first architecture
                </p>
                <p>
                  Passwords are protected with high-cost Argon2id hashing. Access tokens use HttpOnly secure cookies; raw tokens are never accessible to client scripts.
                </p>
              </div>

              <Button
                type="submit"
                variant="primary"
                size="md"
                isLoading={isLoading}
                className="w-full mt-2"
                rightIcon={<ArrowRight className="h-4 w-4" />}
              >
                Create Account
              </Button>
            </form>
          )}

          {/* 3. Password Reset Flow */}
          {tab === "forgot" && (
            <div className="space-y-5">
              {!resetToken ? (
                <form onSubmit={handleForgotRequest} className="space-y-4">
                  <p className="text-xs text-text-secondary leading-relaxed">
                    Enter your account email. If registered, we will generate single-use password reset instructions.
                  </p>

                  <Input
                    label="Email Address"
                    type="email"
                    required
                    placeholder="you@domain.com"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    leftIcon={<Mail className="h-4 w-4" />}
                  />

                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    isLoading={isLoading}
                    className="w-full"
                  >
                    Generate Reset Instructions
                  </Button>

                  <div className="pt-2 text-center">
                    <button
                      type="button"
                      onClick={() => setResetToken("manual_entry")}
                      className="text-xs text-brand hover:underline font-medium"
                    >
                      Already have a reset token? Enter it here
                    </button>
                  </div>
                </form>
              ) : (
                <form onSubmit={handleResetConfirm} className="space-y-4">
                  <p className="text-xs text-text-secondary leading-relaxed">
                    Provide the single-use reset token and choose a new 12+ character password.
                  </p>

                  <Input
                    label="Reset Token"
                    type="text"
                    required
                    placeholder="Paste your reset token"
                    value={resetToken === "manual_entry" ? "" : resetToken}
                    onChange={(e) => setResetToken(e.target.value)}
                  />

                  <Input
                    label="New Password (min 12 chars)"
                    type="password"
                    required
                    placeholder="••••••••••••"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    leftIcon={<Lock className="h-4 w-4" />}
                  />

                  <Button
                    type="submit"
                    variant="primary"
                    size="md"
                    isLoading={isLoading}
                    className="w-full"
                  >
                    Confirm New Password
                  </Button>

                  <div className="pt-2 text-center">
                    <button
                      type="button"
                      onClick={() => setResetToken("")}
                      className="text-xs text-text-muted hover:text-text-primary"
                    >
                      Back to request email
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}
        </Card>

        {/* Security & Zero-Fabrication Footer */}
        <div className="flex items-center justify-center gap-2 text-[11px] text-text-muted">
          <ShieldCheck className="h-3.5 w-3.5 text-brand" />
          <span>FIPS 180-4 SHA-256 Identity & Argon2id Encrypted Storage</span>
        </div>
      </div>
    </div>
  );
}
