'use client';
import React, { useEffect, useState } from 'react';
import { useResearchStore } from '@/store/useResearchStore';
import { useRouter } from 'next/navigation';
import { Button } from '../ui/Button';
import { UploadZone } from '../ui/UploadZone';
import Papa from 'papaparse';

export function Step3() {
  const { data, updateData, setStep } = useResearchStore();
  const router = useRouter();
  
  const [competitors, setCompetitors] = useState<any[]>(data.competitors || [
    { id: 1, name: '', reviews: [], nameInput: '' },
    { id: 2, name: '', reviews: [], nameInput: '' },
    { id: 3, name: '', reviews: [], nameInput: '' },
    { id: 4, name: '', reviews: [], nameInput: '' },
  ]);

  useEffect(() => {
    setStep(3);
  }, [setStep]);

  const handleFileUpload = (id: number, file: File) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (results) => {
        // Sample max 500 reviews
        const sampled = results.data.slice(0, 500);
        
        setCompetitors(prev => prev.map(c => 
          c.id === id ? { ...c, reviews: sampled } : c
        ));
      }
    });
  };

  const updateName = (id: number, name: string) => {
    setCompetitors(prev => prev.map(c => c.id === id ? { ...c, nameInput: name, name } : c));
  };

  const handleNext = () => {
    updateData('competitors', competitors);
    router.push('/steps/4');
  };

  const hasData = competitors.some(c => c.reviews.length > 0);

  return (
    <>
      <div className="flex items-center gap-[8px] mb-[8px]">
        <div className="w-[32px] h-[32px] bg-[var(--c-primary-100)] rounded-[8px] flex items-center justify-center text-[16px]">🎯</div>
        <div className="text-[11px] font-bold tracking-[0.1em] uppercase text-[var(--c-primary)]">STEP 3</div>
      </div>
      <h1 className="text-[26px] font-[800] text-[var(--c-neutral-900)] tracking-[-0.02em] mb-[6px]">
        경쟁사 리서치
      </h1>
      <p className="text-[13.5px] text-[var(--c-neutral-500)] mb-[32px]">
        경쟁사의 리뷰 데이터를 업로드하세요. 클라이언트 단에서 최대 500건으로 자동 샘플링됩니다.
      </p>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-[16px]">
        {competitors.map((comp) => (
          <div key={comp.id} className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[var(--r-md)] p-[20px] shadow-[var(--shadow-sm)]">
            <div className="flex items-center justify-between mb-3">
              <span className="text-[11.5px] font-bold text-[var(--c-primary)] bg-[var(--c-primary-100)] px-2 py-0.5 rounded-full">경쟁사 {comp.id}</span>
              {comp.reviews.length > 0 && (
                <span className="text-[10px] text-[var(--c-success)] bg-[var(--c-success-subtle)] px-2 py-0.5 rounded-full font-bold">
                  {comp.reviews.length}건 샘플링됨
                </span>
              )}
            </div>
            
            <input 
              type="text" 
              value={comp.nameInput}
              onChange={(e) => updateName(comp.id, e.target.value)}
              placeholder={`경쟁사 ${comp.id} 이름`}
              className="w-full border-[1.5px] border-[var(--c-neutral-300)] rounded-[var(--r-sm)] p-[8px_12px] text-[13px] outline-none focus:border-[var(--c-primary)] mb-4"
            />
            
            {comp.reviews.length === 0 ? (
              <UploadZone onFileAccepted={(file) => handleFileUpload(comp.id, file)} />
            ) : (
              <div className="bg-[var(--c-success-subtle)] border border-[#A7F3D0] rounded-[var(--r-sm)] p-[12px] flex items-center justify-between">
                <span className="text-[12px] font-bold text-[#065F46] flex items-center gap-2">✓ 데이터 준비 완료</span>
                <button 
                  onClick={() => setCompetitors(prev => prev.map(c => c.id === comp.id ? { ...c, reviews: [] } : c))}
                  className="text-[11px] text-[var(--c-neutral-500)] hover:text-[#B91C1C] underline"
                >
                  다시 업로드
                </button>
              </div>
            )}
            <div className="text-[10.5px] text-[var(--c-neutral-500)] mt-3">대표 샘플 500건 기반 분석됩니다.</div>
          </div>
        ))}
      </div>

      <div className="fixed bottom-0 left-0 md:left-[var(--sidebar-w)] right-0 bg-[var(--c-surface)] border-t border-[var(--c-border)] p-[12px_28px] flex items-center justify-between z-[100] shadow-[0_-4px_16px_rgba(26,24,64,0.06)]">
        <div className="flex items-center gap-[10px]">
          <span className="text-[11.5px] text-[var(--c-neutral-500)]">진행률 35%</span>
          <div className="w-[100px] h-[4px] bg-[var(--c-border)] rounded-[2px] overflow-hidden">
            <div className="h-full bg-[var(--c-primary)] w-[35%] transition-all"></div>
          </div>
        </div>
        <div className="flex items-center gap-[10px]">
          <Button variant="ghost" onClick={() => router.push('/steps/2')}>이전</Button>
          <Button variant="primary" disabled={!hasData} onClick={handleNext}>
            다음 단계
          </Button>
        </div>
      </div>
    </>
  );
}
