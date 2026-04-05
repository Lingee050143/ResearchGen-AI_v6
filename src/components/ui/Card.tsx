import React from 'react';

export function Card({ className = '', children, ai = false, ...props }: React.HTMLAttributes<HTMLDivElement> & { ai?: boolean }) {
  return (
    <div 
      className={`bg-[var(--c-surface)] border border-[var(--c-border)] rounded-[var(--r-md)] p-[1.2rem] shadow-[var(--shadow-sm)] ${ai ? 'border-l-[3px] border-l-[var(--c-ai)]' : ''} ${className}`}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardTitle({ className = '', children }: React.HTMLAttributes<HTMLHeadingElement>) {
  return <h3 className={`text-[13px] font-bold text-[var(--c-neutral-900)] mb-1 ${className}`}>{children}</h3>;
}

export function CardSub({ className = '', children }: React.HTMLAttributes<HTMLParagraphElement>) {
  return <p className={`text-[11.5px] text-[var(--c-neutral-500)] ${className}`}>{children}</p>;
}
