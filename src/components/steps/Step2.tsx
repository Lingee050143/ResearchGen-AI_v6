'use client';
import React, { useEffect, useState } from 'react';
import { useResearchStore } from '@/store/useResearchStore';
import { useRouter } from 'next/navigation';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { useApiKey } from '../ui/ApiKeyModal';
import { runClaudeWithRetry, buildContextMetadata, generateAICompetitors, Competitor } from '@/lib/claudeEngine';
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

interface LocalCompetitor {
  id: number;
  name: string;
  nameInput: string;
  description: string;
  pros: string[];
  cons: string[];
  links: { web?: string; playStore?: string; appStore?: string };
  reviews: any[];
}

function toLocalCompetitor(c: Competitor, id: number): LocalCompetitor {
  return {
    id,
    name: c.name,
    nameInput: c.name,
    description: c.description,
    pros: c.pros,
    cons: c.cons,
    links: c.links,
    reviews: [],
  };
}

export function Step2() {
  const { data, updateData, setStep, userOverrides } = useResearchStore();
  const router = useRouter();
  const { apiKey } = useApiKey();

  const [loading, setLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [error, setError] = useState('');
  const [selectedHmw, setSelectedHmw] = useState<string[]>([]);

  const [aiLoading, setAiLoading] = useState(false);
  const [aiProgressMsg, setAiProgressMsg] = useState('');
  const [aiError, setAiError] = useState('');
  const [localCompetitors, setLocalCompetitors] = useState<LocalCompetitor[]>(
    () => {
      const saved = data.competitors;
      if (Array.isArray(saved) && saved.length === 4 && saved[0]?.description) return saved;
      return [];
    }
  );

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

  const handleAICompetitors = async () => {
    if (!apiKey) return;
    setAiLoading(true);
    setAiError('');
    setAiProgressMsg('');
    try {
      const ideaText = typeof data.idea === 'object' ? JSON.stringify(data.idea) : String(data.idea || '');
      const result = await generateAICompetitors(ideaText, apiKey, setAiProgressMsg);
      const mapped = result.competitors.map((c, i) => toLocalCompetitor(c, i + 1));
      setLocalCompetitors(mapped);
      updateData('competitors', mapped);
    } catch (err: any) {
      setAiError(err.message || 'AI 경쟁사 분석 중 오류가 발생했습니다.');
    } finally {
      setAiLoading(false);
    }
  };

  const updateCompetitorField = (id: number, field: keyof LocalCompetitor, value: any) => {
    setLocalCompetitors(prev => {
      const next = prev.map(c => c.id === id ? { ...c, [field]: value, ...(field === 'name' ? { nameInput: value } : {}) } : c);
      updateData('competitors', next);
      return next;
    });
  };

  const updatePro = (id: number, index: number, value: string) => {
    setLocalCompetitors(prev => {
      const next = prev.map(c => {
        if (c.id !== id) return c;
        const pros = [...c.pros];
        pros[index] = value;
        return { ...c, pros };
      });
      updateData('competitors', next);
      return next;
    });
  };

  const updateCon = (id: number, index: number, value: string) => {
    setLocalCompetitors(prev => {
      const next = prev.map(c => {
        if (c.id !== id) return c;
        const cons = [...c.cons];
        cons[index] = value;
        return { ...c, cons };
      });
      updateData('competitors', next);
      return next;
    });
  };

  const updateLink = (id: number, linkKey: 'web' | 'playStore' | 'appStore', value: string) => {
    setLocalCompetitors(prev => {
      const next = prev.map(c => c.id !== id ? c : { ...c, links: { ...c.links, [linkKey]: value } });
      updateData('competitors', next);
      return next;
    });
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
      <p className="text-[13.5px] text-[var(--c-neutral-500)] mb-[24px]">
        입력된 아이디어를 바탕으로 핵심 기회를 탐색합니다.
      </p>

      {/* ─── AI 경쟁사 추천 섹션 ─── */}
      <div className="mb-[36px]">
        <div className="flex items-center justify-between mb-[16px]">
          <div>
            <h2 className="text-[15px] font-[700] text-[var(--c-neutral-900)]">경쟁사 AI 발굴</h2>
            <p className="text-[12px] text-[var(--c-neutral-500)] mt-[2px]">AI가 스토어 링크 포함 4개의 경쟁사를 자동으로 탐색합니다.</p>
          </div>
          <button
            onClick={handleAICompetitors}
            disabled={aiLoading || !apiKey}
            className="inline-flex items-center gap-[8px] px-[20px] py-[11px] rounded-[var(--r-sm)] font-[700] text-[13.5px] text-white transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-400"
            style={{
              background: aiLoading
                ? 'linear-gradient(135deg, #9CA3AF, #6B7280)'
                : 'linear-gradient(135deg, #7C3AED, #4F46E5)',
              boxShadow: aiLoading ? 'none' : '0 4px 14px rgba(124,58,237,0.35)',
            }}
          >
            {aiLoading ? (
              <>
                <span className="w-[14px] h-[14px] border-[2px] border-white border-t-transparent rounded-full animate-spin" />
                탐색 중...
              </>
            ) : (
              <>
                ✨ AI에게 경쟁사 추천받기
              </>
            )}
          </button>
        </div>

        {aiLoading && (
          <div className="bg-[var(--c-surface)] border border-purple-200 rounded-[var(--r-md)] p-[20px] flex items-center gap-[14px]">
            <div className="w-[10px] h-[10px] rounded-full bg-purple-500 animate-pulse shrink-0" />
            <p className="text-[13px] text-purple-700 font-semibold">
              {aiProgressMsg || 'AI가 시장에서 스토어 링크와 경쟁사를 탐색 중입니다...'}
            </p>
          </div>
        )}

        {aiError && !aiLoading && (
          <div className="bg-[#FEF2F2] border border-[#FCA5A5] rounded-[var(--r-md)] p-[14px] flex items-center justify-between">
            <p className="text-[#B91C1C] text-[12.5px] font-semibold">⚠️ {aiError}</p>
            <Button variant="secondary" size="sm" onClick={handleAICompetitors}>재시도</Button>
          </div>
        )}

        {localCompetitors.length === 4 && !aiLoading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-[14px]">
            {localCompetitors.map((comp) => (
              <div
                key={comp.id}
                className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[var(--r-md)] p-[18px] shadow-[var(--shadow-sm)]"
              >
                {/* 헤더 */}
                <div className="flex items-center justify-between mb-[12px]">
                  <span className="text-[10.5px] font-bold text-purple-700 bg-purple-100 px-[8px] py-[3px] rounded-full">경쟁사 {comp.id}</span>
                  {comp.links.web && (
                    <a href={comp.links.web} target="_blank" rel="noopener noreferrer" className="text-[10.5px] text-[var(--c-primary)] underline truncate max-w-[130px]">
                      🌐 웹사이트
                    </a>
                  )}
                </div>

                {/* 이름 */}
                <input
                  type="text"
                  value={comp.name}
                  onChange={(e) => updateCompetitorField(comp.id, 'name', e.target.value)}
                  placeholder="경쟁사 이름"
                  className="w-full border-[1.5px] border-[var(--c-neutral-300)] rounded-[var(--r-sm)] p-[7px_11px] text-[13.5px] font-bold outline-none focus:border-purple-400 mb-[8px]"
                />

                {/* 설명 */}
                <input
                  type="text"
                  value={comp.description}
                  onChange={(e) => updateCompetitorField(comp.id, 'description', e.target.value)}
                  placeholder="한 줄 설명"
                  className="w-full border-[1.5px] border-[var(--c-neutral-300)] rounded-[var(--r-sm)] p-[7px_11px] text-[12px] text-[var(--c-neutral-600)] outline-none focus:border-purple-400 mb-[12px]"
                />

                <div className="grid grid-cols-2 gap-[10px] mb-[12px]">
                  {/* 강점 */}
                  <div>
                    <p className="text-[10.5px] font-bold text-emerald-700 mb-[5px]">👍 강점</p>
                    <div className="flex flex-col gap-[4px]">
                      {comp.pros.map((pro, i) => (
                        <input
                          key={i}
                          type="text"
                          value={pro}
                          onChange={(e) => updatePro(comp.id, i, e.target.value)}
                          className="w-full border border-emerald-200 bg-emerald-50 rounded-[4px] p-[5px_8px] text-[11px] outline-none focus:border-emerald-400"
                        />
                      ))}
                    </div>
                  </div>
                  {/* 약점 */}
                  <div>
                    <p className="text-[10.5px] font-bold text-rose-700 mb-[5px]">👎 약점</p>
                    <div className="flex flex-col gap-[4px]">
                      {comp.cons.map((con, i) => (
                        <input
                          key={i}
                          type="text"
                          value={con}
                          onChange={(e) => updateCon(comp.id, i, e.target.value)}
                          className="w-full border border-rose-200 bg-rose-50 rounded-[4px] p-[5px_8px] text-[11px] outline-none focus:border-rose-400"
                        />
                      ))}
                    </div>
                  </div>
                </div>

                {/* 링크 */}
                <div className="flex flex-col gap-[5px]">
                  {(['web', 'playStore', 'appStore'] as const).map((key) => {
                    const labels = { web: '🌐 웹', playStore: '▶ Play Store', appStore: ' App Store' };
                    return (
                      <input
                        key={key}
                        type="url"
                        value={comp.links[key] || ''}
                        onChange={(e) => updateLink(comp.id, key, e.target.value)}
                        placeholder={labels[key]}
                        className="w-full border border-[var(--c-neutral-200)] rounded-[4px] p-[5px_8px] text-[10.5px] text-[var(--c-neutral-500)] outline-none focus:border-purple-300"
                      />
                    );
                  })}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ─── HMW 섹션 ─── */}
      <div className="mb-[6px]">
        <h2 className="text-[15px] font-[700] text-[var(--c-neutral-900)] mb-[14px]">HMW 문제 도출</h2>
      </div>

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
                    onChange={() => {}}
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
