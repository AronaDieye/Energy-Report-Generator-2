import React from "react";
import { Link } from "wouter";
import { Activity, LayoutDashboard, FileText, Settings } from "lucide-react";

interface LayoutProps {
  children: React.ReactNode;
}

export function Layout({ children }: LayoutProps) {
  const baseUrl = import.meta.env.BASE_URL.replace(/\/$/, "");

  return (
    <div className="min-h-screen flex bg-muted/30">
      {/* Sidebar */}
      <aside className="w-64 bg-card border-r flex flex-col hidden md:flex">
        <div className="h-16 flex items-center px-6 border-b">
          <Activity className="h-6 w-6 text-primary mr-2" />
          <span className="font-bold text-lg tracking-tight">AuditTech Pro</span>
        </div>
        <nav className="flex-1 px-4 py-6 space-y-1">
          <Link
            href="/"
            className="flex items-center px-3 py-2 text-sm font-medium rounded-md bg-primary/10 text-primary"
          >
            <LayoutDashboard className="h-5 w-5 mr-3" />
            Tableau de bord
          </Link>
        </nav>
        <div className="p-4 border-t text-xs text-muted-foreground">
          Version 1.0.0
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0">
        <header className="h-16 bg-card border-b flex items-center justify-between px-6 md:hidden">
          <div className="flex items-center">
            <Activity className="h-6 w-6 text-primary mr-2" />
            <span className="font-bold text-lg tracking-tight">AuditTech Pro</span>
          </div>
        </header>
        <div className="flex-1 overflow-auto">
          <div className="max-w-7xl mx-auto py-8 px-4 sm:px-6 md:px-8">
            {children}
          </div>
        </div>
      </main>
    </div>
  );
}
