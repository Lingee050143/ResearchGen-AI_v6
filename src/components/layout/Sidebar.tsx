'use client';
import React from 'react';
import Link from 'next/link';
import { useResearchStore } from '@/store/useResearchStore';
import { Search } from 'lucide-react';

const STEPS = [
  '아이디어 입력', 'AI 분석', '경쟁사 분석', '리뷰 분석',
  '인사이트 맵', '페르소나', '사용자 여정', '기회 지도', 'UX 보고서'
];

export function Sidebar() {
  const { currentStep } = useResearchStore();

  return (
    <aside className="hidden md:flex flex-col flex-shrink-0 w-[var(--sidebar-w)] bg-[var(--c-sidebar-bg)] h-screen sticky top-0 overflow-y-auto pb-[24px]">
      <div className="p-[20px_16px_16px] border-b border-[rgba(255,255,255,0.06)] mb-[8px]">
        <div className="flex items-center gap-[8px]">
          <div className="w-[28px] h-[28px] bg-[var(--c-ai)] rounded-[7px] flex items-center justify-center text-[14px] text-white">
            <Search className="w-4 h-4" />
          </div>
          <div>
            <div className="text-[13px] font-bold text-white tracking-[-0.01em] leading-tight">ResearchGen</div>
            <div className="text-[9.5px] text-[var(--c-sidebar-text)] mt-[1px] tracking-[0.04em]">AI UX Research</div>
          </div>
        </div>
      </div>

      <div className="text-[9px] font-bold tracking-[0.12em] uppercase text-[#4A4870] p-[12px_16px_4px]">대시보드</div>
      <Link href="/" className="flex items-center gap-[9px] p-[7px_14px] m-[1px_8px] rounded-[var(--r-sm)] text-[12px] text-[var(--c-sidebar-text)] hover:bg-[rgba(255,255,255,0.06)] hover:text-[#e0e0f0] transition-all">
        <div className="w-[18px] h-[18px] rounded-full border-[1.5px] border-[rgba(255,255,255,0.15)] flex items-center justify-center text-[14px] text-[rgba(255,255,255,0.4)]">⊞</div>
        대시보드
      </Link>

      <div className="text-[9px] font-bold tracking-[0.12em] uppercase text-[#4A4870] p-[12px_16px_4px] mt-2">현재 프로젝트</div>
      
      {STEPS.map((label, i) => {
        const stepNum = i + 1;
        const isActive = currentStep === stepNum;
        const isDone = currentStep > stepNum;
        
        return (
          <Link 
            key={stepNum}
            href={`/steps/${stepNum}`}
            className={`flex items-center gap-[9px] p-[7px_14px] m-[1px_8px] rounded-[var(--r-sm)] text-[12px] transition-all relative ${
              isActive 
                ? 'bg-[rgba(14,165,233,0.18)] text-white font-semibold before:content-[""] before:absolute before:-left-[8px] before:top-1/2 before:-translate-y-1/2 before:w-[3px] before:h-[18px] before:bg-[var(--c-ai)] before:rounded-[0_2px_2px_0]' 
                : 'text-[var(--c-sidebar-text)] hover:bg-[rgba(255,255,255,0.06)] hover:text-[#e0e0f0]'
            }`}
          >
            <div className={`w-[18px] h-[18px] rounded-full border-[1.5px] flex items-center justify-center text-[9.5px] font-bold shrink-0 ${
              isActive 
                ? 'bg-[var(--c-ai)] border-[var(--c-ai)] text-white' 
                : isDone 
                  ? 'bg-[var(--c-success)] border-[var(--c-success)] text-white'
                  : 'border-[rgba(255,255,255,0.15)] text-[rgba(255,255,255,0.4)]'
            }`}>
              {isDone ? '✓' : stepNum}
            </div>
            {label}
          </Link>
        );
      })}

      <div className="mt-auto p-[12px_8px_0] border-t border-[rgba(255,255,255,0.06)]">
        <div className="flex items-center gap-[7px] p-[8px_10px] bg-[rgba(16,185,129,0.1)] rounded-[var(--r-sm)] text-[11px] text-[#6EE7B7]">
          <div className="w-[6px] h-[6px] rounded-full bg-[var(--c-success)] shrink-0 animate-pulse"></div>
          실제 AI 연동됨
        </div>
      </div>
    </aside>
  );
}
