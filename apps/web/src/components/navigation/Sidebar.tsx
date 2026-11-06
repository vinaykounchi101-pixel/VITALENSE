"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  HeartPulse,
  TrendingUp,
  Dumbbell,
  Moon,
  ShieldCheck,
  Settings,
  ChevronLeft,
  ChevronRight,
  Activity,
  User,
  Users,
  PlusCircle,
} from "lucide-react";

export interface NavItem {
  name: string;
  href: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const NAV_ITEMS: NavItem[] = [
  { name: "Dashboard", href: "/", icon: LayoutDashboard },
  { name: "Metrics", href: "/metrics", icon: HeartPulse },
  { name: "Trends", href: "/trends", icon: TrendingUp },
  { name: "Activity", href: "/activity", icon: Dumbbell },
  { name: "Sleep", href: "/sleep", icon: Moon },
  { name: "Body Explorer", href: "/body", icon: User },
  { name: "Family", href: "/family", icon: Users },
  { name: "Medical", href: "/medical", icon: ShieldCheck },
  { name: "Settings", href: "/settings", icon: Settings },
];

export function Sidebar({
  onQuickAction,
}: {
  onQuickAction?: () => void;
}) {
  const pathname = usePathname();
  const [isCollapsed, setIsCollapsed] = useState(false);

  return (
    <aside
      className={`hidden md:flex flex-col bg-sidebar border-r border-border transition-all duration-300 select-none z-20 ${
        isCollapsed ? "w-[72px]" : "w-[220px] lg:w-[240px]"
      }`}
    >
      {/* Brand Header */}
      <div className="h-[60px] flex items-center px-4 border-b border-border/70 justify-between">
        <Link href="/" className="flex items-center gap-2.5 overflow-hidden">
          <div className="h-8 w-8 rounded-pill bg-brand text-white flex items-center justify-center shrink-0 shadow-sm">
            <Activity className="h-4 w-4" />
          </div>
          {!isCollapsed && (
            <div className="flex flex-col">
              <span className="font-semibold text-sm tracking-tight text-text-primary font-display">
                VitalSense
              </span>
              <span className="text-[10px] text-text-muted uppercase tracking-wider font-medium">
                Intelligence
              </span>
            </div>
          )}
        </Link>
        <button
          onClick={() => setIsCollapsed(!isCollapsed)}
          aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}
          className="h-7 w-7 rounded-pill hover:bg-surface-subtle flex items-center justify-center text-text-muted hover:text-text-primary transition-colors shrink-0"
        >
          {isCollapsed ? (
            <ChevronRight className="h-4 w-4" />
          ) : (
            <ChevronLeft className="h-4 w-4" />
          )}
        </button>
      </div>

      {/* Quick Action Button */}
      {onQuickAction && (
        <div className="p-3">
          <button
            onClick={onQuickAction}
            className={`w-full flex items-center justify-center gap-2 bg-primary text-primary-text hover:bg-primary-hover font-medium rounded-pill transition-colors shadow-sm active:scale-[0.99] ${
              isCollapsed ? "h-10 px-0" : "h-10 px-4 text-xs"
            }`}
            title="Log manual observation"
          >
            <PlusCircle className="h-4 w-4 shrink-0" />
            {!isCollapsed && <span>Log Vital</span>}
          </button>
        </div>
      )}

      {/* Navigation Items */}
      <nav className="flex-1 px-2.5 py-2 space-y-1 overflow-y-auto">
        {NAV_ITEMS.map((item) => {
          const isActive =
            item.href === "/"
              ? pathname === "/"
              : pathname === item.href || pathname.startsWith(`${item.href}/`);
          const Icon = item.icon;

          return (
            <Link
              key={item.href}
              href={item.href}
              title={isCollapsed ? item.name : undefined}
              className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-xs font-medium transition-colors ${
                isActive
                  ? "bg-surface-elevated text-brand border border-border/80 shadow-xs font-semibold"
                  : "text-text-secondary hover:text-text-primary hover:bg-surface-subtle/80"
              } ${isCollapsed ? "justify-center px-0" : ""}`}
            >
              <Icon
                className={`h-4 w-4 shrink-0 ${
                  isActive ? "text-brand" : "text-text-muted"
                }`}
              />
              {!isCollapsed && <span className="truncate">{item.name}</span>}
            </Link>
          );
        })}
      </nav>

      {/* Footer Info */}
      <div className="p-3 border-t border-border/70 text-[11px] text-text-muted text-center">
        {!isCollapsed ? (
          <div className="flex flex-col gap-0.5">
            <span className="font-medium text-text-secondary">VitalSense v1.1</span>
            <span>Zero-Fabrication Architecture</span>
          </div>
        ) : (
          <span className="font-semibold text-text-muted">v1.1</span>
        )}
      </div>
    </aside>
  );
}

