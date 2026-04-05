'use client';
import React, { useEffect, useState } from 'react';
import { useResearchStore } from '@/store/useResearchStore';
import { useRouter } from 'next/navigation';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { Card, CardTitle, CardSub } from '../ui/Card';
import { useApiKey } from '../ui/ApiKeyModal';
import { runClaudeWithRetry, buildContextMetadata } from '@/lib/claudeEngine';
import { z } from 'zod';

const Step2Schema = z.object({
  hmwQuestions: z.array(z.object({
    id: z.string(),
    question: z.string(),
    reason: z.string(),
    confidence: z.number(),
  }))
});

type Step2Result = z.infer<typeof Step2Schema>;

export function Step2() {
  const { data, updateData, setStep, userOverrides } = useResearchStore();
  const router = useRouter();
  const { apiKey } = useApiKey();
  
  const [loading, setLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [error, setError] = useState('');
  const [selectedHmw, setSelectedHmw] = useState<string[]>([]);
  
  const step2Insights = data.step1Insights as Step2Result | undefined;

  useEffect(() => {
    setStep(2);
    if (!step2Insights && apiKey) {
      generateInsights();
    }
  }, [setStep, apiKey]);

  const generateInsights = async () => {
    if (!apiKey) return;
    setLoading(true);
    setError('');
    
    try {
      const context = buildContextMetadata({ idea: data.idea }, userOverrides);
      const result = await runClaudeWithRetry(
        apiKey,
        {
          system: 'You are an expert UX Researcher. Based on the user idea and context, generate 3-5 "How Might We (HMW)" questions that identify core opportunities. Return ONLY valid JSON matching the schema.',
          messages: [
            { role: 'user', content: `Context: ${context}\nGenerate HMW questions in JSON format: { "hmwQuestions": [{ "id": "hmw1", "question": "HMW...", "reason": "...", "confidence": 85 }] }` }
          ]
        },
        Step2Schema,
        setProgressMsg
      );
      
      updateData('step1Insights', result);
    } catch (err: any) {
      setError(err.message || '분석 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleNext = () => {
    updateData('step1Insights', { selectedHmw }, true);
    router.push('/steps/3');
  };

  const toggleHmw = (id: string) => {
    setSelectedHmw(prev => 
      prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
    );
  };

  return (
    <>
      <div className="flex items-center gap-[8px] mb-[8px]">
        <div className="w-[32px] h-[32px] bg-[var(--c-primary-100)] rounded-[8px] flex items-center justify-center text-[16px]">🧠</div>
        <div className="text-[11px] font-bold tracking-[0.1em] uppercase text-[var(--c-primary)]">STEP 2</div>
      </div>
      <h1 className="text-[26px] font-[800] text-[var(--c-neutral-900)] tracking-[-0.02em] mb-[6px]">
        AI 문제 도출 (HMW)
      </h1>
      <p className="text-[13.5px] text-[var(--c-neutral-500)] mb-[32px]">
        입력된 아이디어를 바탕으로 핵심 기회를 탐색합니다.
      </p>

      {loading ? (
        <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[var(--r-lg)] p-[32px] text-center flex flex-col items-center justify-center">
          <div className="w-[8px] h-[8px] rounded-full bg-[var(--c-ai-processing)] animate-pulse mb-4"></div>
          <p className="text-[14px] font-bold text-[var(--c-ai)]">{progressMsg || 'AI가 컨텍스트를 분석하고 있습니다...'}</p>
        </div>
      ) : error ? (
        <div className="bg-[#FEF2F2] border border-[#FCA5A5] rounded-[var(--r-md)] p-[16px]">
          <p className="text-[#B91C1C] text-[13px] font-semibold flex items-center gap-2">⚠️ {error}</p>
          <Button variant="secondary" size="sm" className="mt-3" onClick={generateInsights}>재시도</Button>
        </div>
      ) : step2Insights?.hmwQuestions ? (
        <div className="grid grid-cols-1 gap-[12px]">
          {step2Insights.hmwQuestions.map((hmw) => {
            const isSelected = selectedHmw.includes(hmw.id);
            return (
              <div 
                key={hmw.id} 
                className={`bg-[var(--c-surface)] border ${isSelected ? 'border-[var(--c-primary)] ring-1 ring-[var(--c-primary)]' : 'border-[var(--c-border)]'} rounded-[var(--r-md)] p-[20px] cursor-pointer transition-all hover:border-[var(--c-primary-200)]`}
                onClick={() => toggleHmw(hmw.id)}
              >
                <div className="flex items-start gap-[12px]">
                  <input 
                    type="checkbox" 
                    checked={isSelected}
                    onChange={() => {}} // handled by parent div onClick
                    className="mt-1 w-4 h-4 text-[var(--c-primary)] border-[var(--c-neutral-300)] rounded focus:ring-[var(--c-primary)]"
                  />
                  <div className="flex-1">
                    <div className="flex justify-between items-start mb-2">
                      <h3 className="text-[15px] font-bold text-[var(--c-neutral-900)] leading-snug">{hmw.question}</h3>
                      <Badge variant="ai">신뢰도 {hmw.confidence}%</Badge>
                    </div>
                    <p className="text-[12.5px] text-[var(--c-neutral-500)]">{hmw.reason}</p>
                    <div className="w-full bg-[var(--c-neutral-100)] h-[4px] rounded-full mt-3 overflow-hidden">
                      <div className="h-full bg-[var(--c-primary)] rounded-full" style={{ width: `${hmw.confidence}%` }}></div>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-10 text-[var(--c-neutral-500)]">데이터를 불러올 수 없습니다.</div>
      )}

      <div className="fixed bottom-0 left-0 md:left-[var(--sidebar-w)] right-0 bg-[var(--c-surface)] border-t border-[var(--c-border)] p-[12px_28px] flex items-center justify-between z-[100] shadow-[0_-4px_16px_rgba(26,24,64,0.06)]">
        <div className="flex items-center gap-[10px]">
          <span className="text-[11.5px] text-[var(--c-neutral-500)]">진행률 20%</span>
          <div className="w-[100px] h-[4px] bg-[var(--c-border)] rounded-[2px] overflow-hidden">
            <div className="h-full bg-[var(--c-primary)] w-[20%] transition-all"></div>
          </div>
        </div>
        <div className="flex items-center gap-[10px]">
          <Button variant="ghost" onClick={() => router.push('/steps/1')}>이전</Button>
          <Button variant="primary" disabled={loading || selectedHmw.length === 0} onClick={handleNext}>
            우선순위 저장 및 다음
          </Button>
        </div>
      </div>
    </>
  );
}
