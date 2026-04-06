import { create } from 'zustand';
import { persist } from 'zustand/middleware';

export type Status = 'idle' | 'loading' | 'success' | 'error' | 'partial_success';

export interface ResearchData {
  idea?: any;
  step1Insights?: any;
  competitors?: any;
  reviews?: any;
  insightsMap?: any;
  personas?: any;
  journeyMap?: any;
  opportunityMap?: any;
  finalReport?: any;
}

export interface SavedReport {
  id: string;
  title: string;
  currentStep: number;
  data: ResearchData;
  userOverrides: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export interface ResearchStore {
  status: Status;
  currentStep: number;
  data: ResearchData;
  userOverrides: Record<string, any>;
  savedReports: SavedReport[];
  activeReportId: string | null;
  setStatus: (status: Status) => void;
  setStep: (step: number) => void;
  updateData: (key: keyof ResearchData, payload: any, isUserOverride?: boolean) => void;
  reset: () => void;
  saveCurrentReport: () => void;
  loadReport: (id: string) => void;
  deleteReport: (id: string) => void;
  startNewResearch: () => void;
}

const initialSessionState = {
  status: 'idle' as Status,
  currentStep: 1,
  data: {},
  userOverrides: {},
  activeReportId: null as string | null,
};

const hasAiData = (data: ResearchData): boolean => {
  return !!(
    data.step1Insights ||
    data.insightsMap ||
    data.personas ||
    data.journeyMap ||
    data.opportunityMap ||
    data.finalReport
  );
};

export const useResearchStore = create<ResearchStore>()(
  persist(
    (set, get) => ({
      ...initialSessionState,
      savedReports: [],
      setStatus: (status) => set({ status }),
      setStep: (step) => set({ currentStep: step }),
      updateData: (key, payload, isUserOverride = false) => set((state) => {
        let mergedData;
        if (Array.isArray(payload) || typeof payload !== 'object' || payload === null) {
          mergedData = payload;
        } else {
          // 방어 로직: 기존 데이터가 엉망이거나 객체가 아니면 빈 객체로 초기화
          const baseData = (typeof state.data[key] === 'object' && !Array.isArray(state.data[key]) && state.data[key] !== null)
            ? state.data[key]
            : {};
          mergedData = { ...baseData, ...payload };
        }

        const newData = { ...state.data, [key]: mergedData };

        let newOverrides = state.userOverrides;
        if (isUserOverride) {
          let mergedOverride;
          if (Array.isArray(payload) || typeof payload !== 'object' || payload === null) {
            mergedOverride = payload;
          } else {
            // 방어 로직 동일 적용
            const baseOverride = (typeof state.userOverrides[key] === 'object' && !Array.isArray(state.userOverrides[key]) && state.userOverrides[key] !== null)
              ? state.userOverrides[key]
              : {};
            mergedOverride = { ...baseOverride, ...payload };
          }
          newOverrides = { ...state.userOverrides, [key]: mergedOverride };
        }

        // AI 데이터가 저장될 때 (isUserOverride=false) 자동저장
        if (!isUserOverride && hasAiData(newData)) {
          const title = newData.idea?.serviceName || '제목 없음';
          const now = new Date().toISOString();
          const existingIdx = state.savedReports.findIndex(r => r.id === state.activeReportId);

          if (existingIdx >= 0) {
            // 기존 리포트 업데이트
            const updated = [...state.savedReports];
            updated[existingIdx] = {
              ...updated[existingIdx],
              title,
              currentStep: state.currentStep,
              data: newData,
              userOverrides: newOverrides,
              updatedAt: now,
            };
            return { data: newData, userOverrides: newOverrides, savedReports: updated };
          } else {
            // 새 리포트 생성
            const id = crypto.randomUUID();
            const newReport: SavedReport = {
              id,
              title,
              currentStep: state.currentStep,
              data: newData,
              userOverrides: newOverrides,
              createdAt: now,
              updatedAt: now,
            };
            return {
              data: newData,
              userOverrides: newOverrides,
              savedReports: [...state.savedReports, newReport],
              activeReportId: id,
            };
          }
        }

        return { data: newData, userOverrides: newOverrides };
      }),
      reset: () => set(initialSessionState),
      saveCurrentReport: () => set((state) => {
        if (!hasAiData(state.data)) return state;
        const title = state.data.idea?.serviceName || '제목 없음';
        const now = new Date().toISOString();
        const existingIdx = state.savedReports.findIndex(r => r.id === state.activeReportId);

        if (existingIdx >= 0) {
          const updated = [...state.savedReports];
          updated[existingIdx] = {
            ...updated[existingIdx],
            title,
            currentStep: state.currentStep,
            data: state.data,
            userOverrides: state.userOverrides,
            updatedAt: now,
          };
          return { savedReports: updated };
        } else {
          const id = crypto.randomUUID();
          const newReport: SavedReport = {
            id,
            title,
            currentStep: state.currentStep,
            data: state.data,
            userOverrides: state.userOverrides,
            createdAt: now,
            updatedAt: now,
          };
          return { savedReports: [...state.savedReports, newReport], activeReportId: id };
        }
      }),
      loadReport: (id) => set((state) => {
        const report = state.savedReports.find(r => r.id === id);
        if (!report) return state;
        return {
          data: report.data,
          userOverrides: report.userOverrides,
          currentStep: report.currentStep,
          status: 'idle',
          activeReportId: id,
        };
      }),
      deleteReport: (id) => set((state) => {
        const newReports = state.savedReports.filter(r => r.id !== id);
        const newActiveId = state.activeReportId === id ? null : state.activeReportId;
        return { savedReports: newReports, activeReportId: newActiveId };
      }),
      startNewResearch: () => set({ ...initialSessionState }),
    }),
    {
      name: 'researchgen-v6-storage',
    }
  )
);
