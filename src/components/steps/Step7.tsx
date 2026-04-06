'use client';
import React, { useEffect, useState } from 'react';
import { useResearchStore } from '@/store/useResearchStore';
import { useRouter } from 'next/navigation';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { EditableText } from '../ui/EditableText';
import { useApiKey } from '../ui/ApiKeyModal';
import { runClaudeWithRetry, buildContextMetadata } from '@/lib/claudeEngine';
import { z } from 'zod';

const Step7Schema = z.object({
  personaName: z.string(),
  stages: z.array(z.object({
    id: z.string(),
    name: z.string(),
    actions: z.array(z.string()),
    thoughts: z.array(z.string()),
    emotion: z.enum(['happy', 'neutral', 'frustrated']),
    opportunities: z.array(z.string()),
    dataSources: z.array(z.string()),
  })),
});

type Step7Result = z.infer<typeof Step7Schema>;
type Stage = Step7Result['stages'][number];

const EMOTION_CONFIG = {
  happy: { label: '긍정', color: 'var(--c-success)', emoji: '😊' },
  neutral: { label: '중립', color: 'var(--c-warning)', emoji: '😐' },
  frustrated: { label: '부정', color: 'var(--c-error)', emoji: '😟' },
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

function stageToMarkdown(stage: Stage, idx: number): string {
  const cfg = EMOTION_CONFIG[stage.emotion];
  return [
    `## ${idx + 1}. ${stage.name} ${cfg.emoji}`,
    `\n### 행동\n${stage.actions.map(a => `- ${a}`).join('\n')}`,
    `\n### 생각 / 느낌\n${stage.thoughts.map(t => `- ${t}`).join('\n')}`,
    `\n### 기회 포인트\n${stage.opportunities.map(o => `- ${o}`).join('\n')}`,
    `\n*출처: ${stage.dataSources.join(', ')}*`,
  ].join('\n');
}

export function Step7() {
  const { data, updateData, setStep, userOverrides } = useResearchStore();
  const router = useRouter();
  const { apiKey } = useApiKey();

  const [loading, setLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [error, setError] = useState('');

  const result = data.journeyMap as Step7Result | undefined;

  useEffect(() => {
    setStep(7);
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
        { idea: data.idea, step1Insights: data.step1Insights, insightsMap: data.insightsMap, personas: data.personas },
        userOverrides
      );

      const res = await runClaudeWithRetry(
        apiKey,
        {
          system: 'You are an expert UX Researcher. Create a detailed user journey map based on the primary persona and research insights. Return ONLY valid JSON.',
          messages: [
            {
              role: 'user',
              content: `Research context:\n${context}\n\nCreate a user journey map for the primary persona with 5-7 stages. Return JSON:\n{\n  "personaName": "페르소나 이름",\n  "stages": [\n    {\n      "id": "s1",\n      "name": "단계명",\n      "actions": ["행동 1", "행동 2"],\n      "thoughts": ["생각/감정 1", "생각/감정 2"],\n      "emotion": "neutral",\n      "opportunities": ["기회 1", "기회 2"],\n      "dataSources": ["경쟁사 리뷰", "HMW #1"]\n    }\n  ]\n}\nemotion must be one of: happy, neutral, frustrated. All text in Korean.`,
            },
          ],
        },
        Step7Schema,
        setProgressMsg
      );

      updateData('journeyMap', res);
    } catch (err: any) {
      setError(err.message || '사용자 여정 생성 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // ── Patch helpers (userOverride=true → saved to userOverrides) ───────────────
  const patchStages = (updatedStages: Stage[]) => {
    updateData('journeyMap', { ...(data.journeyMap || {}), stages: updatedStages }, true);
  };

  const saveAction = (sIdx: number, aIdx: number, val: string) => {
    patchStages((result?.stages || []).map((s, i) =>
      i === sIdx ? { ...s, actions: s.actions.map((a, j) => j === aIdx ? val : a) } : s
    ));
  };

  const saveThought = (sIdx: number, tIdx: number, val: string) => {
    patchStages((result?.stages || []).map((s, i) =>
      i === sIdx ? { ...s, thoughts: s.thoughts.map((t, j) => j === tIdx ? val : t) } : s
    ));
  };

  const saveOpportunity = (sIdx: number, oIdx: number, val: string) => {
    patchStages((result?.stages || []).map((s, i) =>
      i === sIdx ? { ...s, opportunities: s.opportunities.map((o, j) => j === oIdx ? val : o) } : s
    ));
  };

  const stages = result?.stages || [];

  return (
    <>
      <div className="flex items-center gap-[8px] mb-[8px]">
        <div className="w-[32px] h-[32px] bg-[var(--c-primary-100)] rounded-[8px] flex items-center justify-center text-[16px]">🛤️</div>
        <div className="text-[11px] font-bold tracking-[0.1em] uppercase text-[var(--c-primary)]">STEP 7</div>
      </div>
      <h1 className="text-[26px] font-[800] text-[var(--c-neutral-900)] tracking-[-0.02em] mb-[6px]">사용자 여정 지도</h1>
      <p className="text-[13.5px] text-[var(--c-neutral-500)] mb-[32px]">
        주요 페르소나의 서비스 경험 흐름을 단계별로 시각화합니다.
      </p>

      {loading ? (
        <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[var(--r-lg)] p-[32px] text-center flex flex-col items-center justify-center">
          <div className="w-[8px] h-[8px] rounded-full bg-[var(--c-ai-processing)] animate-pulse mb-4"></div>
          <p className="text-[14px] font-bold text-[var(--c-ai)]">{progressMsg || 'AI가 사용자 여정을 매핑하고 있습니다...'}</p>
        </div>
      ) : error ? (
        <div className="bg-[#FEF2F2] border border-[#FCA5A5] rounded-[var(--r-md)] p-[16px]">
          <p className="text-[#B91C1C] text-[13px] font-semibold flex items-center gap-2">⚠️ {error}</p>
          <Button variant="secondary" size="sm" className="mt-3" onClick={runAnalysis}>재시도</Button>
        </div>
      ) : stages.length > 0 ? (
        <div className="space-y-[16px]">
          {/* Persona badge */}
          <div className="flex items-center gap-[8px]">
            <span className="text-[12px] text-[var(--c-neutral-500)]">대상 페르소나:</span>
            <Badge variant="ai">{result?.personaName}</Badge>
          </div>

          {/* Emotion line overview */}
          <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[var(--r-md)] p-[16px]">
            <p className="text-[11px] font-bold text-[var(--c-neutral-500)] uppercase tracking-wider mb-[10px]">감정 곡선</p>
            <div className="flex items-end gap-[4px] h-[48px]">
              {stages.map((s) => {
                const heights = { happy: '100%', neutral: '55%', frustrated: '20%' };
                const cfg = EMOTION_CONFIG[s.emotion];
                return (
                  <div key={s.id} className="flex-1 flex flex-col items-center gap-[4px]">
                    <div
                      className="w-full rounded-t-[4px] transition-all"
                      style={{ height: heights[s.emotion], backgroundColor: cfg.color, opacity: 0.7 }}
                    />
                    <span className="text-[10px]">{cfg.emoji}</span>
                  </div>
                );
              })}
            </div>
            <div className="flex gap-[4px] mt-[4px]">
              {stages.map((s) => (
                <div key={s.id} className="flex-1 text-center text-[9px] text-[var(--c-neutral-500)] truncate">{s.name}</div>
              ))}
            </div>
          </div>

          {/* Stage cards */}
          <div className="space-y-[12px]">
            {stages.map((stage, idx) => {
              const cfg = EMOTION_CONFIG[stage.emotion];
              return (
                <div
                  key={stage.id}
                  className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[var(--r-md)] overflow-hidden"
                >
                  {/* Stage header */}
                  <div className="flex items-center gap-[12px] px-[16px] py-[12px] border-b border-[var(--c-border)]">
                    <div className="w-[24px] h-[24px] rounded-full bg-[var(--c-primary-100)] text-[var(--c-primary)] text-[11px] font-bold flex items-center justify-center shrink-0">
                      {idx + 1}
                    </div>
                    <span className="text-[14px] font-bold text-[var(--c-neutral-900)] flex-1">{stage.name}</span>
                    <Badge variant={stage.emotion === 'happy' ? 'success' : stage.emotion === 'frustrated' ? 'error' : 'neutral'}>
                      {cfg.emoji} {cfg.label}
                    </Badge>
                    {/* Copy button top-right of card */}
                    <CopyButton text={stageToMarkdown(stage, idx)} label="단계 복사" />
                  </div>

                  {/* Stage body */}
                  <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[var(--c-border)]">
                    <div className="p-[14px]">
                      <p className="text-[10.5px] font-bold text-[var(--c-neutral-500)] uppercase mb-[8px]">행동</p>
                      <ul className="space-y-[4px]">
                        {stage.actions.map((a, i) => (
                          <li key={i} className="text-[12px] text-[var(--c-neutral-700)] flex items-start gap-[5px]">
                            <span className="text-[var(--c-primary)] mt-[2px] shrink-0">›</span>
                            <EditableText
                              value={a}
                              onSave={val => saveAction(idx, i, val)}
                              as="textarea"
                              rows={2}
                            />
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="p-[14px]">
                      <p className="text-[10.5px] font-bold text-[var(--c-neutral-500)] uppercase mb-[8px]">생각 / 느낌</p>
                      <ul className="space-y-[4px]">
                        {stage.thoughts.map((t, i) => (
                          <li key={i} className="text-[12px] text-[var(--c-neutral-700)] italic flex items-start gap-[5px]">
                            <span className="text-[var(--c-ai)] mt-[2px] shrink-0">❝</span>
                            <EditableText
                              value={t}
                              onSave={val => saveThought(idx, i, val)}
                              as="textarea"
                              rows={2}
                            />
                          </li>
                        ))}
                      </ul>
                    </div>
                    <div className="p-[14px]">
                      <p className="text-[10.5px] font-bold text-[var(--c-warning)] uppercase mb-[8px]">기회 포인트</p>
                      <ul className="space-y-[4px]">
                        {stage.opportunities.map((o, i) => (
                          <li key={i} className="text-[12px] text-[var(--c-neutral-700)] flex items-start gap-[5px]">
                            <span className="text-[var(--c-warning)] mt-[2px] shrink-0">★</span>
                            <EditableText
                              value={o}
                              onSave={val => saveOpportunity(idx, i, val)}
                              as="textarea"
                              rows={2}
                            />
                          </li>
                        ))}
                      </ul>
                      <div className="mt-[8px] flex flex-wrap gap-[4px]">
                        {stage.dataSources.map((src, i) => (
                          <span key={i} className="text-[9.5px] text-[var(--c-neutral-500)] bg-[var(--c-neutral-100)] px-[6px] py-[2px] rounded-full">
                            {src}
                          </span>
                        ))}
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div className="text-center py-10 text-[var(--c-neutral-500)]">데이터를 불러올 수 없습니다.</div>
      )}

      <div className="fixed bottom-0 left-0 md:left-[var(--sidebar-w)] right-0 bg-[var(--c-surface)] border-t border-[var(--c-border)] p-[12px_28px] flex items-center justify-between z-[100] shadow-[0_-4px_16px_rgba(26,24,64,0.06)]">
        <div className="flex items-center gap-[10px]">
          <span className="text-[11.5px] text-[var(--c-neutral-500)]">진행률 80%</span>
          <div className="w-[100px] h-[4px] bg-[var(--c-border)] rounded-[2px] overflow-hidden">
            <div className="h-full bg-[var(--c-primary)] w-[80%] transition-all"></div>
          </div>
        </div>
        <div className="flex items-center gap-[10px]">
          <Button variant="ghost" onClick={() => router.push('/steps/6')}>이전</Button>
          <Button variant="primary" disabled={loading || stages.length === 0} onClick={() => router.push('/steps/8')}>
            다음 단계
          </Button>
        </div>
      </div>
    </>
  );
}
