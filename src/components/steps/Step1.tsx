'use client';
import React, { useEffect } from 'react';
import { useResearchStore } from '@/store/useResearchStore';
import { useRouter } from 'next/navigation';
import { Button } from '../ui/Button';
import { TagInput } from '../ui/TagInput';
import { UploadZone } from '../ui/UploadZone';
import { Lightbulb, Info } from 'lucide-react';

export function Step1() {
  const { data, updateData, setStep } = useResearchStore();
  const router = useRouter();
  
  const [uploadedFile, setUploadedFile] = React.useState<string | null>(null);

  const idea = {
    serviceName: data.idea?.serviceName || '',
    problem: data.idea?.problem || '',
    scenario: data.idea?.scenario || '',
    targetUser: data.idea?.targetUser || '',
    tags: data.idea?.tags || [],
  };

  const handleChange = (field: string, value: any) => {
    updateData('idea', { [field]: value }, true);
  };

  const isFormValid = idea.serviceName?.length >= 2 && idea.problem?.length >= 2 && idea.scenario?.length >= 2 && idea.tags?.length > 0;

  useEffect(() => {
    setStep(1);
    if (data.reviews && data.reviews.length > 0) {
      setUploadedFile('기존 업로드된 데이터');
    }
  }, [setStep, data.reviews]);

  const handleFileUpload = (file: File) => {
    import('papaparse').then((Papa) => {
      Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete: (results) => {
          const sampled = results.data.slice(0, 500);
          updateData('reviews', sampled, true);
          setUploadedFile(file.name);
        }
      });
    });
  };

  const handleNext = () => {
    if (isFormValid) {
      router.push('/steps/2');
    }
  };

  return (
    <>
      <div className="flex items-center gap-[8px] mb-[8px]">
        <div className="w-[32px] h-[32px] bg-[var(--c-primary-100)] rounded-[8px] flex items-center justify-center text-[16px]">💡</div>
        <div className="text-[11px] font-bold tracking-[0.1em] uppercase text-[var(--c-primary)]">STEP 1</div>
      </div>
      <h1 className="text-[26px] font-[800] text-[var(--c-neutral-900)] tracking-[-0.02em] mb-[6px]">
        아이디어 입력
      </h1>
      <p className="text-[13.5px] text-[var(--c-neutral-500)] mb-[32px]">
        분석할 제품 아이디어와 리서치 범위를 설정하세요
      </p>

      <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[var(--r-lg)] p-[24px_26px] shadow-[var(--shadow-sm)] mb-[16px] transition-shadow focus-within:shadow-[var(--shadow-md)] focus-within:border-[var(--c-primary-200)]">
        <div className="flex flex-col gap-[18px]">
          
          <div className="flex flex-col">
            <label className="text-[12px] font-bold text-[var(--c-neutral-900)] mb-[5px] flex items-center gap-[6px]">
              서비스 이름 <span className="text-[var(--c-error)] text-[13px]">*</span>
            </label>
            <input 
              type="text" 
              value={idea.serviceName}
              onChange={(e) => handleChange('serviceName', e.target.value)}
              className="border-[1.5px] border-[var(--c-neutral-300)] rounded-[var(--r-sm)] p-[10px_13px] text-[13px] text-[var(--c-neutral-900)] bg-[var(--c-surface)] outline-none transition-all hover:border-[var(--c-neutral-500)] focus:border-[var(--c-primary)] focus:ring-[3px] focus:ring-[rgba(79,70,229,0.1)]"
              placeholder="예: PocketBudget — Gen Z를 위한 개인 재무 관리"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-[16px]">
            <div className="flex flex-col">
              <label className="text-[12px] font-bold text-[var(--c-neutral-900)] mb-[5px] flex items-center gap-[6px]">
                문제 정의 <span className="text-[var(--c-error)] text-[13px]">*</span>
              </label>
              <textarea 
                rows={3}
                value={idea.problem}
                onChange={(e) => handleChange('problem', e.target.value)}
                className="border-[1.5px] border-[var(--c-neutral-300)] rounded-[var(--r-sm)] p-[10px_13px] text-[13px] text-[var(--c-neutral-900)] bg-[var(--c-surface)] outline-none transition-all hover:border-[var(--c-neutral-500)] focus:border-[var(--c-primary)] focus:ring-[3px] focus:ring-[rgba(79,70,229,0.1)] resize-none"
                placeholder="사용자가 겪는 핵심 문제는 무엇인가요?"
              />
            </div>
            <div className="flex flex-col">
              <label className="text-[12px] font-bold text-[var(--c-neutral-900)] mb-[5px] flex items-center gap-[6px]">
                사용자 시나리오 <span className="text-[var(--c-error)] text-[13px]">*</span>
              </label>
              <textarea 
                rows={3}
                value={idea.scenario}
                onChange={(e) => handleChange('scenario', e.target.value)}
                className="border-[1.5px] border-[var(--c-neutral-300)] rounded-[var(--r-sm)] p-[10px_13px] text-[13px] text-[var(--c-neutral-900)] bg-[var(--c-surface)] outline-none transition-all hover:border-[var(--c-neutral-500)] focus:border-[var(--c-primary)] focus:ring-[3px] focus:ring-[rgba(79,70,229,0.1)] resize-none"
                placeholder="어떤 상황에서 이 기능이 사용되나요?"
              />
              <div className="text-[11px] text-[var(--c-ai)] mt-[5px] flex items-center gap-[4px]">
                ✨ 구체적일수록 분석 품질이 올라갑니다
              </div>
            </div>
          </div>

          <div className="h-[1px] bg-[var(--c-border)] my-[18px]"></div>

          <div className="flex flex-col">
            <label className="text-[12px] font-bold text-[var(--c-neutral-900)] mb-[5px] flex items-center gap-[6px]">
              핵심 기능 <span className="text-[var(--c-error)] text-[13px]">*</span>
            </label>
            <TagInput 
              tags={idea.tags} 
              onChange={(tags) => handleChange('tags', tags)} 
            />
          </div>

          <div className="flex flex-col mt-[18px]">
            <div className="flex items-center gap-[6px] mb-[6px]">
              <div className="w-[28px] h-[28px] rounded-[7px] flex items-center justify-center text-[14px] bg-[var(--c-neutral-100)]">
                <Lightbulb className="w-4 h-4 text-[var(--c-neutral-500)]" />
              </div>
              <span className="text-[14px] font-bold text-[var(--c-neutral-900)]">추가 정보</span>
            </div>
            <div className="pl-[38px]">
              <label className="text-[12px] font-bold text-[var(--c-neutral-900)] mb-[5px] flex items-center gap-[6px]">
                타겟 사용자 <span className="text-[10.5px] font-medium text-[var(--c-neutral-500)] bg-[var(--c-neutral-100)] px-[7px] py-[1px] rounded-full">선택</span>
              </label>
              <input 
                type="text" 
                value={idea.targetUser}
                onChange={(e) => handleChange('targetUser', e.target.value)}
                className="border-[1.5px] border-[var(--c-neutral-300)] rounded-[var(--r-sm)] p-[10px_13px] text-[13px] text-[var(--c-neutral-900)] bg-[var(--c-surface)] outline-none transition-all hover:border-[var(--c-neutral-500)] focus:border-[var(--c-primary)] focus:ring-[3px] focus:ring-[rgba(79,70,229,0.1)] w-full block mb-[4px]"
                placeholder="예: 25-35세 프리랜서, 비회계 전공자"
              />
              <div className="text-[10.5px] text-[var(--c-neutral-500)]">입력하지 않으면 AI가 자동으로 분석합니다</div>

              <div className="mt-[18px]">
                <label className="text-[12px] font-bold text-[var(--c-neutral-900)] mb-[5px] flex items-center gap-[6px]">
                  데이터 업로드 <span className="text-[10.5px] font-medium text-[var(--c-neutral-500)] bg-[var(--c-neutral-100)] px-[7px] py-[1px] rounded-full">선택</span>
                </label>
                {uploadedFile ? (
                  <div className="bg-[var(--c-success-subtle)] border border-[#A7F3D0] rounded-[var(--r-sm)] p-[16px] flex items-center justify-between">
                    <div className="flex items-center gap-2">
                       <span className="text-[12px] font-bold text-[#065F46]">✓ {uploadedFile}</span>
                    </div>
                    <button 
                      onClick={() => {
                        updateData('reviews', [], true);
                        setUploadedFile(null);
                      }}
                      className="text-[11px] text-[var(--c-neutral-500)] hover:text-[#B91C1C] underline"
                    >
                      변경하기
                    </button>
                  </div>
                ) : (
                  <UploadZone onFileAccepted={handleFileUpload} />
                )}
              </div>
            </div>
          </div>

        </div>
      </div>

      <div className="fixed bottom-0 left-0 md:left-[var(--sidebar-w)] right-0 bg-[var(--c-surface)] border-t border-[var(--c-border)] p-[12px_28px] flex items-center justify-between z-[100] shadow-[0_-4px_16px_rgba(26,24,64,0.06)]">
        <div className="flex items-center gap-[10px]">
          <span className="text-[11.5px] text-[var(--c-neutral-500)]">진행률 10%</span>
          <div className="w-[100px] h-[4px] bg-[var(--c-border)] rounded-[2px] overflow-hidden">
            <div className="h-full bg-[var(--c-primary)] w-[10%] transition-all"></div>
          </div>
        </div>
        <div className="flex items-center gap-[10px]">
          <Button variant="primary" disabled={!isFormValid} onClick={handleNext}>
            입력 완료 및 다음 단계
          </Button>
        </div>
      </div>
    </>
  );
}
