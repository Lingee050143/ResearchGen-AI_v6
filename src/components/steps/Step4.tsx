'use client';
import React, { useEffect, useState } from 'react';
import { useResearchStore } from '@/store/useResearchStore';
import { useRouter } from 'next/navigation';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { useApiKey } from '../ui/ApiKeyModal';
import { runClaudeWithRetry, buildContextMetadata } from '@/lib/claudeEngine';
import { z } from 'zod';

const Step4Schema = z.object({
  sentiment: z.object({
    positive: z.number(),
    neutral: z.number(),
    negative: z.number(),
  }),
  themes: z.array(z.object({
    id: z.string(),
    label: z.string(),
    sentiment: z.enum(['positive', 'neutral', 'negative']),
    count: z.number(),
    examples: z.array(z.string()),
  })),
  topPainPoints: z.array(z.string()),
  topPraises: z.array(z.string()),
  summary: z.string(),
});

type Step4Result = z.infer<typeof Step4Schema>;

const SENTIMENT_FILTER = ['all', 'positive', 'neutral', 'negative'] as const;
type SentimentFilter = typeof SENTIMENT_FILTER[number];

export function Step4() {
  const { data, updateData, setStep, userOverrides } = useResearchStore();
  const router = useRouter();
  const { apiKey } = useApiKey();

  const [loading, setLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<SentimentFilter>('all');

  const result = data.insightsMap?.reviewAnalysis as Step4Result | undefined;

  useEffect(() => {
    setStep(4);
    if (!result && apiKey) {
      runAnalysis();
    }
  }, [setStep, apiKey]);

  const runAnalysis = async () => {
    if (!apiKey) return;
    setLoading(true);
    setError('');

    try {
      const competitors = data.competitors || [];
      // Sample up to 100 reviews per competitor for the prompt
      const reviewSample = competitors
        .filter((c: any) => c.name && c.reviews?.length)
        .map((c: any) => ({
          competitor: c.name,
          reviews: (c.reviews as any[]).slice(0, 100).map((r: any) => {
            const text = r.content || r.text || r.review || r.body || Object.values(r)[0] || '';
            return String(text).slice(0, 200);
          }),
        }));

      const context = buildContextMetadata({ idea: data.idea, step1Insights: data.step1Insights }, userOverrides);

      const result = await runClaudeWithRetry(
        apiKey,
        {
          system: 'You are an expert UX Researcher specializing in review analysis. Analyze competitor reviews and extract sentiment distribution, recurring themes, pain points, and praises. Return ONLY valid JSON.',
          messages: [
            {
              role: 'user',
              content: `Project context: ${context}\n\nCompetitor review samples:\n${JSON.stringify(reviewSample, null, 2)}\n\nAnalyze these reviews and return JSON:\n{\n  "sentiment": { "positive": 45, "neutral": 25, "negative": 30 },\n  "themes": [\n    { "id": "t1", "label": "테마 이름", "sentiment": "negative", "count": 120, "examples": ["example 1", "example 2"] }\n  ],\n  "topPainPoints": ["통증 포인트 1", "통증 포인트 2", "통증 포인트 3"],\n  "topPraises": ["칭찬 1", "칭찬 2", "칭찬 3"],\n  "summary": "전체 분석 요약 2~3문장"\n}\nGenerate 5-8 themes. All text in Korean.`,
            },
          ],
        },
        Step4Schema,
        setProgressMsg
      );

      updateData('insightsMap', { reviewAnalysis: result });
    } catch (err: any) {
      setError(err.message || '리뷰 분석 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const filteredThemes = result?.themes.filter(
    (t) => filter === 'all' || t.sentiment === filter
  ) || [];

  const sentimentColor: Record<string, string> = {
    positive: 'var(--c-success)',
    neutral: 'var(--c-warning)',
    negative: 'var(--c-error)',
  };

  const sentimentLabel: Record<string, string> = {
    positive: '긍정',
    neutral: '중립',
    negative: '부정',
  };

  return (
    <>
      <div className="flex items-center gap-[8px] mb-[8px]">
        <div className="w-[32px] h-[32px] bg-[var(--c-primary-100)] rounded-[8px] flex items-center justify-center text-[16px]">📊</div>
        <div className="text-[11px] font-bold tracking-[0.1em] uppercase text-[var(--c-primary)]">STEP 4</div>
      </div>
      <h1 className="text-[26px] font-[800] text-[var(--c-neutral-900)] tracking-[-0.02em] mb-[6px]">리뷰 분석</h1>
      <p className="text-[13.5px] text-[var(--c-neutral-500)] mb-[32px]">
        경쟁사 리뷰에서 감정 분포와 핵심 테마를 추출합니다.
      </p>

      {loading ? (
        <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[var(--r-lg)] p-[32px] text-center flex flex-col items-center justify-center">
          <div className="w-[8px] h-[8px] rounded-full bg-[var(--c-ai-processing)] animate-pulse mb-4"></div>
          <p className="text-[14px] font-bold text-[var(--c-ai)]">{progressMsg || 'AI가 리뷰를 분석하고 있습니다...'}</p>
        </div>
      ) : error ? (
        <div className="bg-[#FEF2F2] border border-[#FCA5A5] rounded-[var(--r-md)] p-[16px]">
          <p className="text-[#B91C1C] text-[13px] font-semibold flex items-center gap-2">⚠️ {error}</p>
          <Button variant="secondary" size="sm" className="mt-3" onClick={runAnalysis}>재시도</Button>
        </div>
      ) : result ? (
        <div className="space-y-[24px]">
          {/* Sentiment Distribution */}
          <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[var(--r-md)] p-[20px]">
            <h2 className="text-[14px] font-bold text-[var(--c-neutral-900)] mb-[16px]">감정 분포</h2>
            <div className="flex gap-[4px] h-[32px] rounded-[var(--r-sm)] overflow-hidden mb-[12px]">
              {(['positive', 'neutral', 'negative'] as const).map((s) => (
                <div
                  key={s}
                  style={{ width: `${result.sentiment[s]}%`, backgroundColor: sentimentColor[s] }}
                  title={`${sentimentLabel[s]}: ${result.sentiment[s]}%`}
                />
              ))}
            </div>
            <div className="flex gap-[16px]">
              {(['positive', 'neutral', 'negative'] as const).map((s) => (
                <div key={s} className="flex items-center gap-[6px]">
                  <div className="w-[8px] h-[8px] rounded-full" style={{ backgroundColor: sentimentColor[s] }} />
                  <span className="text-[12px] text-[var(--c-neutral-700)]">{sentimentLabel[s]} {result.sentiment[s]}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* Summary */}
          <div className="bg-[var(--c-ai-subtle)] border border-[#BAE6FD] rounded-[var(--r-md)] p-[16px]">
            <p className="text-[13px] text-[var(--c-neutral-700)] leading-relaxed">{result.summary}</p>
          </div>

          {/* Pain Points & Praises */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-[16px]">
            <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-[var(--r-md)] p-[16px]">
              <h3 className="text-[13px] font-bold text-[#991B1B] mb-[10px]">주요 페인포인트</h3>
              <ul className="space-y-[6px]">
                {result.topPainPoints.map((p, i) => (
                  <li key={i} className="text-[12.5px] text-[#7F1D1D] flex items-start gap-2">
                    <span className="mt-[3px] shrink-0">•</span>{p}
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-[#F0FDF4] border border-[#A7F3D0] rounded-[var(--r-md)] p-[16px]">
              <h3 className="text-[13px] font-bold text-[#065F46] mb-[10px]">주요 칭찬 포인트</h3>
              <ul className="space-y-[6px]">
                {result.topPraises.map((p, i) => (
                  <li key={i} className="text-[12.5px] text-[#064E3B] flex items-start gap-2">
                    <span className="mt-[3px] shrink-0">•</span>{p}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Themes */}
          <div>
            <div className="flex items-center gap-[8px] mb-[12px]">
              <h2 className="text-[14px] font-bold text-[var(--c-neutral-900)]">테마별 분석</h2>
              <div className="flex gap-[4px]">
                {SENTIMENT_FILTER.map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={`text-[11px] px-[10px] py-[3px] rounded-full font-semibold transition-all ${filter === f ? 'bg-[var(--c-primary)] text-white' : 'bg-[var(--c-neutral-100)] text-[var(--c-neutral-500)] hover:bg-[var(--c-neutral-200)]'}`}
                  >
                    {f === 'all' ? '전체' : sentimentLabel[f]}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-[12px]">
              {filteredThemes.map((theme) => (
                <div key={theme.id} className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[var(--r-md)] p-[16px]">
                  <div className="flex items-center justify-between mb-[8px]">
                    <span className="text-[13.5px] font-bold text-[var(--c-neutral-900)]">{theme.label}</span>
                    <div className="flex items-center gap-[6px]">
                      <Badge variant={theme.sentiment === 'positive' ? 'success' : theme.sentiment === 'negative' ? 'error' : 'neutral'}>
                        {sentimentLabel[theme.sentiment]}
                      </Badge>
                      <span className="text-[11px] text-[var(--c-neutral-500)]">{theme.count}건</span>
                    </div>
                  </div>
                  <ul className="space-y-[4px]">
                    {theme.examples.map((ex, i) => (
                      <li key={i} className="text-[12px] text-[var(--c-neutral-700)] pl-[10px] border-l-[2px] border-[var(--c-border)] italic">
                        "{ex}"
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-10 text-[var(--c-neutral-500)]">데이터를 불러올 수 없습니다.</div>
      )}

      <div className="fixed bottom-0 left-0 md:left-[var(--sidebar-w)] right-0 bg-[var(--c-surface)] border-t border-[var(--c-border)] p-[12px_28px] flex items-center justify-between z-[100] shadow-[0_-4px_16px_rgba(26,24,64,0.06)]">
        <div className="flex items-center gap-[10px]">
          <span className="text-[11.5px] text-[var(--c-neutral-500)]">진행률 50%</span>
          <div className="w-[100px] h-[4px] bg-[var(--c-border)] rounded-[2px] overflow-hidden">
            <div className="h-full bg-[var(--c-primary)] w-[50%] transition-all"></div>
          </div>
        </div>
        <div className="flex items-center gap-[10px]">
          <Button variant="ghost" onClick={() => router.push('/steps/3')}>이전</Button>
          <Button variant="primary" disabled={loading || !result} onClick={() => router.push('/steps/5')}>
            다음 단계
          </Button>
        </div>
      </div>
    </>
  );
}
