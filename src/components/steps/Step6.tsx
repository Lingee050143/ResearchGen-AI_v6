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

const Step6Schema = z.object({
  personas: z.array(z.object({
    id: z.string(),
    name: z.string(),
    age: z.number(),
    occupation: z.string(),
    quote: z.string(),
    goals: z.array(z.string()),
    painPoints: z.array(z.string()),
    behaviors: z.array(z.string()),
    dataSources: z.array(z.string()),
  })),
});

type Step6Result = z.infer<typeof Step6Schema>;
type Persona = Step6Result['personas'][number];

const PERSONA_COLORS = ['#4F46E5', '#0EA5E9', '#10B981'];

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

function personaToMarkdown(p: Persona): string {
  return [
    `## 페르소나: ${p.name} (${p.age}세, ${p.occupation})`,
    `> "${p.quote}"`,
    `\n### 목표\n${p.goals.map(g => `- ${g}`).join('\n')}`,
    `\n### 불편함\n${p.painPoints.map(pp => `- ${pp}`).join('\n')}`,
    `\n### 행동 패턴\n${p.behaviors.map(b => `- ${b}`).join('\n')}`,
    `\n### 데이터 출처\n${p.dataSources.map(s => `- ${s}`).join('\n')}`,
  ].join('\n');
}

export function Step6() {
  const { data, updateData, setStep, userOverrides } = useResearchStore();
  const router = useRouter();
  const { apiKey } = useApiKey();

  const [loading, setLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [error, setError] = useState('');
  const [activePersona, setActivePersona] = useState(0);

  const result = data.personas as Step6Result | undefined;

  useEffect(() => {
    setStep(6);
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
        { idea: data.idea, step1Insights: data.step1Insights, insightsMap: data.insightsMap },
        userOverrides
      );

      const res = await runClaudeWithRetry(
        apiKey,
        {
          system: 'You are an expert UX Researcher. Create realistic user personas based on research insights. Return ONLY valid JSON.',
          messages: [
            {
              role: 'user',
              content: `Research context:\n${context}\n\nCreate 2-3 distinct user personas. Return JSON:\n{\n  "personas": [\n    {\n      "id": "p1",\n      "name": "김민지",\n      "age": 28,\n      "occupation": "직업",\n      "quote": "이 서비스에 대한 대표 발언",\n      "goals": ["목표 1", "목표 2", "목표 3"],\n      "painPoints": ["불편 1", "불편 2", "불편 3"],\n      "behaviors": ["행동 패턴 1", "행동 패턴 2"],\n      "dataSources": ["경쟁사A 부정 리뷰", "HMW 질문 #2"]\n    }\n  ]\n}\nAll text in Korean. Make personas realistic and data-driven.`,
            },
          ],
        },
        Step6Schema,
        setProgressMsg
      );

      updateData('personas', res);
    } catch (err: any) {
      setError(err.message || '페르소나 생성 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // ── Patch helpers (userOverride=true → saved to userOverrides) ───────────────
  const patchPersonas = (updatedPersonas: Persona[]) => {
    updateData('personas', { ...(data.personas || {}), personas: updatedPersonas }, true);
  };

  const saveQuote = (pIdx: number, val: string) => {
    patchPersonas((result?.personas || []).map((p, i) => i === pIdx ? { ...p, quote: val } : p));
  };

  const saveGoal = (pIdx: number, gIdx: number, val: string) => {
    patchPersonas((result?.personas || []).map((p, i) =>
      i === pIdx ? { ...p, goals: p.goals.map((g, j) => j === gIdx ? val : g) } : p
    ));
  };

  const savePainPoint = (pIdx: number, ppIdx: number, val: string) => {
    patchPersonas((result?.personas || []).map((p, i) =>
      i === pIdx ? { ...p, painPoints: p.painPoints.map((pp, j) => j === ppIdx ? val : pp) } : p
    ));
  };

  const saveBehavior = (pIdx: number, bIdx: number, val: string) => {
    patchPersonas((result?.personas || []).map((p, i) =>
      i === pIdx ? { ...p, behaviors: p.behaviors.map((b, j) => j === bIdx ? val : b) } : p
    ));
  };

  const personas = result?.personas || [];
  const persona = personas[activePersona];

  return (
    <>
      <div className="flex items-center gap-[8px] mb-[8px]">
        <div className="w-[32px] h-[32px] bg-[var(--c-primary-100)] rounded-[8px] flex items-center justify-center text-[16px]">👤</div>
        <div className="text-[11px] font-bold tracking-[0.1em] uppercase text-[var(--c-primary)]">STEP 6</div>
      </div>
      <h1 className="text-[26px] font-[800] text-[var(--c-neutral-900)] tracking-[-0.02em] mb-[6px]">페르소나</h1>
      <p className="text-[13.5px] text-[var(--c-neutral-500)] mb-[32px]">
        리서치 데이터 기반으로 대표 사용자 페르소나를 도출합니다.
      </p>

      {loading ? (
        <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[var(--r-lg)] p-[32px] text-center flex flex-col items-center justify-center">
          <div className="w-[8px] h-[8px] rounded-full bg-[var(--c-ai-processing)] animate-pulse mb-4"></div>
          <p className="text-[14px] font-bold text-[var(--c-ai)]">{progressMsg || 'AI가 페르소나를 생성하고 있습니다...'}</p>
        </div>
      ) : error ? (
        <div className="bg-[#FEF2F2] border border-[#FCA5A5] rounded-[var(--r-md)] p-[16px]">
          <p className="text-[#B91C1C] text-[13px] font-semibold flex items-center gap-2">⚠️ {error}</p>
          <Button variant="secondary" size="sm" className="mt-3" onClick={runAnalysis}>재시도</Button>
        </div>
      ) : persona ? (
        <div className="space-y-[20px]">
          {/* Persona Tabs */}
          <div className="flex gap-[8px]">
            {personas.map((p, i) => (
              <button
                key={p.id}
                onClick={() => setActivePersona(i)}
                className={`flex items-center gap-[8px] px-[14px] py-[8px] rounded-[var(--r-md)] text-[13px] font-semibold transition-all ${activePersona === i ? 'bg-[var(--c-primary)] text-white' : 'bg-[var(--c-surface)] border border-[var(--c-border)] text-[var(--c-neutral-700)] hover:border-[var(--c-primary-200)]'}`}
              >
                <div
                  className="w-[6px] h-[6px] rounded-full"
                  style={{ backgroundColor: activePersona === i ? 'white' : PERSONA_COLORS[i % PERSONA_COLORS.length] }}
                />
                {p.name}
              </button>
            ))}
          </div>

          {/* Persona Card */}
          <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[var(--r-lg)] overflow-hidden">
            {/* Header */}
            <div
              className="p-[24px] flex items-start gap-[20px] relative"
              style={{ background: `linear-gradient(135deg, ${PERSONA_COLORS[activePersona % PERSONA_COLORS.length]}18, transparent)` }}
            >
              {/* Copy button top-right */}
              <div className="absolute top-[14px] right-[16px]">
                <CopyButton text={personaToMarkdown(persona)} label="카드 복사" />
              </div>

              <div
                className="w-[56px] h-[56px] rounded-full flex items-center justify-center text-[24px] text-white shrink-0"
                style={{ backgroundColor: PERSONA_COLORS[activePersona % PERSONA_COLORS.length] }}
              >
                {persona.name.charAt(0)}
              </div>
              <div className="flex-1 min-w-0 pr-[60px]">
                <h2 className="text-[20px] font-bold text-[var(--c-neutral-900)]">{persona.name}</h2>
                <p className="text-[13px] text-[var(--c-neutral-700)]">{persona.age}세 · {persona.occupation}</p>
                <p className="text-[13px] italic text-[var(--c-neutral-500)] mt-[8px] flex items-start gap-[2px]">
                  <span>"</span>
                  <EditableText
                    value={persona.quote}
                    onSave={val => saveQuote(activePersona, val)}
                    as="textarea"
                    rows={2}
                    className="flex-1"
                  />
                  <span>"</span>
                </p>
              </div>
            </div>

            {/* Body */}
            <div className="grid grid-cols-1 md:grid-cols-3 divide-y md:divide-y-0 md:divide-x divide-[var(--c-border)]">
              {/* Goals */}
              <div className="p-[20px]">
                <h3 className="text-[12px] font-bold text-[var(--c-success)] uppercase tracking-wider mb-[10px]">목표</h3>
                <ul className="space-y-[6px]">
                  {persona.goals.map((g, i) => (
                    <li key={i} className="text-[12.5px] text-[var(--c-neutral-700)] flex items-start gap-[6px]">
                      <span className="text-[var(--c-success)] mt-[2px] shrink-0">↑</span>
                      <EditableText
                        value={g}
                        onSave={val => saveGoal(activePersona, i, val)}
                        as="textarea"
                        rows={2}
                      />
                    </li>
                  ))}
                </ul>
              </div>

              {/* Pain Points */}
              <div className="p-[20px]">
                <h3 className="text-[12px] font-bold text-[var(--c-error)] uppercase tracking-wider mb-[10px]">불편함</h3>
                <ul className="space-y-[6px]">
                  {persona.painPoints.map((pp, i) => (
                    <li key={i} className="text-[12.5px] text-[var(--c-neutral-700)] flex items-start gap-[6px]">
                      <span className="text-[var(--c-error)] mt-[2px] shrink-0">✕</span>
                      <EditableText
                        value={pp}
                        onSave={val => savePainPoint(activePersona, i, val)}
                        as="textarea"
                        rows={2}
                      />
                    </li>
                  ))}
                </ul>
              </div>

              {/* Behaviors */}
              <div className="p-[20px]">
                <h3 className="text-[12px] font-bold text-[var(--c-primary)] uppercase tracking-wider mb-[10px]">행동 패턴</h3>
                <ul className="space-y-[6px]">
                  {persona.behaviors.map((b, i) => (
                    <li key={i} className="text-[12.5px] text-[var(--c-neutral-700)] flex items-start gap-[6px]">
                      <span className="text-[var(--c-primary)] mt-[2px] shrink-0">→</span>
                      <EditableText
                        value={b}
                        onSave={val => saveBehavior(activePersona, i, val)}
                        as="textarea"
                        rows={2}
                      />
                    </li>
                  ))}
                </ul>
              </div>
            </div>

            {/* Data Sources */}
            <div className="px-[20px] py-[12px] bg-[var(--c-neutral-50)] border-t border-[var(--c-border)]">
              <span className="text-[11px] text-[var(--c-neutral-500)] mr-[8px]">데이터 출처:</span>
              {persona.dataSources.map((src, i) => (
                <Badge key={i} variant="neutral" className="mr-[4px] mb-[4px]">{src}</Badge>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-10 text-[var(--c-neutral-500)]">데이터를 불러올 수 없습니다.</div>
      )}

      <div className="fixed bottom-0 left-0 md:left-[var(--sidebar-w)] right-0 bg-[var(--c-surface)] border-t border-[var(--c-border)] p-[12px_28px] flex items-center justify-between z-[100] shadow-[0_-4px_16px_rgba(26,24,64,0.06)]">
        <div className="flex items-center gap-[10px]">
          <span className="text-[11.5px] text-[var(--c-neutral-500)]">진행률 70%</span>
          <div className="w-[100px] h-[4px] bg-[var(--c-border)] rounded-[2px] overflow-hidden">
            <div className="h-full bg-[var(--c-primary)] w-[70%] transition-all"></div>
          </div>
        </div>
        <div className="flex items-center gap-[10px]">
          <Button variant="ghost" onClick={() => router.push('/steps/5')}>이전</Button>
          <Button variant="primary" disabled={loading || !persona} onClick={() => router.push('/steps/7')}>
            다음 단계
          </Button>
        </div>
      </div>
    </>
  );
}
