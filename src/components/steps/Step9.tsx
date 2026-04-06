'use client';
import React, { useEffect, useState } from 'react';
import { useResearchStore } from '@/store/useResearchStore';
import { useRouter } from 'next/navigation';
import { Button } from '../ui/Button';
import { useApiKey } from '../ui/ApiKeyModal';
import { runClaudeWithRetry, buildContextMetadata } from '@/lib/claudeEngine';
import { z } from 'zod';

const Step9Schema = z.object({
  executiveSummary: z.string(),
  problemStatement: z.string(),
  keyFindings: z.array(z.object({
    id: z.string(),
    title: z.string(),
    detail: z.string(),
    evidence: z.string(),
  })),
  personaInsights: z.string(),
  journeyHighlights: z.array(z.string()),
  topOpportunities: z.array(z.object({
    rank: z.number(),
    title: z.string(),
    rationale: z.string(),
  })),
  recommendations: z.array(z.object({
    id: z.string(),
    title: z.string(),
    description: z.string(),
    priority: z.enum(['high', 'medium', 'low']),
  })),
  nextSteps: z.array(z.string()),
});

type Step9Result = z.infer<typeof Step9Schema>;

const PRIORITY_CONFIG = {
  high:   { label: '긴급', color: 'var(--c-error)',   bg: '#FEF2F2', border: '#FECACA' },
  medium: { label: '보통', color: 'var(--c-warning)', bg: '#FFFBEB', border: '#FDE68A' },
  low:    { label: '낮음', color: 'var(--c-success)', bg: '#F0FDF4', border: '#A7F3D0' },
};

function CopyButton({ text }: { text: string }) {
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
      {copied ? '✓ 복사됨' : '복사'}
    </button>
  );
}

export function Step9() {
  const { data, updateData, setStep, userOverrides, reset } = useResearchStore();
  const router = useRouter();
  const { apiKey } = useApiKey();

  const [loading, setLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [error, setError] = useState('');

  const result = data.finalReport as Step9Result | undefined;

  useEffect(() => {
    setStep(9);
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
          opportunityMap: data.opportunityMap,
        },
        userOverrides
      );

      const result = await runClaudeWithRetry(
        apiKey,
        {
          max_tokens: 8192,
          system: 'You are an expert UX Researcher writing a comprehensive research report. Create a structured, actionable report based on all research findings. Return ONLY valid JSON.',
          messages: [
            {
              role: 'user',
              content: `Complete research findings:\n${context}\n\nWrite a comprehensive UX research report. Return JSON:\n{\n  "executiveSummary": "경영진 요약 3~4문장",\n  "problemStatement": "문제 정의 2~3문장",\n  "keyFindings": [\n    { "id": "f1", "title": "핵심 발견 제목", "detail": "상세 내용 2문장", "evidence": "근거 데이터" }\n  ],\n  "personaInsights": "페르소나 시사점 요약 2~3문장",\n  "journeyHighlights": ["여정 핵심 포인트 1", "핵심 포인트 2", "핵심 포인트 3"],\n  "topOpportunities": [\n    { "rank": 1, "title": "기회 제목", "rationale": "선정 이유 1~2문장" }\n  ],\n  "recommendations": [\n    { "id": "r1", "title": "권고사항 제목", "description": "상세 권고 내용", "priority": "high" }\n  ],\n  "nextSteps": ["다음 액션 아이템 1", "액션 아이템 2", "액션 아이템 3"]\n}\nGenerate 4-5 key findings, 3 top opportunities, 4-6 recommendations. All text in Korean.`,
            },
          ],
        },
        Step9Schema,
        setProgressMsg
      );

      updateData('finalReport', result);
    } catch (err: any) {
      setError(err.message || '보고서 생성 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const fullReportText = result ? [
    `# UX 리서치 보고서\n`,
    `## 경영진 요약\n${result.executiveSummary}`,
    `## 문제 정의\n${result.problemStatement}`,
    `## 핵심 발견\n${result.keyFindings.map(f => `### ${f.title}\n${f.detail}\n근거: ${f.evidence}`).join('\n\n')}`,
    `## 페르소나 시사점\n${result.personaInsights}`,
    `## 여정 주요 포인트\n${result.journeyHighlights.map(h => `- ${h}`).join('\n')}`,
    `## Top 기회\n${result.topOpportunities.map(o => `${o.rank}. ${o.title}\n${o.rationale}`).join('\n\n')}`,
    `## 권고사항\n${result.recommendations.map(r => `### ${r.title} [${r.priority}]\n${r.description}`).join('\n\n')}`,
    `## 다음 단계\n${result.nextSteps.map(s => `- ${s}`).join('\n')}`,
  ].join('\n\n') : '';

  return (
    <>
      <div className="flex items-center gap-[8px] mb-[8px]">
        <div className="w-[32px] h-[32px] bg-[var(--c-primary-100)] rounded-[8px] flex items-center justify-center text-[16px]">📄</div>
        <div className="text-[11px] font-bold tracking-[0.1em] uppercase text-[var(--c-primary)]">STEP 9</div>
      </div>
      <h1 className="text-[26px] font-[800] text-[var(--c-neutral-900)] tracking-[-0.02em] mb-[6px]">UX 보고서</h1>
      <p className="text-[13.5px] text-[var(--c-neutral-500)] mb-[32px]">
        전체 리서치 결과를 종합한 최종 UX 보고서입니다.
      </p>

      {loading ? (
        <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[var(--r-lg)] p-[32px] text-center flex flex-col items-center justify-center">
          <div className="w-[8px] h-[8px] rounded-full bg-[var(--c-ai-processing)] animate-pulse mb-4"></div>
          <p className="text-[14px] font-bold text-[var(--c-ai)]">{progressMsg || 'AI가 최종 보고서를 작성하고 있습니다...'}</p>
          <p className="text-[12px] text-[var(--c-neutral-500)] mt-2">전체 리서치 데이터를 종합 중입니다. 잠시만 기다려주세요.</p>
        </div>
      ) : error ? (
        <div className="bg-[#FEF2F2] border border-[#FCA5A5] rounded-[var(--r-md)] p-[16px]">
          <p className="text-[#B91C1C] text-[13px] font-semibold flex items-center gap-2">⚠️ {error}</p>
          <Button variant="secondary" size="sm" className="mt-3" onClick={runAnalysis}>재시도</Button>
        </div>
      ) : result ? (
        <div className="space-y-[20px] pb-[80px]">
          {/* Full copy button */}
          <div className="flex justify-end">
            <CopyButton text={fullReportText} />
          </div>

          {/* Executive Summary */}
          <ReportSection title="경영진 요약" text={result.executiveSummary} />

          {/* Problem Statement */}
          <ReportSection title="문제 정의" text={result.problemStatement} />

          {/* Key Findings */}
          <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[var(--r-md)] p-[20px]">
            <div className="flex items-center justify-between mb-[14px]">
              <h2 className="text-[14px] font-bold text-[var(--c-neutral-900)]">핵심 발견</h2>
              <CopyButton text={result.keyFindings.map(f => `${f.title}\n${f.detail}\n근거: ${f.evidence}`).join('\n\n')} />
            </div>
            <div className="space-y-[12px]">
              {result.keyFindings.map((finding, i) => (
                <div key={finding.id} className="flex items-start gap-[12px]">
                  <div className="w-[22px] h-[22px] rounded-full bg-[var(--c-primary-100)] text-[var(--c-primary)] text-[11px] font-bold flex items-center justify-center shrink-0 mt-[1px]">
                    {i + 1}
                  </div>
                  <div>
                    <p className="text-[13px] font-bold text-[var(--c-neutral-900)]">{finding.title}</p>
                    <p className="text-[12.5px] text-[var(--c-neutral-700)] mt-[2px]">{finding.detail}</p>
                    <p className="text-[11px] text-[var(--c-neutral-500)] mt-[4px] italic">근거: {finding.evidence}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Persona Insights */}
          <ReportSection title="페르소나 시사점" text={result.personaInsights} />

          {/* Journey Highlights */}
          <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[var(--r-md)] p-[20px]">
            <div className="flex items-center justify-between mb-[12px]">
              <h2 className="text-[14px] font-bold text-[var(--c-neutral-900)]">여정 주요 포인트</h2>
              <CopyButton text={result.journeyHighlights.join('\n')} />
            </div>
            <ul className="space-y-[6px]">
              {result.journeyHighlights.map((h, i) => (
                <li key={i} className="text-[13px] text-[var(--c-neutral-700)] flex items-start gap-[8px]">
                  <span className="text-[var(--c-primary)] font-bold mt-[1px]">→</span>{h}
                </li>
              ))}
            </ul>
          </div>

          {/* Top Opportunities */}
          <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[var(--r-md)] p-[20px]">
            <div className="flex items-center justify-between mb-[12px]">
              <h2 className="text-[14px] font-bold text-[var(--c-neutral-900)]">Top 기회 영역</h2>
              <CopyButton text={result.topOpportunities.map(o => `${o.rank}. ${o.title}\n${o.rationale}`).join('\n\n')} />
            </div>
            <div className="space-y-[10px]">
              {result.topOpportunities.map((opp) => (
                <div key={opp.rank} className="flex items-start gap-[12px]">
                  <div className="w-[22px] h-[22px] rounded-full bg-[var(--c-warning)] text-white text-[11px] font-bold flex items-center justify-center shrink-0 mt-[1px]">
                    {opp.rank}
                  </div>
                  <div>
                    <p className="text-[13px] font-bold text-[var(--c-neutral-900)]">{opp.title}</p>
                    <p className="text-[12.5px] text-[var(--c-neutral-700)] mt-[2px]">{opp.rationale}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Recommendations */}
          <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[var(--r-md)] p-[20px]">
            <div className="flex items-center justify-between mb-[12px]">
              <h2 className="text-[14px] font-bold text-[var(--c-neutral-900)]">권고사항</h2>
              <CopyButton text={result.recommendations.map(r => `[${r.priority}] ${r.title}\n${r.description}`).join('\n\n')} />
            </div>
            <div className="space-y-[10px]">
              {result.recommendations.map((rec) => {
                const cfg = PRIORITY_CONFIG[rec.priority];
                return (
                  <div
                    key={rec.id}
                    className="rounded-[var(--r-sm)] p-[14px] border"
                    style={{ backgroundColor: cfg.bg, borderColor: cfg.border }}
                  >
                    <div className="flex items-center gap-[8px] mb-[4px]">
                      <p className="text-[13px] font-bold text-[var(--c-neutral-900)]">{rec.title}</p>
                      <span
                        className="text-[10px] font-bold px-[6px] py-[1px] rounded-full text-white"
                        style={{ backgroundColor: cfg.color }}
                      >
                        {cfg.label}
                      </span>
                    </div>
                    <p className="text-[12.5px] text-[var(--c-neutral-700)]">{rec.description}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Next Steps */}
          <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[var(--r-md)] p-[20px]">
            <div className="flex items-center justify-between mb-[12px]">
              <h2 className="text-[14px] font-bold text-[var(--c-neutral-900)]">다음 단계</h2>
              <CopyButton text={result.nextSteps.join('\n')} />
            </div>
            <ul className="space-y-[6px]">
              {result.nextSteps.map((step, i) => (
                <li key={i} className="text-[13px] text-[var(--c-neutral-700)] flex items-start gap-[8px]">
                  <span className="w-[18px] h-[18px] rounded-full border-2 border-[var(--c-primary)] text-[var(--c-primary)] text-[9px] font-bold flex items-center justify-center shrink-0 mt-[1px]">
                    {i + 1}
                  </span>
                  {step}
                </li>
              ))}
            </ul>
          </div>
        </div>
      ) : (
        <div className="text-center py-10 text-[var(--c-neutral-500)]">데이터를 불러올 수 없습니다.</div>
      )}

      <div className="fixed bottom-0 left-0 md:left-[var(--sidebar-w)] right-0 bg-[var(--c-surface)] border-t border-[var(--c-border)] p-[12px_28px] flex items-center justify-between z-[100] shadow-[0_-4px_16px_rgba(26,24,64,0.06)]">
        <div className="flex items-center gap-[10px]">
          <span className="text-[11.5px] text-[var(--c-success)] font-bold">완료 100%</span>
          <div className="w-[100px] h-[4px] bg-[var(--c-border)] rounded-[2px] overflow-hidden">
            <div className="h-full bg-[var(--c-success)] w-full transition-all"></div>
          </div>
        </div>
        <div className="flex items-center gap-[10px]">
          <Button variant="ghost" onClick={() => router.push('/steps/8')}>이전</Button>
          {result && (
            <Button variant="secondary" onClick={() => { reset(); router.push('/steps/1'); }}>
              새 리서치 시작
            </Button>
          )}
          {result && (
            <Button
              variant="primary"
              onClick={() => navigator.clipboard.writeText(fullReportText)}
            >
              전체 보고서 복사
            </Button>
          )}
        </div>
      </div>
    </>
  );
}

function ReportSection({ title, text }: { title: string; text: string }) {
  return (
    <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[var(--r-md)] p-[20px]">
      <div className="flex items-center justify-between mb-[10px]">
        <h2 className="text-[14px] font-bold text-[var(--c-neutral-900)]">{title}</h2>
        <CopyButton text={text} />
      </div>
      <p className="text-[13px] text-[var(--c-neutral-700)] leading-relaxed">{text}</p>
    </div>
  );
}
