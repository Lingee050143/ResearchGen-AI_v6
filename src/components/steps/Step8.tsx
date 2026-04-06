'use client';
import React, { useEffect, useState } from 'react';
import { useResearchStore } from '@/store/useResearchStore';
import { useRouter } from 'next/navigation';
import { Button } from '../ui/Button';
import { EditableText } from '../ui/EditableText';
import { useApiKey } from '../ui/ApiKeyModal';
import { runClaudeWithRetry, buildContextMetadata } from '@/lib/claudeEngine';
import { z } from 'zod';

const Step8Schema = z.object({
  opportunities: z.array(z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    impact: z.number().min(1).max(5),
    effort: z.number().min(1).max(5),
    category: z.string(),
  })),
  summary: z.string(),
});

type Step8Result = z.infer<typeof Step8Schema>;
type Opportunity = Step8Result['opportunities'][number];

type ViewMode = 'matrix' | 'list';

// Quadrant logic: impact >=3 is High, effort >=3 is High
function getQuadrant(opp: Opportunity) {
  const highImpact = opp.impact >= 3;
  const highEffort = opp.effort >= 3;
  if (highImpact && !highEffort) return 'quick-wins';
  if (highImpact && highEffort) return 'major';
  if (!highImpact && !highEffort) return 'fill-ins';
  return 'hard';
}

const QUADRANT_CONFIG = {
  'quick-wins': { label: 'Quick Wins', sublabel: '높은 임팩트 · 낮은 노력', color: '#D1FAE5', border: '#6EE7B7', textColor: '#065F46' },
  'major':      { label: '주요 과제', sublabel: '높은 임팩트 · 높은 노력', color: '#EDE9FE', border: '#C4B5FD', textColor: '#4C1D95' },
  'fill-ins':   { label: '단기 보완', sublabel: '낮은 임팩트 · 낮은 노력', color: '#FEF3C7', border: '#FCD34D', textColor: '#78350F' },
  'hard':       { label: '재검토 필요', sublabel: '낮은 임팩트 · 높은 노력', color: '#FEE2E2', border: '#FCA5A5', textColor: '#991B1B' },
};

function CopyButton({ text, label = '복사' }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false);
  const handleCopy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={handleCopy}
      className="text-[11px] text-[var(--c-neutral-400)] hover:text-[var(--c-primary)] transition-colors flex items-center gap-[3px] shrink-0"
    >
      {copied ? '✓ 복사됨' : label}
    </button>
  );
}

export function Step8() {
  const { data, updateData, setStep, userOverrides } = useResearchStore();
  const router = useRouter();
  const { apiKey } = useApiKey();

  const [loading, setLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [error, setError] = useState('');
  const [viewMode, setViewMode] = useState<ViewMode>('matrix');

  const result = data.opportunityMap as Step8Result | undefined;

  useEffect(() => {
    setStep(8);
    if (!result && apiKey) {
      runAnalysis();
    }
  }, [setStep, apiKey]);

  const runAnalysis = async () => {
    if (!apiKey) return;
    setLoading(true);
    setError('');

    try {
      const context = buildContextMetadata(
        {
          idea: data.idea,
          step1Insights: data.step1Insights,
          insightsMap: data.insightsMap,
          personas: data.personas,
          journeyMap: data.journeyMap,
        },
        userOverrides
      );

      const res = await runClaudeWithRetry(
        apiKey,
        {
          system: `You are an expert UX Researcher. Based on all research findings, identify and prioritize product opportunities. Return ONLY valid JSON.

CRITICAL INSTRUCTION: Among the HMW (How Might We) questions derived in Step 2 (initial research), those that the user has marked as important via overrides must be treated as the TOP PRIORITY problems to solve. Derive Opportunities from those HMW questions first and assign them a high impact score (4 or 5).`,
          messages: [
            {
              role: 'user',
              content: `Research context:\n${context}\n\n반드시 Step 2(초기 리서치)에서 도출된 HMW(How Might We) 질문 중, 사용자가 중요하다고 판단해 오버라이드(선택)한 내용을 최우선 해결 과제로 삼아 기회(Opportunity)를 도출하고, impact 점수를 높게 부여할 것.\n\nIdentify 6-10 product opportunities. Rate each by impact (1-5) and effort (1-5). Return JSON:\n{\n  "opportunities": [\n    {\n      "id": "o1",\n      "title": "기회 항목 제목",\n      "description": "왜 이 기회가 중요한지 1~2문장",\n      "impact": 4,\n      "effort": 2,\n      "category": "카테고리명"\n    }\n  ],\n  "summary": "기회 분석 전체 요약 2~3문장"\n}\nAll text in Korean. Be specific and actionable.`,
            },
          ],
        },
        Step8Schema,
        setProgressMsg
      );

      updateData('opportunityMap', res);
    } catch (err: any) {
      setError(err.message || '기회 지도 생성 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // ── Patch helpers (userOverride=true → saved to userOverrides) ───────────────
  const patchOpportunities = (updatedOpps: Opportunity[]) => {
    updateData('opportunityMap', { ...(data.opportunityMap || {}), opportunities: updatedOpps }, true);
  };

  const saveSummary = (val: string) => {
    updateData('opportunityMap', { ...(data.opportunityMap || {}), summary: val }, true);
  };

  const saveTitle = (oIdx: number, val: string) => {
    patchOpportunities((result?.opportunities || []).map((o, i) => i === oIdx ? { ...o, title: val } : o));
  };

  const saveDescription = (oIdx: number, val: string) => {
    patchOpportunities((result?.opportunities || []).map((o, i) => i === oIdx ? { ...o, description: val } : o));
  };

  const opportunities = result?.opportunities || [];

  const quadrantGroups = {
    'quick-wins': opportunities.filter(o => getQuadrant(o) === 'quick-wins'),
    'major': opportunities.filter(o => getQuadrant(o) === 'major'),
    'fill-ins': opportunities.filter(o => getQuadrant(o) === 'fill-ins'),
    'hard': opportunities.filter(o => getQuadrant(o) === 'hard'),
  };

  const fullMapMarkdown = result ? [
    `# 기회 지도`,
    `## 요약\n${result.summary}`,
    ...result.opportunities
      .slice()
      .sort((a, b) => (b.impact - b.effort) - (a.impact - a.effort))
      .map(o => `## ${o.title} [임팩트:${o.impact} / 노력:${o.effort}]\n${o.description}\n*카테고리: ${o.category} / ${QUADRANT_CONFIG[getQuadrant(o)].label}*`),
  ].join('\n\n') : '';

  return (
    <>
      <div className="flex items-center gap-[8px] mb-[8px]">
        <div className="w-[32px] h-[32px] bg-[var(--c-primary-100)] rounded-[8px] flex items-center justify-center text-[16px]">🎯</div>
        <div className="text-[11px] font-bold tracking-[0.1em] uppercase text-[var(--c-primary)]">STEP 8</div>
      </div>
      <h1 className="text-[26px] font-[800] text-[var(--c-neutral-900)] tracking-[-0.02em] mb-[6px]">기회 지도</h1>
      <p className="text-[13.5px] text-[var(--c-neutral-500)] mb-[32px]">
        도출된 기회를 임팩트와 노력 기준으로 우선순위화합니다.
      </p>

      {loading ? (
        <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[var(--r-lg)] p-[32px] text-center flex flex-col items-center justify-center">
          <div className="w-[8px] h-[8px] rounded-full bg-[var(--c-ai-processing)] animate-pulse mb-4"></div>
          <p className="text-[14px] font-bold text-[var(--c-ai)]">{progressMsg || 'AI가 기회를 분석하고 있습니다...'}</p>
        </div>
      ) : error ? (
        <div className="bg-[#FEF2F2] border border-[#FCA5A5] rounded-[var(--r-md)] p-[16px]">
          <p className="text-[#B91C1C] text-[13px] font-semibold flex items-center gap-2">⚠️ {error}</p>
          <Button variant="secondary" size="sm" className="mt-3" onClick={runAnalysis}>재시도</Button>
        </div>
      ) : opportunities.length > 0 ? (
        <div className="space-y-[20px]">
          {/* Summary + copy button */}
          <div className="bg-[var(--c-ai-subtle)] border border-[#BAE6FD] rounded-[var(--r-md)] p-[16px]">
            <div className="flex items-start justify-between gap-[12px]">
              <EditableText
                value={result?.summary ?? ''}
                onSave={saveSummary}
                as="textarea"
                rows={3}
                className="text-[13px] text-[var(--c-neutral-700)] leading-relaxed flex-1"
              />
              {/* Copy entire map - top right */}
              <CopyButton text={fullMapMarkdown} label="전체 복사" />
            </div>
          </div>

          {/* View toggle */}
          <div className="flex gap-[4px] p-[3px] bg-[var(--c-neutral-100)] rounded-[var(--r-sm)] w-fit">
            {(['matrix', 'list'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-[12px] py-[5px] rounded-[var(--r-sm)] text-[12px] font-semibold transition-all ${viewMode === mode ? 'bg-white shadow-[var(--shadow-sm)] text-[var(--c-neutral-900)]' : 'text-[var(--c-neutral-500)]'}`}
              >
                {mode === 'matrix' ? '매트릭스' : '목록'}
              </button>
            ))}
          </div>

          {viewMode === 'matrix' ? (
            <div className="grid grid-cols-2 gap-[12px]">
              {(Object.entries(quadrantGroups) as [keyof typeof QUADRANT_CONFIG, Opportunity[]][]).map(([key, items]) => {
                const cfg = QUADRANT_CONFIG[key];
                return (
                  <div
                    key={key}
                    className="rounded-[var(--r-md)] p-[16px] border"
                    style={{ backgroundColor: cfg.color, borderColor: cfg.border }}
                  >
                    <p className="text-[12px] font-bold mb-[2px]" style={{ color: cfg.textColor }}>{cfg.label}</p>
                    <p className="text-[10px] mb-[12px]" style={{ color: cfg.textColor, opacity: 0.7 }}>{cfg.sublabel}</p>
                    {items.length === 0 ? (
                      <p className="text-[11px]" style={{ color: cfg.textColor, opacity: 0.5 }}>해당 항목 없음</p>
                    ) : (
                      <ul className="space-y-[6px]">
                        {items.map((o, oIdx) => {
                          const globalIdx = opportunities.findIndex(op => op.id === o.id);
                          return (
                            <li key={o.id} className="text-[12px] font-semibold" style={{ color: cfg.textColor }}>
                              •{' '}
                              <EditableText
                                value={o.title}
                                onSave={val => saveTitle(globalIdx, val)}
                              />
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="space-y-[10px]">
              {opportunities
                .slice()
                .sort((a, b) => (b.impact - b.effort) - (a.impact - a.effort))
                .map((opp, sortedIdx) => {
                  const globalIdx = opportunities.findIndex(o => o.id === opp.id);
                  const q = getQuadrant(opp);
                  const cfg = QUADRANT_CONFIG[q];
                  return (
                    <div key={opp.id} className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[var(--r-md)] p-[16px]">
                      <div className="flex items-start justify-between gap-[12px]">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-[8px] mb-[4px]">
                            <EditableText
                              value={opp.title}
                              onSave={val => saveTitle(globalIdx, val)}
                              className="text-[13.5px] font-bold text-[var(--c-neutral-900)]"
                            />
                            <span
                              className="text-[10px] font-bold px-[8px] py-[2px] rounded-full shrink-0"
                              style={{ backgroundColor: cfg.color, color: cfg.textColor }}
                            >
                              {cfg.label}
                            </span>
                          </div>
                          <EditableText
                            value={opp.description}
                            onSave={val => saveDescription(globalIdx, val)}
                            as="textarea"
                            rows={2}
                            className="text-[12px] text-[var(--c-neutral-700)]"
                          />
                          <span className="text-[10.5px] text-[var(--c-neutral-500)] mt-[4px] inline-block">{opp.category}</span>
                        </div>
                        <div className="shrink-0 text-right">
                          <div className="text-[10px] text-[var(--c-neutral-500)]">임팩트</div>
                          <div className="flex gap-[2px] justify-end">
                            {[1, 2, 3, 4, 5].map((n) => (
                              <div
                                key={n}
                                className="w-[6px] h-[6px] rounded-full"
                                style={{ backgroundColor: n <= opp.impact ? 'var(--c-primary)' : 'var(--c-neutral-200)' }}
                              />
                            ))}
                          </div>
                          <div className="text-[10px] text-[var(--c-neutral-500)] mt-[4px]">노력</div>
                          <div className="flex gap-[2px] justify-end">
                            {[1, 2, 3, 4, 5].map((n) => (
                              <div
                                key={n}
                                className="w-[6px] h-[6px] rounded-full"
                                style={{ backgroundColor: n <= opp.effort ? 'var(--c-warning)' : 'var(--c-neutral-200)' }}
                              />
                            ))}
                          </div>
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-10 text-[var(--c-neutral-500)]">데이터를 불러올 수 없습니다.</div>
      )}

      <div className="fixed bottom-0 left-0 md:left-[var(--sidebar-w)] right-0 bg-[var(--c-surface)] border-t border-[var(--c-border)] p-[12px_28px] flex items-center justify-between z-[100] shadow-[0_-4px_16px_rgba(26,24,64,0.06)]">
        <div className="flex items-center gap-[10px]">
          <span className="text-[11.5px] text-[var(--c-neutral-500)]">진행률 90%</span>
          <div className="w-[100px] h-[4px] bg-[var(--c-border)] rounded-[2px] overflow-hidden">
            <div className="h-full bg-[var(--c-primary)] w-[90%] transition-all"></div>
          </div>
        </div>
        <div className="flex items-center gap-[10px]">
          <Button variant="ghost" onClick={() => router.push('/steps/7')}>이전</Button>
          <Button variant="primary" disabled={loading || opportunities.length === 0} onClick={() => router.push('/steps/9')}>
            최종 보고서 생성
          </Button>
        </div>
      </div>
    </>
  );
}
