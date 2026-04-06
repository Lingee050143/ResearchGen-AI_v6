'use client';
import React, { use } from 'react';
import { Step1 } from '@/components/steps/Step1';
import { Step2 } from '@/components/steps/Step2';
import { Step3 } from '@/components/steps/Step3';
import { Step4 } from '@/components/steps/Step4';
import { Step5 } from '@/components/steps/Step5';
import { Step6 } from '@/components/steps/Step6';
import { Step7 } from '@/components/steps/Step7';
import { Step8 } from '@/components/steps/Step8';
import { Step9 } from '@/components/steps/Step9';

export default function StepPage({ params }: { params: Promise<{ stepId: string }> }) {
  const resolvedParams = use(params);
  const stepId = parseInt(resolvedParams.stepId);

  if (stepId === 1) return <Step1 />;
  if (stepId === 2) return <Step2 />;
  if (stepId === 3) return <Step3 />;
  if (stepId === 4) return <Step4 />;
  if (stepId === 5) return <Step5 />;
  if (stepId === 6) return <Step6 />;
  if (stepId === 7) return <Step7 />;
  if (stepId === 8) return <Step8 />;
  if (stepId === 9) return <Step9 />;

  return null;
}
