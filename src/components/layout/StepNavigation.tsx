'use client';
import React from 'react';
import { useResearchStore } from '@/store/useResearchStore';
import { useRouter, usePathname } from 'next/navigation';

const STEPS = [
  '아이디어 입력', 'AI 분석', '경쟁사 분석', '리뷰 분석',
  '인사이트 맵', '페르소나', '사용자 여정', '기회 지도', 'UX 보고서'
];

function canAccessStep(stepNum: number, data: Record<string, unknown>): boolean {
  switch (stepNum) {
    case 1: return true;
    case 2: return !!(data.idea as { serviceName?: string } | undefined)?.serviceName;
    case 3: return !!data.step1Insights;
    case 4: return !!data.competitors;
    case 5: return !!(data.insightsMap as { reviewAnalysis?: unknown } | undefined)?.reviewAnalysis;
    case 6: return !!data.personas;
    case 7: return !!data.journeyMap;
    case 8: return !!data.opportunityMap;
    case 9: return !!data.finalReport;
    default: return false;
  }
}

export function StepNavigation() {
  const { currentStep, data } = useResearchStore();
  const router = useRouter();
  const pathname = usePathname();

  if (pathname === '/dashboard') return null;

  const handleStepClick = (stepNum: number) => {
    if (canAccessStep(stepNum, data as Record<string, unknown>)) {
      router.push(`/steps/${stepNum}`);
    }
  };

  return (
    <div className="bg-[var(--c-surface)] border-b border-[var(--c-border)] px-[28px] flex items-center h-[52px] gap-0 overflow-x-auto scrollbar-hide">
      {STEPS.map((label, i) => {
        const stepNum = i + 1;
        const isActive = currentStep === stepNum;
        const isDone = currentStep > stepNum;
        const accessible = canAccessStep(stepNum, data as Record<string, unknown>);

        return (
          <div
            key={stepNum}
            onClick={() => handleStepClick(stepNum)}
            className={`flex items-center gap-[7px] pr-[14px] relative shrink-0 ${accessible ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'} ${i !== STEPS.length - 1 ? 'after:content-[""] after:absolute after:right-[4px] after:top-1/2 after:-translate-y-1/2 after:w-[16px] after:h-[1.5px] ' + (isDone ? 'after:bg-[var(--c-primary)]' : 'after:bg-[var(--c-border)]') : ''}`}
          >
            <div className={`w-[24px] h-[24px] rounded-full border-2 flex items-center justify-center shrink-0 transition-all ${
              isActive 
                ? 'border-[var(--c-primary)] bg-[var(--c-primary-100)] text-[var(--c-primary)] text-[10px] font-bold' 
                : isDone
                  ? 'bg-[var(--c-primary)] border-[var(--c-primary)] text-white text-[11px] font-bold'
                  : 'border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-neutral-500)] text-[10px] font-bold'
            }`}>
              {isDone ? '✓' : stepNum}
            </div>
            <div className={`text-[11px] whitespace-nowrap ${
              isActive ? 'text-[var(--c-primary)] font-bold' : isDone ? 'text-[var(--c-neutral-700)]' : 'text-[var(--c-neutral-500)]'
            }`}>
              {label.replace(' ', '\n')}
            </div>
          </div>
        );
      })}
    </div>
  );
}
