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

export interface ResearchStore {
  status: Status;
  currentStep: number;
  data: ResearchData;
  userOverrides: Record<string, any>;
  setStatus: (status: Status) => void;
  setStep: (step: number) => void;
  updateData: (key: keyof ResearchData, payload: any, isUserOverride?: boolean) => void;
  reset: () => void;
}

const initialState = {
  status: 'idle' as Status,
  currentStep: 1,
  data: {},
  userOverrides: {},
};

export const useResearchStore = create<ResearchStore>()(
  persist(
    (set) => ({
      ...initialState,
      setStatus: (status) => set({ status }),
      setStep: (step) => set({ currentStep: step }),
      updateData: (key, payload, isUserOverride = false) => set((state) => {
        let mergedData;
        if (Array.isArray(payload) || typeof payload !== 'object' || payload === null) {
          mergedData = payload;
        } else {
          mergedData = { ...state.data[key], ...payload };
        }

        const newData = { ...state.data, [key]: mergedData };
        
        let newOverrides = state.userOverrides;
        if (isUserOverride) {
          let mergedOverride;
          if (Array.isArray(payload) || typeof payload !== 'object' || payload === null) {
            mergedOverride = payload;
          } else {
            mergedOverride = { ...state.userOverrides[key], ...payload };
          }
          newOverrides = { ...state.userOverrides, [key]: mergedOverride };
        }
          
        return { data: newData, userOverrides: newOverrides };
      }),
      reset: () => set(initialState),
    }),
    {
      name: 'researchgen-v6-storage',
    }
  )
);
