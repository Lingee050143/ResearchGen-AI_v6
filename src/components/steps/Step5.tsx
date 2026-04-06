'use client';
import React, { useEffect, useState } from 'react';
import { useResearchStore } from '@/store/useResearchStore';
import { useRouter } from 'next/navigation';
import { Button } from '../ui/Button';
import { useApiKey } from '../ui/ApiKeyModal';
import { runClaudeWithRetry, buildContextMetadata } from '@/lib/claudeEngine';
import { z } from 'zod';

const Step5Schema = z.object({
  clusters: z.array(z.object({
    id: z.string(),
    category: z.string(),
    color: z.string(),
    insights: z.array(z.object({
      id: z.string(),
      text: z.string(),
      source: z.string(),
    })),
  })),
  keyTakeaway: z.string(),
});

type Step5Result = z.infer<typeof Step5Schema>;

const CLUSTER_COLORS = [
  '#EDE9FE', '#FEF3C7', '#D1FAE5', '#FEE2E2', '#DBEAFE', '#FCE7F3',
];

export function Step5() {
  const { data, updateData, setStep, userOverrides } = useResearchStore();
  const router = useRouter();
  const { apiKey } = useApiKey();

  const [loading, setLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [error, setError] = useState('');

  const result = data.insightsMap?.clusters ? (data.insightsMap as Step5Result) : undefined;

  useEffect(() => {
    setStep(5);
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

      const result = await runClaudeWithRetry(
        apiKey,
        {
          system: 'You are an expert UX Researcher. Cluster insights from review analysis and HMW questions into an affinity map. Return ONLY valid JSON.',
          messages: [
            {
              role: 'user',
              content: `Context:\n${context}\n\nCreate an insights map by clustering key findings into 4-6 categories. Return JSON:\n{\n  "clusters": [\n    {\n      "id": "c1",\n      "category": "클러스터 카테고리명",\n      "color": "#EDE9FE",\n      "insights": [\n        { "id": "i1", "text": "인사이트 내용", "source": "경쟁사A 리뷰" }\n      ]\n    }\n  ],\n  "keyTakeaway": "핵심 시사점 2~3문장"\n}\nEach cluster should have 3-5 insights. All text in Korean.`,
            },
          ],
        },
        Step5Schema,
        setProgressMsg
      );

      // Assign fallback colors if needed
      const coloredResult = {
        ...result,
        clusters: result.clusters.map((c, i) => ({
          ...c,
          color: c.color || CLUSTER_COLORS[i % CLUSTER_COLORS.length],
        })),
      };

      updateData('insightsMap', { ...data.insightsMap, ...coloredResult });
    } catch (err: any) {
      setError(err.message || '인사이트 맵 생성 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <div className="flex items-center gap-[8px] mb-[8px]">
        <div className="w-[32px] h-[32px] bg-[var(--c-primary-100)] rounded-[8px] flex items-center justify-center text-[16px]">🗺️</div>
        <div className="text-[11px] font-bold tracking-[0.1em] uppercase text-[var(--c-primary)]">STEP 5</div>
      </div>
      <h1 className="text-[26px] font-[800] text-[var(--c-neutral-900)] tracking-[-0.02em] mb-[6px]">인사이트 맵</h1>
      <p className="text-[13.5px] text-[var(--c-neutral-500)] mb-[32px]">
        리뷰 분석과 HMW 질문을 클러스터링하여 핵심 인사이트를 도출합니다.
      </p>

      {loading ? (
        <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[var(--r-lg)] p-[32px] text-center flex flex-col items-center justify-center">
          <div className="w-[8px] h-[8px] rounded-full bg-[var(--c-ai-processing)] animate-pulse mb-4"></div>
          <p className="text-[14px] font-bold text-[var(--c-ai)]">{progressMsg || 'AI가 인사이트를 클러스터링하고 있습니다...'}</p>
        </div>
      ) : error ? (
        <div className="bg-[#FEF2F2] border border-[#FCA5A5] rounded-[var(--r-md)] p-[16px]">
          <p className="text-[#B91C1C] text-[13px] font-semibold flex items-center gap-2">⚠️ {error}</p>
          <Button variant="secondary" size="sm" className="mt-3" onClick={runAnalysis}>재시도</Button>
        </div>
      ) : result?.clusters ? (
        <div className="space-y-[24px]">
          {/* Key Takeaway */}
          <div className="bg-[var(--c-ai-subtle)] border border-[#BAE6FD] rounded-[var(--r-md)] p-[16px]">
            <p className="text-[13px] font-semibold text-[var(--c-ai)] mb-[4px]">핵심 시사점</p>
            <p className="text-[13px] text-[var(--c-neutral-700)] leading-relaxed">{result.keyTakeaway}</p>
          </div>

          {/* Clusters Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-[16px]">
            {result.clusters.map((cluster) => (
              <div
                key={cluster.id}
                className="border border-[var(--c-border)] rounded-[var(--r-md)] overflow-hidden"
              >
                <div
                  className="px-[16px] py-[12px]"
                  style={{ backgroundColor: cluster.color }}
                >
                  <span className="text-[13.5px] font-bold text-[var(--c-neutral-900)]">{cluster.category}</span>
                  <span className="ml-[8px] text-[11px] text-[var(--c-neutral-700)]">{cluster.insights.length}개 인사이트</span>
                </div>
                <div className="bg-[var(--c-surface)] divide-y divide-[var(--c-border)]">
                  {cluster.insights.map((insight) => (
                    <div key={insight.id} className="px-[16px] py-[10px]">
                      <p className="text-[12.5px] text-[var(--c-neutral-900)] leading-snug">{insight.text}</p>
                      <span className="text-[10.5px] text-[var(--c-neutral-500)] mt-[4px] inline-block">
                        출처: {insight.source}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="text-center py-10 text-[var(--c-neutral-500)]">데이터를 불러올 수 없습니다.</div>
      )}

      <div className="fixed bottom-0 left-0 md:left-[var(--sidebar-w)] right-0 bg-[var(--c-surface)] border-t border-[var(--c-border)] p-[12px_28px] flex items-center justify-between z-[100] shadow-[0_-4px_16px_rgba(26,24,64,0.06)]">
        <div className="flex items-center gap-[10px]">
          <span className="text-[11.5px] text-[var(--c-neutral-500)]">진행률 60%</span>
          <div className="w-[100px] h-[4px] bg-[var(--c-border)] rounded-[2px] overflow-hidden">
            <div className="h-full bg-[var(--c-primary)] w-[60%] transition-all"></div>
          </div>
        </div>
        <div className="flex items-center gap-[10px]">
          <Button variant="ghost" onClick={() => router.push('/steps/4')}>이전</Button>
          <Button variant="primary" disabled={loading || !result?.clusters} onClick={() => router.push('/steps/6')}>
            다음 단계
          </Button>
        </div>
      </div>
    </>
  );
}
