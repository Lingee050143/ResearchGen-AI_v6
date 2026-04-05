'use client';
import React from 'react';
import { useResearchStore } from '@/store/useResearchStore';
import { useRouter } from 'next/navigation';

const STEPS = [
  '아이디어 입력', 'AI 분석', '경쟁사 분석', '리뷰 분석',
  '인사이트 맵', '페르소나', '사용자 여정', '기회 지도', 'UX 보고서'
];

export function StepNavigation() {
  const { currentStep } = useResearchStore();
  const router = useRouter();

  const handleStepClick = (stepNum: number) => {
    if (stepNum <= currentStep) {
      router.push(`/steps/${stepNum}`);
    }
  };

  return (
    <div className="bg-[var(--c-surface)] border-b border-[var(--c-border)] px-[28px] flex items-center h-[52px] gap-0 overflow-x-auto scrollbar-hide">
      {STEPS.map((label, i) => {
        const stepNum = i + 1;
        const isActive = currentStep === stepNum;
        const isDone = currentStep > stepNum;

        return (
          <div 
            key={stepNum}
            onClick={() => handleStepClick(stepNum)}
            className={`flex items-center gap-[7px] pr-[14px] relative shrink-0 ${stepNum <= currentStep ? 'cursor-pointer' : 'cursor-not-allowed opacity-50'} ${i !== STEPS.length - 1 ? 'after:content-[""] after:absolute after:right-[4px] after:top-1/2 after:-translate-y-1/2 after:w-[16px] after:h-[1.5px] ' + (isDone ? 'after:bg-[var(--c-primary)]' : 'after:bg-[var(--c-border)]') : ''}`}
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
