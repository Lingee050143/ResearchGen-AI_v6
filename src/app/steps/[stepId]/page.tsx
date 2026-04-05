'use client';
import React, { use } from 'react';
import { Step1 } from '@/components/steps/Step1';
import { Step2 } from '@/components/steps/Step2';
import { Step3 } from '@/components/steps/Step3';
// ... Will implement other steps later ...

export default function StepPage({ params }: { params: Promise<{ stepId: string }> }) {
  // Access resolved params using React.use
  const resolvedParams = use(params);
  const stepId = parseInt(resolvedParams.stepId);
  
  if (stepId === 1) return <Step1 />;
  if (stepId === 2) return <Step2 />;
  if (stepId === 3) return <Step3 />;
  
  return (
    <div>
      <div className="flex items-center gap-[8px] mb-[8px]">
        <div className="w-[32px] h-[32px] bg-[var(--c-primary-100)] rounded-[8px] flex items-center justify-center text-[16px]">🚧</div>
        <div className="text-[11px] font-bold tracking-[0.1em] uppercase text-[var(--c-primary)]">STEP {stepId}</div>
      </div>
      <h1 className="text-[26px] font-[800] text-[var(--c-neutral-900)] tracking-[-0.02em] mb-[6px]">
        개발 진행 중
      </h1>
      <p className="text-[13.5px] text-[var(--c-neutral-500)] mb-[32px]">
        {stepId}단계 기능은 구현 중입니다.
      </p>
    </div>
  );
}
