'use client';

import { useState } from 'react';
import { OnboardingOrchestrator } from '@/contexts/onboarding/presentation/components/onboarding-orchestrator';
import { Breadcrumbs } from '@/contexts/shared/presentation/components/breadcrumbs';
import { CommandPaletteProvider } from '@/contexts/shared/presentation/components/command-palette';
import { ErrorBoundary } from '@/contexts/shared/presentation/components/error-boundary';
import { ToastProvider } from '@/contexts/shared/presentation/components/toast-provider';
import { Sidebar } from './sidebar';
import { Topbar } from './topbar';

interface DashboardLayoutProps {
  children: React.ReactNode;
  breadcrumb?: string;
}

export function DashboardLayout({ children, breadcrumb }: DashboardLayoutProps) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <ToastProvider>
      <CommandPaletteProvider>
        <div className="flex h-dvh overflow-hidden bg-background">
          <Sidebar
            collapsed={collapsed}
            mobileOpen={mobileOpen}
            onCollapse={setCollapsed}
            onMobileClose={() => setMobileOpen(false)}
          />
          <div className="flex flex-1 flex-col overflow-hidden min-w-0 bg-gradient-to-br from-background via-background to-primary/5">
            <Topbar onMobileMenuOpen={() => setMobileOpen(true)} breadcrumb={breadcrumb} />
            {/* Breadcrumbs bar */}
            <div className="shrink-0 px-4 py-2 sm:px-6 lg:px-8">
              <Breadcrumbs />
            </div>
            <main
              id="main-content"
              data-tour="main-content"
              className="relative flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6 lg:p-8"
            >
              {/* Grid overlay — only covers the content area */}
              <div
                className="pointer-events-none absolute inset-0 opacity-[0.02]"
                style={{
                  backgroundImage:
                    'linear-gradient(to right, hsl(var(--foreground)) 1px, transparent 1px), linear-gradient(to bottom, hsl(var(--foreground)) 1px, transparent 1px)',
                  backgroundSize: '64px 64px',
                }}
                aria-hidden="true"
              />
              <ErrorBoundary>{children}</ErrorBoundary>
            </main>
          </div>
        </div>
        <OnboardingOrchestrator />
      </CommandPaletteProvider>
    </ToastProvider>
  );
}
