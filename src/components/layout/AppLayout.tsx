import React from 'react';
import { Sidebar } from './Sidebar';
import { TopBar } from './TopBar';
import { StepNavigation } from './StepNavigation';

export function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen w-full overflow-hidden bg-[var(--c-bg)]">
      <Sidebar />
      <div className="flex-1 flex flex-col min-h-screen overflow-y-auto">
        <TopBar />
        <StepNavigation />
        <main className="flex-1 p-[36px_28px_120px] max-w-[860px] w-full mx-auto relative">
          {children}
        </main>
      </div>
    </div>
  );
}
