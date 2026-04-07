'use client';
import React, { useEffect, useState } from 'react';
import { Copy } from 'lucide-react';
import { useResearchStore } from '@/store/useResearchStore';
import { useRouter } from 'next/navigation';
import { Button } from '../ui/Button';
import { Badge } from '../ui/Badge';
import { EditableText } from '../ui/EditableText';
import { useApiKey } from '../ui/ApiKeyModal';
import { runClaudeWithRetry, buildContextMetadata, generateAIReviews, ReviewsResult } from '@/lib/claudeEngine';
import { z } from 'zod';

// ─── Schema ───────────────────────────────────────────────────────────────────

const TaggedReviewSchema = z.object({
  id: z.string(),
  text: z.string(),
  sentiment: z.enum(['positive', 'neutral', 'negative']),
  competitor: z.string(),
  theme: z.string(),
});

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
  taggedReviews: z.array(TaggedReviewSchema).optional(),
});

type Step4Result = z.infer<typeof Step4Schema>;

// ─── Constants ────────────────────────────────────────────────────────────────

const SENTIMENT_FILTER = ['all', 'positive', 'neutral', 'negative'] as const;
type SentimentFilter = typeof SENTIMENT_FILTER[number];

const SENTIMENT_COLOR: Record<string, string> = {
  positive: 'var(--c-success)',
  neutral: 'var(--c-warning)',
  negative: 'var(--c-error)',
};
const SENTIMENT_LABEL: Record<string, string> = {
  positive: '긍정',
  neutral: '중립',
  negative: '부정',
};

const PAGE_SIZE = 15;

// ─── Sub-components ───────────────────────────────────────────────────────────

function Toast({ message }: { message: string }) {
  if (!message) return null;
  return (
    <div
      className="fixed z-[300] bg-[var(--c-neutral-900)] text-white text-[12px] font-semibold px-[16px] py-[8px] rounded-full shadow-lg pointer-events-none"
      style={{ bottom: '80px', left: '50%', transform: 'translateX(-50%)' }}
    >
      ✓ {message}
    </div>
  );
}

function Pagination({
  page,
  total,
  onChange,
}: {
  page: number;
  total: number;
  onChange: (p: number) => void;
}) {
  const pages = Math.ceil(total / PAGE_SIZE);
  if (pages <= 1) return null;

  const getPageNumbers = () => {
    const nums: (number | '…')[] = [];
    if (pages <= 7) {
      for (let i = 1; i <= pages; i++) nums.push(i);
    } else {
      nums.push(1);
      if (page > 3) nums.push('…');
      for (let i = Math.max(2, page - 1); i <= Math.min(pages - 1, page + 1); i++) nums.push(i);
      if (page < pages - 2) nums.push('…');
      nums.push(pages);
    }
    return nums;
  };

  const btnClass = (active: boolean, disabled = false) =>
    `min-w-[30px] h-[30px] flex items-center justify-center text-[12px] rounded-[4px] font-semibold transition-all
     ${active ? 'bg-[var(--c-primary)] text-white' : 'bg-[var(--c-surface)] border border-[var(--c-border)] text-[var(--c-neutral-700)] hover:border-[var(--c-primary)]'}
     ${disabled ? 'opacity-40 cursor-not-allowed pointer-events-none' : 'cursor-pointer'}`;

  return (
    <div className="flex items-center gap-[4px] justify-center mt-[16px]">
      <button className={btnClass(false, page === 1)} onClick={() => onChange(page - 1)}>‹</button>
      {getPageNumbers().map((n, i) =>
        n === '…'
          ? <span key={`e${i}`} className="px-[4px] text-[var(--c-neutral-500)] text-[12px]">…</span>
          : <button key={n} className={btnClass(n === page)} onClick={() => onChange(n as number)}>{n}</button>
      )}
      <button className={btnClass(false, page === pages)} onClick={() => onChange(page + 1)}>›</button>
    </div>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function Step4() {
  const { data, updateData, setStep, userOverrides } = useResearchStore();
  const router = useRouter();
  const { apiKey } = useApiKey();

  const [loading, setLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [error, setError] = useState('');
  const [aiMockLoading, setAiMockLoading] = useState(false);
  const [aiMockProgressMsg, setAiMockProgressMsg] = useState('');
  const [aiMockError, setAiMockError] = useState('');
  const [themeFilter, setThemeFilter] = useState<SentimentFilter>('all');
  const [reviewFilter, setReviewFilter] = useState<SentimentFilter>('all');
  const [reviewPage, setReviewPage] = useState(1);
  const [toast, setToast] = useState('');

  const result = (data.insightsMap as any)?.reviewAnalysis as Step4Result | undefined;
  const isAiGenerated = !!(data.insightsMap as any)?.isAiGenerated;

  const hasRealReviews = Array.isArray(data.competitors) &&
    (data.competitors as any[]).some((c: any) => Array.isArray(c.reviews) && c.reviews.length > 0);

  useEffect(() => {
    setStep(4);
    if (!result && apiKey && hasRealReviews) runAnalysis();
  }, [setStep, apiKey]);

  // ── AI call ────────────────────────────────────────────────────────────────

  const runAnalysis = async () => {
    if (!apiKey) return;
    setLoading(true);
    setError('');

    try {
      const competitors = (data.competitors as any[]) || [];
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

      const res = await runClaudeWithRetry(
        apiKey,
        {
          max_tokens: 6000,
          system: 'You are an expert UX Researcher specializing in review analysis. Return ONLY valid JSON.',
          messages: [{
            role: 'user',
            content: `Project context: ${context}\n\nCompetitor reviews:\n${JSON.stringify(reviewSample, null, 2)}\n\nReturn JSON:\n{\n  "sentiment": { "positive": 45, "neutral": 25, "negative": 30 },\n  "themes": [{ "id": "t1", "label": "테마", "sentiment": "negative", "count": 120, "examples": ["예시1", "예시2"] }],\n  "topPainPoints": ["포인트1", "포인트2", "포인트3"],\n  "topPraises": ["칭찬1", "칭찬2", "칭찬3"],\n  "summary": "전체 분석 요약 2~3문장",\n  "taggedReviews": [{ "id": "r1", "text": "리뷰 원문 (최대 150자)", "sentiment": "negative", "competitor": "경쟁사명", "theme": "연관 테마" }]\n}\nGenerate 5-8 themes. Include 50-60 representative taggedReviews (mix of sentiments). All text in Korean.`,
          }],
        },
        Step4Schema,
        setProgressMsg
      );

      updateData('insightsMap', { ...(data.insightsMap || {}), reviewAnalysis: res });
    } catch (err: any) {
      setError(err.message || '리뷰 분석 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // ── AI mock review generator ───────────────────────────────────────────────

  const runAIReviews = async () => {
    if (!apiKey) return;
    setAiMockLoading(true);
    setAiMockError('');
    setAiMockProgressMsg('');

    try {
      const ideaText = typeof data.idea === 'object'
        ? ((data.idea as any).serviceName || (data.idea as any).idea || JSON.stringify(data.idea))
        : String(data.idea || '');

      const aiResult: ReviewsResult = await generateAIReviews(ideaText, apiKey, setAiMockProgressMsg);

      // Map ReviewsResult → Step4Result for unified display
      const mapped: Step4Result = {
        sentiment: {
          positive: aiResult.sentimentStats.positive,
          neutral: aiResult.sentimentStats.neutral,
          negative: aiResult.sentimentStats.negative,
        },
        themes: aiResult.topicClusters.map((cluster, i) => {
          const clusterReviews = aiResult.reviews.filter((_, ri) => ri % aiResult.topicClusters.length === i);
          const sentimentCounts = { positive: 0, negative: 0, neutral: 0 };
          clusterReviews.forEach(r => sentimentCounts[r.sentiment.toLowerCase() as keyof typeof sentimentCounts]++);
          const dominantSentiment = (Object.entries(sentimentCounts).sort((a, b) => b[1] - a[1])[0][0]) as 'positive' | 'negative' | 'neutral';
          return {
            id: `tc${i + 1}`,
            label: cluster,
            sentiment: dominantSentiment,
            count: clusterReviews.length,
            examples: clusterReviews.slice(0, 2).map(r => r.content),
          };
        }),
        topPainPoints: aiResult.topComplaints,
        topPraises: aiResult.praisedFeatures,
        summary: `AI가 생성한 ${aiResult.reviews.length}개의 가상 사용자 리뷰 분석 결과입니다. 긍정 ${aiResult.sentimentStats.positive}% / 부정 ${aiResult.sentimentStats.negative}% / 중립 ${aiResult.sentimentStats.neutral}%`,
        taggedReviews: aiResult.reviews.map(r => ({
          id: r.id,
          text: r.content,
          sentiment: r.sentiment.toLowerCase() as 'positive' | 'negative' | 'neutral',
          competitor: 'AI 가상 사용자',
          theme: aiResult.topicClusters[aiResult.reviews.indexOf(r) % aiResult.topicClusters.length] || '일반',
        })),
      };

      updateData('insightsMap', {
        ...(data.insightsMap || {}),
        reviewAnalysis: mapped,
        isAiGenerated: true,
      });
    } catch (err: any) {
      setAiMockError(err.message || 'AI 리뷰 생성 중 오류가 발생했습니다.');
    } finally {
      setAiMockLoading(false);
    }
  };

  // ── Inline edit helpers ────────────────────────────────────────────────────

  const patchAnalysis = (patch: Partial<Step4Result>) => {
    updateData('insightsMap', {
      ...(data.insightsMap || {}),
      reviewAnalysis: { ...result, ...patch },
    }, true);
  };

  const saveSummary = (v: string) => patchAnalysis({ summary: v });

  const savePainPoint = (idx: number, v: string) => {
    const arr = [...(result?.topPainPoints || [])];
    arr[idx] = v;
    patchAnalysis({ topPainPoints: arr });
  };

  const savePraise = (idx: number, v: string) => {
    const arr = [...(result?.topPraises || [])];
    arr[idx] = v;
    patchAnalysis({ topPraises: arr });
  };

  const saveThemeLabel = (themeId: string, v: string) => {
    const themes = (result?.themes || []).map(t => t.id === themeId ? { ...t, label: v } : t);
    patchAnalysis({ themes });
  };

  const saveThemeExample = (themeId: string, exIdx: number, v: string) => {
    const themes = (result?.themes || []).map(t => {
      if (t.id !== themeId) return t;
      const examples = [...t.examples];
      examples[exIdx] = v;
      return { ...t, examples };
    });
    patchAnalysis({ themes });
  };

  // ── Copy helpers ──────────────────────────────────────────────────────────

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2000);
  };

  const copyTheme = (theme: Step4Result['themes'][number]) => {
    const md = `## ${theme.label}\n**감정**: ${SENTIMENT_LABEL[theme.sentiment]} | **언급 수**: ${theme.count}건\n\n### 대표 사례\n${theme.examples.map(e => `- "${e}"`).join('\n')}`;
    navigator.clipboard.writeText(md);
    showToast('테마 카드가 복사됐습니다!');
  };

  const copyAll = () => {
    if (!result) return;
    const md = [
      `# 리뷰 분석 결과`,
      `## 감정 분포\n긍정 ${result.sentiment.positive}% / 중립 ${result.sentiment.neutral}% / 부정 ${result.sentiment.negative}%`,
      `## 요약\n${result.summary}`,
      `## 주요 페인포인트\n${result.topPainPoints.map(p => `- ${p}`).join('\n')}`,
      `## 주요 칭찬 포인트\n${result.topPraises.map(p => `- ${p}`).join('\n')}`,
      result.themes.map(t =>
        `## 테마: ${t.label}\n**감정**: ${SENTIMENT_LABEL[t.sentiment]} | **언급 수**: ${t.count}건\n${t.examples.map(e => `- "${e}"`).join('\n')}`
      ).join('\n\n'),
    ].join('\n\n');
    navigator.clipboard.writeText(md);
    showToast('전체 분석 결과가 복사됐습니다!');
  };

  // ── Review table ──────────────────────────────────────────────────────────

  const filteredReviews = (result?.taggedReviews || []).filter(
    r => reviewFilter === 'all' || r.sentiment === reviewFilter
  );
  const pagedReviews = filteredReviews.slice((reviewPage - 1) * PAGE_SIZE, reviewPage * PAGE_SIZE);

  // Reset page when filter changes
  const handleReviewFilter = (f: SentimentFilter) => {
    setReviewFilter(f);
    setReviewPage(1);
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="flex items-center gap-[8px] mb-[8px]">
        <div className="w-[32px] h-[32px] bg-[var(--c-primary-100)] rounded-[8px] flex items-center justify-center text-[16px]">📊</div>
        <div className="text-[11px] font-bold tracking-[0.1em] uppercase text-[var(--c-primary)]">STEP 4</div>
      </div>
      <h1 className="text-[26px] font-[800] text-[var(--c-neutral-900)] tracking-[-0.02em] mb-[6px]">리뷰 분석</h1>
      <p className="text-[13.5px] text-[var(--c-neutral-500)] mb-[32px]">
        경쟁사 리뷰에서 감정 분포와 핵심 테마를 추출합니다. 텍스트를 클릭하면 직접 수정할 수 있습니다.
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
      ) : !hasRealReviews && !result ? (
        /* ── No CSV data: AI mock CTA ───────────────────────────────────── */
        <div className="flex flex-col items-center justify-center py-[60px] px-[24px] text-center">
          <div className="text-[48px] mb-[16px]">🤖</div>
          <h2 className="text-[18px] font-[800] text-[var(--c-neutral-900)] mb-[8px]">업로드된 리뷰 데이터가 없습니다</h2>
          <p className="text-[13px] text-[var(--c-neutral-500)] mb-[28px] max-w-[380px] leading-relaxed">
            경쟁사 CSV를 업로드하지 않으셨나요? AI가 아이디어를 기반으로 가상의 사용자 리뷰 8개를 즉시 생성하고 분석해 드립니다.
          </p>

          {aiMockError && (
            <div className="bg-[#FEF2F2] border border-[#FCA5A5] rounded-[var(--r-md)] p-[12px] mb-[16px] text-[12.5px] text-[#B91C1C] font-semibold w-full max-w-[420px]">
              ⚠️ {aiMockError}
            </div>
          )}

          {aiMockLoading ? (
            <div className="flex flex-col items-center gap-[12px]">
              <span className="w-[20px] h-[20px] border-[2.5px] border-purple-500 border-t-transparent rounded-full animate-spin" />
              <p className="text-[13px] text-purple-700 font-semibold max-w-[320px]">
                {aiMockProgressMsg || 'AI가 가상 사용자를 생성하고 리뷰를 분석 중입니다...'}
              </p>
            </div>
          ) : (
            <button
              onClick={runAIReviews}
              disabled={!apiKey}
              className="inline-flex items-center gap-[10px] px-[28px] py-[14px] rounded-[var(--r-sm)] font-[700] text-[14px] text-white transition-all duration-150 disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-purple-400"
              style={{
                background: 'linear-gradient(135deg, #7C3AED, #4F46E5)',
                boxShadow: '0 6px 20px rgba(124,58,237,0.35)',
              }}
            >
              ✨ AI 가상 리뷰 8개 생성 및 분석하기
            </button>
          )}
        </div>
      ) : result ? (
        <div className="space-y-[24px] pb-[80px]">

          {/* Header actions */}
          <div className="flex justify-end gap-[8px]">
            {isAiGenerated && (
              <span className="inline-flex items-center gap-[5px] text-[11px] font-bold text-purple-700 bg-purple-100 border border-purple-200 px-[10px] py-[4px] rounded-full">
                🤖 AI 가상 생성 데이터
              </span>
            )}
          </div>
          <div className="flex justify-end gap-[8px]">
            <button
              onClick={copyAll}
              className="flex items-center gap-[5px] text-[11.5px] text-[var(--c-neutral-500)] hover:text-[var(--c-primary)] border border-[var(--c-border)] rounded-[var(--r-sm)] px-[10px] py-[5px] transition-all hover:border-[var(--c-primary)]"
            >
              <Copy size={12} />전체 복사
            </button>
            <button
              onClick={runAnalysis}
              className="text-[11.5px] text-[var(--c-neutral-500)] hover:text-[var(--c-primary)] border border-[var(--c-border)] rounded-[var(--r-sm)] px-[10px] py-[5px] transition-all hover:border-[var(--c-primary)]"
            >
              다시 생성
            </button>
          </div>

          {/* 1. Sentiment Distribution */}
          <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[var(--r-md)] p-[20px]">
            <h2 className="text-[14px] font-bold text-[var(--c-neutral-900)] mb-[16px]">감정 분포</h2>
            <div className="flex gap-[4px] h-[32px] rounded-[var(--r-sm)] overflow-hidden mb-[12px]">
              {(['positive', 'neutral', 'negative'] as const).map(s => (
                <div
                  key={s}
                  style={{ width: `${result.sentiment[s]}%`, backgroundColor: SENTIMENT_COLOR[s] }}
                  title={`${SENTIMENT_LABEL[s]}: ${result.sentiment[s]}%`}
                />
              ))}
            </div>
            <div className="flex gap-[16px]">
              {(['positive', 'neutral', 'negative'] as const).map(s => (
                <div key={s} className="flex items-center gap-[6px]">
                  <div className="w-[8px] h-[8px] rounded-full" style={{ backgroundColor: SENTIMENT_COLOR[s] }} />
                  <span className="text-[12px] text-[var(--c-neutral-700)]">{SENTIMENT_LABEL[s]} {result.sentiment[s]}%</span>
                </div>
              ))}
            </div>
          </div>

          {/* 2. Summary (editable) */}
          <div className="bg-[#E0F2FE] border border-[#BAE6FD] rounded-[var(--r-md)] p-[16px]">
            <p className="text-[11px] font-bold text-[var(--c-ai)] uppercase tracking-wider mb-[6px]">AI 요약</p>
            <EditableText
              value={result.summary}
              onSave={saveSummary}
              as="textarea"
              rows={3}
              className="text-[13px] text-[var(--c-neutral-700)] leading-relaxed w-full block"
            />
          </div>

          {/* 3. Pain Points & Praises (editable) */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-[16px]">
            <div className="bg-[#FEF2F2] border border-[#FECACA] rounded-[var(--r-md)] p-[16px]">
              <h3 className="text-[13px] font-bold text-[#991B1B] mb-[10px]">주요 페인포인트</h3>
              <ul className="space-y-[6px]">
                {result.topPainPoints.map((p, i) => (
                  <li key={i} className="text-[12.5px] text-[#7F1D1D] flex items-start gap-2">
                    <span className="mt-[3px] shrink-0">•</span>
                    <EditableText value={p} onSave={v => savePainPoint(i, v)} className="flex-1" />
                  </li>
                ))}
              </ul>
            </div>
            <div className="bg-[#F0FDF4] border border-[#A7F3D0] rounded-[var(--r-md)] p-[16px]">
              <h3 className="text-[13px] font-bold text-[#065F46] mb-[10px]">주요 칭찬 포인트</h3>
              <ul className="space-y-[6px]">
                {result.topPraises.map((p, i) => (
                  <li key={i} className="text-[12.5px] text-[#064E3B] flex items-start gap-2">
                    <span className="mt-[3px] shrink-0">•</span>
                    <EditableText value={p} onSave={v => savePraise(i, v)} className="flex-1" />
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* 4. Theme Cards (editable + copy) */}
          <div>
            <div className="flex items-center gap-[8px] mb-[12px]">
              <h2 className="text-[14px] font-bold text-[var(--c-neutral-900)]">테마별 분석</h2>
              <div className="flex gap-[4px]">
                {SENTIMENT_FILTER.map(f => (
                  <button
                    key={f}
                    onClick={() => setThemeFilter(f)}
                    className={`text-[11px] px-[10px] py-[3px] rounded-full font-semibold transition-all ${themeFilter === f ? 'bg-[var(--c-primary)] text-white' : 'bg-[var(--c-neutral-100)] text-[var(--c-neutral-500)] hover:bg-[var(--c-neutral-200)]'}`}
                  >
                    {f === 'all' ? '전체' : SENTIMENT_LABEL[f]}
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-[12px]">
              {result.themes
                .filter(t => themeFilter === 'all' || t.sentiment === themeFilter)
                .map(theme => (
                  <div key={theme.id} className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[var(--r-md)] p-[16px] relative group/card">
                    {/* Copy button */}
                    <button
                      onClick={() => copyTheme(theme)}
                      className="absolute top-[10px] right-[10px] opacity-0 group-hover/card:opacity-100 transition-opacity p-[4px] rounded-[4px] text-[var(--c-neutral-400)] hover:text-[var(--c-primary)] hover:bg-[var(--c-primary-100)]"
                      title="Markdown으로 복사"
                    >
                      <Copy size={13} />
                    </button>

                    <div className="flex items-center gap-[8px] mb-[8px] pr-[24px]">
                      <EditableText
                        value={theme.label}
                        onSave={v => saveThemeLabel(theme.id, v)}
                        className="text-[13.5px] font-bold text-[var(--c-neutral-900)]"
                      />
                      <Badge variant={theme.sentiment === 'positive' ? 'success' : theme.sentiment === 'negative' ? 'error' : 'neutral'}>
                        {SENTIMENT_LABEL[theme.sentiment]}
                      </Badge>
                      <span className="text-[11px] text-[var(--c-neutral-500)] ml-auto shrink-0">{theme.count}건</span>
                    </div>

                    <ul className="space-y-[4px]">
                      {theme.examples.map((ex, i) => (
                        <li key={i} className="text-[12px] text-[var(--c-neutral-700)] pl-[10px] border-l-[2px] border-[var(--c-border)] italic flex">
                          <span className="mr-[2px]">"</span>
                          <EditableText
                            value={ex}
                            onSave={v => saveThemeExample(theme.id, i, v)}
                            className="flex-1"
                          />
                          <span className="ml-[2px]">"</span>
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
            </div>
          </div>

          {/* 5. Tagged Review Table (with pagination) */}
          {(result.taggedReviews?.length ?? 0) > 0 && (
            <div className="bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[var(--r-md)] overflow-hidden">
              {/* Table header */}
              <div className="px-[16px] py-[12px] border-b border-[var(--c-border)] flex items-center justify-between flex-wrap gap-[8px]">
                <h2 className="text-[14px] font-bold text-[var(--c-neutral-900)]">
                  원본 피드백 리스트
                  <span className="ml-[8px] text-[11px] font-normal text-[var(--c-neutral-500)]">
                    ({filteredReviews.length}건)
                  </span>
                </h2>
                {/* Sentiment filter tabs */}
                <div className="flex gap-[4px]">
                  {SENTIMENT_FILTER.map(f => (
                    <button
                      key={f}
                      onClick={() => handleReviewFilter(f)}
                      className={`text-[11px] px-[10px] py-[3px] rounded-full font-semibold transition-all ${reviewFilter === f ? 'bg-[var(--c-primary)] text-white' : 'bg-[var(--c-neutral-100)] text-[var(--c-neutral-500)] hover:bg-[var(--c-neutral-200)]'}`}
                    >
                      {f === 'all' ? `전체 ${result.taggedReviews!.length}` : `${SENTIMENT_LABEL[f]} ${result.taggedReviews!.filter(r => r.sentiment === f).length}`}
                    </button>
                  ))}
                </div>
              </div>

              {/* Table */}
              <div className="overflow-x-auto">
                <table className="w-full text-[12.5px]">
                  <thead>
                    <tr className="bg-[var(--c-neutral-50)] border-b border-[var(--c-border)]">
                      <th className="text-left px-[16px] py-[10px] text-[11px] font-bold text-[var(--c-neutral-500)] uppercase tracking-wider w-[40px]">#</th>
                      <th className="text-left px-[12px] py-[10px] text-[11px] font-bold text-[var(--c-neutral-500)] uppercase tracking-wider">리뷰 내용</th>
                      <th className="text-left px-[12px] py-[10px] text-[11px] font-bold text-[var(--c-neutral-500)] uppercase tracking-wider w-[72px]">감정</th>
                      <th className="text-left px-[12px] py-[10px] text-[11px] font-bold text-[var(--c-neutral-500)] uppercase tracking-wider w-[100px]">경쟁사</th>
                      <th className="text-left px-[12px] py-[10px] text-[11px] font-bold text-[var(--c-neutral-500)] uppercase tracking-wider w-[120px]">연관 테마</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[var(--c-border)]">
                    {pagedReviews.map((rev, i) => (
                      <tr key={rev.id} className="hover:bg-[var(--c-neutral-50)] transition-colors">
                        <td className="px-[16px] py-[10px] text-[var(--c-neutral-500)]">
                          {(reviewPage - 1) * PAGE_SIZE + i + 1}
                        </td>
                        <td className="px-[12px] py-[10px] text-[var(--c-neutral-700)] leading-snug max-w-[400px]">
                          {rev.text}
                        </td>
                        <td className="px-[12px] py-[10px]">
                          <Badge variant={rev.sentiment === 'positive' ? 'success' : rev.sentiment === 'negative' ? 'error' : 'neutral'}>
                            {SENTIMENT_LABEL[rev.sentiment]}
                          </Badge>
                        </td>
                        <td className="px-[12px] py-[10px] text-[var(--c-neutral-700)]">{rev.competitor}</td>
                        <td className="px-[12px] py-[10px] text-[var(--c-neutral-500)] text-[11.5px]">{rev.theme}</td>
                      </tr>
                    ))}
                    {pagedReviews.length === 0 && (
                      <tr>
                        <td colSpan={5} className="px-[16px] py-[24px] text-center text-[var(--c-neutral-500)]">
                          해당 감정의 리뷰가 없습니다.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="px-[16px] pb-[16px]">
                <Pagination page={reviewPage} total={filteredReviews.length} onChange={p => { setReviewPage(p); }} />
              </div>
            </div>
          )}
        </div>
      ) : (
        <div className="text-center py-10 text-[var(--c-neutral-500)]">분석 결과가 없습니다. 다시 시도해 주세요.</div>
      )}

      <Toast message={toast} />

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
