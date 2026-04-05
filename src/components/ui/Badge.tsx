import React from 'react';

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'primary' | 'ai' | 'success' | 'warning' | 'error' | 'neutral';
}

export function Badge({ variant = 'neutral', className = '', children, ...props }: BadgeProps) {
  const baseStyles = 'inline-flex items-center gap-1 text-[10px] font-semibold px-2 py-0.5 rounded-[var(--r-full)] tracking-wide';
  
  const variants = {
    primary: 'bg-[var(--c-primary-100)] text-[#3730A3]',
    ai: 'bg-[var(--c-ai-subtle)] text-[#0369A1]',
    success: 'bg-[var(--c-success-subtle)] text-[#065F46]',
    warning: 'bg-[var(--c-warning-subtle)] text-[#92400E]',
    error: 'bg-[var(--c-error-subtle)] text-[#B91C1C]',
    neutral: 'bg-[var(--c-neutral-200)] text-[var(--c-neutral-700)]',
  };

  return (
    <span className={`${baseStyles} ${variants[variant]} ${className}`} {...props}>
      {children}
    </span>
  );
}
