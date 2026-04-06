'use client';
import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Copy, ZoomIn, ZoomOut, Maximize2 } from 'lucide-react';
import { useResearchStore } from '@/store/useResearchStore';
import { useRouter } from 'next/navigation';
import { Button } from '../ui/Button';
import { EditableText } from '../ui/EditableText';
import { useApiKey } from '../ui/ApiKeyModal';
import { runClaudeWithRetry, buildContextMetadata } from '@/lib/claudeEngine';
import { z } from 'zod';

// ─── Schema ───────────────────────────────────────────────────────────────────

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
type Cluster = Step5Result['clusters'][number];

// ─── Canvas layout constants ──────────────────────────────────────────────────

const CARD_W = 270;
const CARD_H_BASE = 120; // header height; body grows with insights
const INSIGHT_H = 56;    // approximate per insight
const COL_GAP = 60;
const ROW_GAP = 60;
const CANVAS_PAD = 48;
const COLS = 3;

const FALLBACK_COLORS = ['#EDE9FE', '#FEF3C7', '#D1FAE5', '#FEE2E2', '#DBEAFE', '#FCE7F3'];

function getClusterLayout(clusters: Cluster[]) {
  return clusters.map((c, i) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    const x = CANVAS_PAD + col * (CARD_W + COL_GAP);
    // approx card height for row offset
    const rowH = Math.max(...clusters.slice(row * COLS, row * COLS + COLS).map(
      cl => CARD_H_BASE + cl.insights.length * INSIGHT_H
    ));
    const prevRowH = row === 0 ? 0 : (() => {
      let h = CANVAS_PAD;
      for (let r = 0; r < row; r++) {
        h += Math.max(...clusters.slice(r * COLS, r * COLS + COLS).map(
          cl => CARD_H_BASE + cl.insights.length * INSIGHT_H
        )) + ROW_GAP;
      }
      return h - CANVAS_PAD;
    })();
    const y = CANVAS_PAD + prevRowH;
    return { cluster: c, x, y, w: CARD_W, h: CARD_H_BASE + c.insights.length * INSIGHT_H };
  });
}

function getCanvasSize(clusters: Cluster[]) {
  const rows = Math.ceil(clusters.length / COLS);
  const cols = Math.min(clusters.length, COLS);
  const w = CANVAS_PAD * 2 + cols * CARD_W + (cols - 1) * COL_GAP;
  let h = CANVAS_PAD * 2;
  for (let r = 0; r < rows; r++) {
    const rowClusters = clusters.slice(r * COLS, r * COLS + COLS);
    h += Math.max(...rowClusters.map(c => CARD_H_BASE + c.insights.length * INSIGHT_H));
    if (r < rows - 1) h += ROW_GAP;
  }
  return { w, h };
}

// ─── Toast ────────────────────────────────────────────────────────────────────

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

// ─── Main Component ───────────────────────────────────────────────────────────

export function Step5() {
  const { data, updateData, setStep, userOverrides } = useResearchStore();
  const router = useRouter();
  const { apiKey } = useApiKey();

  // ── AI State ──────────────────────────────────────────────────────────────
  const [loading, setLoading] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [error, setError] = useState('');
  const [toast, setToast] = useState('');

  // ── Canvas transform state ────────────────────────────────────────────────
  const [transform, setTransform] = useState({ x: 40, y: 24, scale: 0.8 });
  const canvasRef = useRef<HTMLDivElement>(null);
  const isDragging = useRef(false);
  const dragOrigin = useRef({ x: 0, y: 0, tx: 0, ty: 0 });

  const result: Step5Result | undefined = (() => {
    const m = data.insightsMap as any;
    if (m?.clusters) return m as Step5Result;
    return undefined;
  })();

  useEffect(() => {
    setStep(5);
    if (!result && apiKey) runAnalysis();
  }, [setStep, apiKey]);

  // ── Non-passive wheel listener (required for preventDefault) ──────────────
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const handleWheel = (e: WheelEvent) => {
      e.preventDefault();
      const factor = e.deltaY < 0 ? 1.08 : 0.93;
      setTransform(t => ({
        ...t,
        scale: Math.min(2.5, Math.max(0.25, t.scale * factor)),
      }));
    };
    el.addEventListener('wheel', handleWheel, { passive: false });
    return () => el.removeEventListener('wheel', handleWheel);
  }, []);

  // ── Drag pan ──────────────────────────────────────────────────────────────
  const handleMouseDown = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('[data-no-pan]')) return;
    isDragging.current = true;
    dragOrigin.current = { x: e.clientX, y: e.clientY, tx: transform.x, ty: transform.y };
    e.currentTarget.setAttribute('style', 'cursor: grabbing');
  };

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isDragging.current) return;
    const dx = e.clientX - dragOrigin.current.x;
    const dy = e.clientY - dragOrigin.current.y;
    setTransform(t => ({ ...t, x: dragOrigin.current.tx + dx, y: dragOrigin.current.ty + dy }));
  }, []);

  const handleMouseUp = (e: React.MouseEvent) => {
    isDragging.current = false;
    e.currentTarget.setAttribute('style', 'cursor: grab');
  };

  const zoom = (delta: number) => {
    setTransform(t => ({
      ...t,
      scale: Math.min(2.5, Math.max(0.25, t.scale + delta)),
    }));
  };

  const resetView = () => setTransform({ x: 40, y: 24, scale: 0.8 });

  // ── AI call ────────────────────────────────────────────────────────────────

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
          system: 'You are an expert UX Researcher. Cluster insights from review analysis and HMW questions into an affinity map. Return ONLY valid JSON.',
          messages: [{
            role: 'user',
            content: `Context:\n${context}\n\nCreate an insights map by clustering key findings into 4-6 categories. Return JSON:\n{\n  "clusters": [\n    {\n      "id": "c1",\n      "category": "클러스터명",\n      "color": "#EDE9FE",\n      "insights": [\n        { "id": "i1", "text": "인사이트 내용", "source": "경쟁사A 리뷰" }\n      ]\n    }\n  ],\n  "keyTakeaway": "핵심 시사점 2~3문장"\n}\nEach cluster: 3-5 insights. Assign a soft pastel color to each. All text in Korean.`,
          }],
        },
        Step5Schema,
        setProgressMsg
      );

      const withColors = {
        ...res,
        clusters: res.clusters.map((c, i) => ({
          ...c,
          color: c.color || FALLBACK_COLORS[i % FALLBACK_COLORS.length],
        })),
      };

      updateData('insightsMap', { ...(data.insightsMap || {}), ...withColors });
    } catch (err: any) {
      setError(err.message || '인사이트 맵 생성 중 오류가 발생했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // ── Inline edit helpers ────────────────────────────────────────────────────

  const patchClusters = (clusters: Cluster[]) => {
    updateData('insightsMap', { ...(data.insightsMap || {}), clusters }, true);
  };

  const saveTakeaway = (v: string) => {
    updateData('insightsMap', { ...(data.insightsMap || {}), keyTakeaway: v }, true);
  };

  const saveClusterName = (clusterId: string, v: string) => {
    const updated = (result?.clusters || []).map(c =>
      c.id === clusterId ? { ...c, category: v } : c
    );
    patchClusters(updated);
  };

  const saveInsightText = (clusterId: string, insightId: string, v: string) => {
    const updated = (result?.clusters || []).map(c =>
      c.id === clusterId
        ? { ...c, insights: c.insights.map(i => i.id === insightId ? { ...i, text: v } : i) }
        : c
    );
    patchClusters(updated);
  };

  const saveInsightSource = (clusterId: string, insightId: string, v: string) => {
    const updated = (result?.clusters || []).map(c =>
      c.id === clusterId
        ? { ...c, insights: c.insights.map(i => i.id === insightId ? { ...i, source: v } : i) }
        : c
    );
    patchClusters(updated);
  };

  // ── Copy helpers ──────────────────────────────────────────────────────────

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(''), 2000);
  };

  const copyCluster = (c: Cluster) => {
    const md = `## ${c.category}\n${c.insights.map(i => `- ${i.text} *(출처: ${i.source})*`).join('\n')}`;
    navigator.clipboard.writeText(md);
    showToast(`"${c.category}" 클러스터가 복사됐습니다!`);
  };

  const copyAll = () => {
    if (!result) return;
    const md = [
      `# 인사이트 맵`,
      `## 핵심 시사점\n${result.keyTakeaway}`,
      ...result.clusters.map(c =>
        `## ${c.category}\n${c.insights.map(i => `- ${i.text} *(출처: ${i.source})*`).join('\n')}`
      ),
    ].join('\n\n');
    navigator.clipboard.writeText(md);
    showToast('전체 인사이트 맵이 복사됐습니다!');
  };

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <>
      <div className="flex items-center gap-[8px] mb-[8px]">
        <div className="w-[32px] h-[32px] bg-[var(--c-primary-100)] rounded-[8px] flex items-center justify-center text-[16px]">🗺️</div>
        <div className="text-[11px] font-bold tracking-[0.1em] uppercase text-[var(--c-primary)]">STEP 5</div>
      </div>
      <h1 className="text-[26px] font-[800] text-[var(--c-neutral-900)] tracking-[-0.02em] mb-[6px]">인사이트 맵</h1>
      <p className="text-[13.5px] text-[var(--c-neutral-500)] mb-[24px]">
        리뷰 분석과 HMW를 클러스터링합니다. 마우스 휠로 줌, 드래그로 이동, 텍스트 클릭으로 수정하세요.
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
        <div className="space-y-[16px] pb-[80px]">

          {/* Key Takeaway (editable) + global actions */}
          <div className="flex items-start gap-[12px]">
            <div className="flex-1 bg-[#E0F2FE] border border-[#BAE6FD] rounded-[var(--r-md)] p-[14px]">
              <p className="text-[11px] font-bold text-[var(--c-ai)] uppercase tracking-wider mb-[4px]">핵심 시사점</p>
              <EditableText
                value={result.keyTakeaway}
                onSave={saveTakeaway}
                as="textarea"
                rows={2}
                className="text-[13px] text-[var(--c-neutral-700)] leading-relaxed w-full block"
              />
            </div>
            <div className="flex flex-col gap-[6px] shrink-0">
              <button
                onClick={copyAll}
                className="flex items-center gap-[5px] text-[11.5px] text-[var(--c-neutral-500)] hover:text-[var(--c-primary)] border border-[var(--c-border)] rounded-[var(--r-sm)] px-[10px] py-[6px] transition-all hover:border-[var(--c-primary)] whitespace-nowrap"
              >
                <Copy size={12} />전체 복사
              </button>
              <button
                onClick={runAnalysis}
                className="text-[11.5px] text-[var(--c-neutral-500)] hover:text-[var(--c-primary)] border border-[var(--c-border)] rounded-[var(--r-sm)] px-[10px] py-[6px] transition-all hover:border-[var(--c-primary)]"
              >
                다시 생성
              </button>
            </div>
          </div>

          {/* ── Canvas ───────────────────────────────────────────────────── */}
          <div className="bg-[var(--c-neutral-50)] border border-[var(--c-border)] rounded-[var(--r-md)] overflow-hidden">
            {/* Toolbar */}
            <div className="flex items-center justify-between px-[14px] py-[8px] border-b border-[var(--c-border)] bg-[var(--c-surface)]">
              <span className="text-[11px] text-[var(--c-neutral-500)]">
                {result.clusters.length}개 클러스터 · 휠 줌 · 드래그 이동
              </span>
              <div className="flex items-center gap-[4px]">
                <button
                  data-no-pan
                  onClick={() => zoom(0.15)}
                  className="w-[28px] h-[28px] flex items-center justify-center rounded-[4px] border border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-neutral-700)] hover:border-[var(--c-primary)] hover:text-[var(--c-primary)] transition-all"
                >
                  <ZoomIn size={13} />
                </button>
                <button
                  data-no-pan
                  onClick={() => zoom(-0.15)}
                  className="w-[28px] h-[28px] flex items-center justify-center rounded-[4px] border border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-neutral-700)] hover:border-[var(--c-primary)] hover:text-[var(--c-primary)] transition-all"
                >
                  <ZoomOut size={13} />
                </button>
                <button
                  data-no-pan
                  onClick={resetView}
                  className="w-[28px] h-[28px] flex items-center justify-center rounded-[4px] border border-[var(--c-border)] bg-[var(--c-surface)] text-[var(--c-neutral-700)] hover:border-[var(--c-primary)] hover:text-[var(--c-primary)] transition-all"
                  title="뷰 초기화"
                >
                  <Maximize2 size={12} />
                </button>
                <span className="text-[10.5px] text-[var(--c-neutral-500)] ml-[6px] min-w-[36px] text-right">
                  {Math.round(transform.scale * 100)}%
                </span>
              </div>
            </div>

            {/* Zoom/Pan viewport */}
            <div
              ref={canvasRef}
              className="relative overflow-hidden"
              style={{ height: '580px', cursor: 'grab' }}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            >
              {/* Dot-grid background */}
              <div
                className="absolute inset-0 pointer-events-none"
                style={{
                  backgroundImage: 'radial-gradient(circle, var(--c-neutral-300) 1px, transparent 1px)',
                  backgroundSize: '28px 28px',
                  opacity: 0.5,
                }}
              />

              {/* Transformable canvas */}
              <div
                style={{
                  transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
                  transformOrigin: '0 0',
                  position: 'absolute',
                  top: 0,
                  left: 0,
                }}
              >
                {(() => {
                  const layout = getClusterLayout(result.clusters);
                  const { w: cw, h: ch } = getCanvasSize(result.clusters);
                  return (
                    <div style={{ width: cw, height: ch, position: 'relative' }}>
                      {layout.map(({ cluster, x, y, w }) => (
                        <div
                          key={cluster.id}
                          data-no-pan
                          className="absolute rounded-[10px] border border-[rgba(0,0,0,0.08)] shadow-[0_2px_12px_rgba(26,24,64,0.08)] overflow-hidden"
                          style={{ left: x, top: y, width: w, backgroundColor: cluster.color }}
                        >
                          {/* Cluster header */}
                          <div className="px-[14px] pt-[12px] pb-[8px] flex items-center justify-between">
                            <EditableText
                              value={cluster.category}
                              onSave={v => saveClusterName(cluster.id, v)}
                              className="text-[12.5px] font-bold text-[var(--c-neutral-900)] flex-1"
                            />
                            <div className="flex items-center gap-[6px] ml-[8px] shrink-0">
                              <span className="text-[10px] text-[var(--c-neutral-500)]">
                                {cluster.insights.length}개
                              </span>
                              <button
                                onClick={() => copyCluster(cluster)}
                                className="p-[3px] rounded-[3px] text-[var(--c-neutral-500)] hover:text-[var(--c-primary)] hover:bg-[rgba(255,255,255,0.6)] transition-all"
                                title="Markdown으로 복사"
                              >
                                <Copy size={12} />
                              </button>
                            </div>
                          </div>

                          {/* Insights */}
                          <div className="divide-y divide-[rgba(0,0,0,0.06)]">
                            {cluster.insights.map(insight => (
                              <div
                                key={insight.id}
                                className="px-[14px] py-[9px] bg-[rgba(255,255,255,0.72)]"
                              >
                                <EditableText
                                  value={insight.text}
                                  onSave={v => saveInsightText(cluster.id, insight.id, v)}
                                  as="textarea"
                                  rows={2}
                                  className="text-[11.5px] text-[var(--c-neutral-900)] leading-snug w-full block"
                                />
                                <EditableText
                                  value={insight.source}
                                  onSave={v => saveInsightSource(cluster.id, insight.id, v)}
                                  className="text-[10px] text-[var(--c-neutral-500)] mt-[3px] inline-block"
                                />
                              </div>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className="text-center py-10 text-[var(--c-neutral-500)]">데이터를 불러올 수 없습니다.</div>
      )}

      <Toast message={toast} />

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
