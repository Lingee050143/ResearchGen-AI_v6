'use client';
import React from 'react';
import { useResearchStore } from '@/store/useResearchStore';

export function TopBar() {
  const { currentStep } = useResearchStore();

  return (
    <div className="h-[52px] bg-[var(--c-surface)] border-b border-[var(--c-border)] flex items-center px-[28px] gap-[12px] sticky top-0 z-50 shrink-0">
      <div className="flex items-center gap-[6px] text-[12.5px] text-[var(--c-neutral-500)]">
        <span className="cursor-pointer hover:text-[var(--c-primary)]">프로젝트</span>
        <span className="text-[var(--c-neutral-300)]">/</span>
        <span className="text-[var(--c-neutral-900)] font-semibold">신규 리서치</span>
      </div>
      
      <div className="flex items-center gap-[6px] ml-[8px]">
        <span className="text-[11.5px] font-semibold text-[var(--c-neutral-700)]">App V6</span>
        <div className="flex items-center gap-[4px] text-[10.5px] font-semibold text-[var(--c-ai)] bg-[var(--c-ai-subtle)] px-[8px] py-[2px] rounded-full">
          ✦ AI-Assisted
        </div>
      </div>
      
      <div className="ml-auto text-[11.5px] text-[var(--c-neutral-500)] font-medium">
        Step {currentStep} / 9
      </div>
    </div>
  );
}
