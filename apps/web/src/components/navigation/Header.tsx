"use client";

import React, { useState, useRef, useEffect } from "react";
import Link from "next/link";
import {
  Search,
  Sun,
  Moon,
  RefreshCw,
  Wifi,
  WifiOff,
  User,
  LogOut,
  ChevronDown,
  Activity,
  Shield,
  Layers,
} from "lucide-react";
import { useTheme } from "../ThemeProvider";
import { Badge } from "../ui/Badge";
import { Button } from "../ui/Button";
import { PersonProfile } from "../../lib/api";

export interface HeaderProps {
  title?: string;
  subtitle?: string;
  isOnline: boolean;
  pendingSyncCount: number;
  isSyncing: boolean;
  onSync: () => void;
  profiles?: PersonProfile[];
  activeProfileId?: string;
  onSelectProfile?: (id: string) => void;
  onLogout?: () => void;
  onImportClick?: () => void;
  onPrivacyClick?: () => void;
}

export function Header({
  title = "Overview",
  subtitle,
  isOnline,
  pendingSyncCount,
  isSyncing,
  onSync,
  profiles = [],
  activeProfileId,
  onSelectProfile,
  onLogout,
  onImportClick,
  onPrivacyClick,
}: HeaderProps) {
  const { resolvedTheme, toggleTheme } = useTheme();
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  const activeProfile = profiles.find((p) => p.id === activeProfileId) || profiles[0];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsProfileMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  return (
    <header className="h-[60px] bg-canvas/90 backdrop-blur-md border-b border-border px-4 sm:px-6 flex items-center justify-between gap-4 sticky top-0 z-10 select-none">
      {/* Left: Mobile Brand & Page Context */}
      <div className="flex items-center gap-3 min-w-0">
        <Link href="/" className="md:hidden flex items-center gap-2 shrink-0">
          <div className="h-7 w-7 rounded-pill bg-brand text-white flex items-center justify-center">
            <Activity className="h-3.5 w-3.5" />
          </div>
        </Link>
        <div className="min-w-0">
          <h1 className="text-sm sm:text-base font-semibold text-text-primary tracking-tight font-display truncate">
            {title}
          </h1>
          {subtitle && (
            <p className="text-[11px] text-text-muted truncate hidden sm:block">
              {subtitle}
            </p>
          )}
        </div>
      </div>

      {/* Center: Search Interface (Desktop) */}
      <div className="hidden lg:flex items-center flex-1 max-w-md mx-4">
        <div className="relative w-full">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-text-muted pointer-events-none" />
          <input
            type="search"
            placeholder="Search metrics, workouts, or intelligence..."
            className="w-full h-9 pl-9 pr-4 rounded-pill bg-surface-subtle text-text-primary text-xs border border-border/80 placeholder:text-text-muted focus:outline-none focus:ring-1 focus:ring-brand focus:border-brand transition-colors"
          />
        </div>
      </div>

      {/* Right: Actions, Sync, Theme & Profile */}
      <div className="flex items-center gap-2 sm:gap-3 shrink-0">
        {/* Offline / Online Status */}
        <div className="hidden sm:flex items-center">
          {isOnline ? (
            <Badge size="sm" variant="mint" className="gap-1 font-normal">
              <Wifi className="h-3 w-3 text-brand" />
              <span>Online</span>
            </Badge>
          ) : (
            <Badge size="sm" variant="warning" className="gap-1 font-normal">
              <WifiOff className="h-3 w-3 text-warning" />
              <span>Offline Mode</span>
            </Badge>
          )}
        </div>

        {/* Sync Trigger & Pending Count */}
        <button
          onClick={onSync}
          disabled={isSyncing || !isOnline}
          title={
            pendingSyncCount > 0
              ? `${pendingSyncCount} pending offline changes`
              : "Synchronize health data"
          }
          className="relative h-9 px-2.5 rounded-pill border border-border bg-surface hover:bg-surface-subtle text-text-secondary hover:text-text-primary flex items-center gap-1.5 text-xs transition-colors disabled:opacity-50"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${isSyncing ? "animate-spin text-brand" : ""}`}
          />
          {pendingSyncCount > 0 && (
            <span className="h-4 min-w-[16px] px-1 rounded-pill bg-brand text-white text-[10px] font-bold flex items-center justify-center">
              {pendingSyncCount}
            </span>
          )}
        </button>

        {/* Theme Switcher */}
        <button
          onClick={toggleTheme}
          aria-label={
            resolvedTheme === "dark" ? "Switch to light theme" : "Switch to dark theme"
          }
          className="h-9 w-9 rounded-pill border border-border bg-surface hover:bg-surface-subtle text-text-secondary hover:text-text-primary flex items-center justify-center transition-colors"
        >
          {resolvedTheme === "dark" ? (
            <Sun className="h-4 w-4 text-warning" />
          ) : (
            <Moon className="h-4 w-4 text-text-secondary" />
          )}
        </button>

        {/* Profile / Account Dropdown */}
        <div className="relative" ref={menuRef}>
          <button
            onClick={() => setIsProfileMenuOpen(!isProfileMenuOpen)}
            className="h-9 pl-2 pr-2.5 rounded-pill border border-border bg-surface hover:bg-surface-subtle flex items-center gap-2 transition-colors select-none"
          >
            <div className="h-6 w-6 rounded-pill bg-brand/15 text-brand flex items-center justify-center text-xs font-semibold">
              {activeProfile?.display_name
                ? activeProfile.display_name.charAt(0).toUpperCase()
                : "U"}
            </div>
            <span className="text-xs font-medium text-text-primary hidden md:inline-block max-w-[100px] truncate">
              {activeProfile?.display_name || "Account"}
            </span>
            <ChevronDown className="h-3 w-3 text-text-muted" />
          </button>

          {/* Dropdown Menu */}
          {isProfileMenuOpen && (
            <div className="absolute right-0 mt-2 w-56 rounded-2xl border border-border bg-surface-elevated shadow-lg py-1.5 z-50 animate-in fade-in-50 zoom-in-95">
              <div className="px-3.5 py-2 border-b border-border/70">
                <p className="text-xs font-semibold text-text-primary font-display truncate">
                  {activeProfile?.display_name || "User Account"}
                </p>
                <p className="text-[11px] text-text-muted capitalize">
                  {activeProfile?.relationship_type || "Primary Account"}
                </p>
              </div>

              {/* Profiles Selector if multiple */}
              {profiles.length > 1 && onSelectProfile && (
                <div className="py-1 border-b border-border/70">
                  <div className="px-3.5 py-1 text-[10px] uppercase tracking-wider text-text-muted font-medium">
                    Switch Profile
                  </div>
                  {profiles.map((p) => (
                    <button
                      key={p.id}
                      onClick={() => {
                        onSelectProfile(p.id);
                        setIsProfileMenuOpen(false);
                      }}
                      className={`w-full text-left px-3.5 py-1.5 text-xs flex items-center justify-between hover:bg-surface-subtle ${
                        p.id === activeProfile?.id
                          ? "text-brand font-semibold"
                          : "text-text-secondary"
                      }`}
                    >
                      <span className="truncate">{p.display_name}</span>
                      {p.is_primary && (
                        <span className="text-[10px] text-text-muted">Primary</span>
                      )}
                    </button>
                  ))}
                </div>
              )}

              <div className="py-1">
                <Link
                  href="/profile"
                  onClick={() => setIsProfileMenuOpen(false)}
                  className="flex items-center gap-2 px-3.5 py-2 text-xs text-text-secondary hover:text-text-primary hover:bg-surface-subtle"
                >
                  <User className="h-3.5 w-3.5 text-text-muted" />
                  <span>Profile & Security</span>
                </Link>

                {onImportClick && (
                  <button
                    onClick={() => {
                      onImportClick();
                      setIsProfileMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3.5 py-2 text-xs text-text-secondary hover:text-text-primary hover:bg-surface-subtle"
                  >
                    <Layers className="h-3.5 w-3.5 text-text-muted" />
                    <span>Import Health Data</span>
                  </button>
                )}

                {onPrivacyClick && (
                  <button
                    onClick={() => {
                      onPrivacyClick();
                      setIsProfileMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3.5 py-2 text-xs text-text-secondary hover:text-text-primary hover:bg-surface-subtle"
                  >
                    <Shield className="h-3.5 w-3.5 text-text-muted" />
                    <span>Privacy & Data Rights</span>
                  </button>
                )}
              </div>

              {onLogout && (
                <div className="pt-1 border-t border-border/70">
                  <button
                    onClick={() => {
                      onLogout();
                      setIsProfileMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3.5 py-2 text-xs text-danger hover:bg-danger/10 transition-colors"
                  >
                    <LogOut className="h-3.5 w-3.5 text-danger" />
                    <span>Sign Out</span>
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </header>
  );
}

