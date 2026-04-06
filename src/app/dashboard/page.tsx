'use client';
import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useResearchStore, SavedReport } from '@/store/useResearchStore';
import { FileText, Trash2, ArrowRight, Plus, Clock } from 'lucide-react';

const STEP_LABELS = [
  '', '아이디어 입력', 'AI 분석', '경쟁사 분석', '리뷰 분석',
  '인사이트 맵', '페르소나', '사용자 여정', '기회 지도', 'UX 보고서'
];

const STEP_COLORS: Record<number, string> = {
  1: '#6b7280',
  2: '#0ea5e9',
  3: '#8b5cf6',
  4: '#ec4899',
  5: '#f59e0b',
  6: '#10b981',
  7: '#3b82f6',
  8: '#ef4444',
  9: '#14b8a6',
};

function formatDate(iso: string) {
  const d = new Date(iso);
  return d.toLocaleDateString('ko-KR', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
}

function StepBadge({ step }: { step: number }) {
  const color = STEP_COLORS[step] || '#6b7280';
  const label = STEP_LABELS[step] || `Step ${step}`;
  return (
    <span
      className="inline-flex items-center gap-[5px] px-[8px] py-[3px] rounded-full text-[10px] font-semibold"
      style={{ background: `${color}22`, color }}
    >
      <span className="w-[5px] h-[5px] rounded-full inline-block" style={{ background: color }} />
      Step {step} · {label}
    </span>
  );
}

function ProgressBar({ step }: { step: number }) {
  const pct = Math.round((step / 9) * 100);
  return (
    <div className="w-full h-[4px] bg-[rgba(255,255,255,0.06)] rounded-full overflow-hidden">
      <div
        className="h-full rounded-full transition-all"
        style={{ width: `${pct}%`, background: STEP_COLORS[step] || '#0ea5e9' }}
      />
    </div>
  );
}

function ReportCard({ report, isActive, onOpen, onDelete }: {
  report: SavedReport;
  isActive: boolean;
  onOpen: () => void;
  onDelete: () => void;
}) {
  const [confirmDelete, setConfirmDelete] = useState(false);

  return (
    <div
      className={`relative group rounded-[14px] border transition-all cursor-pointer ${
        isActive
          ? 'border-[rgba(14,165,233,0.5)] bg-[rgba(14,165,233,0.06)]'
          : 'border-[var(--c-border)] bg-[var(--c-surface)] hover:border-[rgba(255,255,255,0.15)] hover:bg-[rgba(255,255,255,0.03)]'
      }`}
      onClick={onOpen}
    >
      {isActive && (
        <div className="absolute top-[12px] right-[12px] text-[9px] font-bold tracking-[0.08em] uppercase text-[var(--c-ai)] bg-[rgba(14,165,233,0.15)] px-[7px] py-[3px] rounded-full">
          현재 작업 중
        </div>
      )}
      <div className="p-[20px]">
        <div className="flex items-start gap-[12px]">
          <div className="w-[38px] h-[38px] rounded-[10px] bg-[rgba(14,165,233,0.1)] border border-[rgba(14,165,233,0.2)] flex items-center justify-center shrink-0">
            <FileText className="w-[18px] h-[18px] text-[var(--c-ai)]" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="text-[15px] font-semibold text-white leading-tight truncate pr-[60px]">
              {report.title}
            </div>
            <div className="flex items-center gap-[6px] mt-[6px] flex-wrap">
              <StepBadge step={report.currentStep} />
            </div>
          </div>
        </div>

        <div className="mt-[16px]">
          <ProgressBar step={report.currentStep} />
          <div className="flex items-center justify-between mt-[8px]">
            <div className="flex items-center gap-[5px] text-[11px] text-[var(--c-neutral-500)]">
              <Clock className="w-[11px] h-[11px]" />
              {formatDate(report.updatedAt)}
            </div>
            <div className="text-[11px] text-[var(--c-neutral-500)]">
              {Math.round((report.currentStep / 9) * 100)}% 완료
            </div>
          </div>
        </div>
      </div>

      <div className="px-[20px] pb-[16px] flex items-center justify-between border-t border-[rgba(255,255,255,0.05)] pt-[14px]">
        <button
          onClick={(e) => {
            e.stopPropagation();
            if (confirmDelete) {
              onDelete();
            } else {
              setConfirmDelete(true);
              setTimeout(() => setConfirmDelete(false), 3000);
            }
          }}
          className={`flex items-center gap-[5px] text-[11px] px-[8px] py-[4px] rounded-[6px] transition-all ${
            confirmDelete
              ? 'text-red-400 bg-[rgba(239,68,68,0.15)]'
              : 'text-[var(--c-neutral-500)] hover:text-red-400 hover:bg-[rgba(239,68,68,0.1)]'
          }`}
        >
          <Trash2 className="w-[11px] h-[11px]" />
          {confirmDelete ? '한번 더 클릭하면 삭제' : '삭제'}
        </button>

        <button
          onClick={(e) => { e.stopPropagation(); onOpen(); }}
          className="flex items-center gap-[5px] text-[12px] font-semibold text-[var(--c-ai)] hover:text-white transition-all"
        >
          이어서 작업
          <ArrowRight className="w-[13px] h-[13px]" />
        </button>
      </div>
    </div>
  );
}

export default function DashboardPage() {
  const { savedReports, activeReportId, loadReport, deleteReport, startNewResearch } = useResearchStore();
  const router = useRouter();

  const handleOpen = (report: SavedReport) => {
    loadReport(report.id);
    router.push(`/steps/${report.currentStep}`);
  };

  const handleNewResearch = () => {
    startNewResearch();
    router.push('/steps/1');
  };

  const sorted = [...savedReports].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  return (
    <div className="max-w-[860px] w-full mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-[32px]">
        <div>
          <h1 className="text-[24px] font-bold text-white leading-tight">저장된 리포트</h1>
          <p className="text-[13px] text-[var(--c-neutral-500)] mt-[4px]">
            AI를 사용해 진행한 리서치가 자동으로 저장됩니다.
          </p>
        </div>
        <button
          onClick={handleNewResearch}
          className="flex items-center gap-[8px] px-[16px] py-[9px] rounded-[10px] bg-[var(--c-ai)] text-white text-[13px] font-semibold hover:opacity-90 transition-all"
        >
          <Plus className="w-[15px] h-[15px]" />
          새 리서치
        </button>
      </div>

      {/* Empty State */}
      {sorted.length === 0 && (
        <div className="flex flex-col items-center justify-center py-[80px] text-center">
          <div className="w-[64px] h-[64px] rounded-[18px] bg-[rgba(14,165,233,0.08)] border border-[rgba(14,165,233,0.15)] flex items-center justify-center mb-[20px]">
            <FileText className="w-[28px] h-[28px] text-[var(--c-ai)] opacity-60" />
          </div>
          <div className="text-[16px] font-semibold text-[var(--c-neutral-700)] mb-[8px]">
            아직 저장된 리포트가 없습니다
          </div>
          <div className="text-[13px] text-[var(--c-neutral-500)] mb-[28px] max-w-[320px]">
            AI 분석을 1번 이상 실행하면 리포트가 여기에 자동으로 저장됩니다.
          </div>
          <button
            onClick={handleNewResearch}
            className="flex items-center gap-[8px] px-[20px] py-[10px] rounded-[10px] bg-[var(--c-ai)] text-white text-[13px] font-semibold hover:opacity-90 transition-all"
          >
            <Plus className="w-[15px] h-[15px]" />
            첫 번째 리서치 시작
          </button>
        </div>
      )}

      {/* Report Grid */}
      {sorted.length > 0 && (
        <>
          <div className="text-[11px] font-bold tracking-[0.1em] uppercase text-[#4A4870] mb-[12px]">
            총 {sorted.length}개의 리포트
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-[14px]">
            {sorted.map((report) => (
              <ReportCard
                key={report.id}
                report={report}
                isActive={report.id === activeReportId}
                onOpen={() => handleOpen(report)}
                onDelete={() => deleteReport(report.id)}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
