import React from 'react';

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'ai';
  size?: 'sm' | 'md' | 'lg';
}

export function Button({ variant = 'primary', size = 'md', className = '', ...props }: ButtonProps) {
  const baseStyles = 'inline-flex items-center justify-center gap-1.5 font-semibold font-[var(--font-sans)] transition-all duration-100 ease-out border focus:outline-none focus:ring-2 focus:ring-[var(--c-primary)] focus:ring-offset-2 disabled:opacity-45 disabled:cursor-not-allowed whitespace-nowrap leading-none';
  
  const variants = {
    primary: 'bg-[var(--c-primary)] text-white border-transparent hover:bg-[var(--c-primary-hover)]',
    secondary: 'bg-transparent text-[var(--c-primary)] border-[1.5px] border-[var(--c-primary)] hover:bg-[var(--c-primary-100)]',
    ghost: 'bg-transparent text-[var(--c-neutral-500)] border-[1.5px] border-[var(--c-border)] hover:border-[var(--c-neutral-300)] hover:text-[var(--c-neutral-700)]',
    ai: 'bg-[var(--c-ai)] text-white border-transparent hover:bg-[var(--c-ai-hover)]',
  };
  
  const sizes = {
    sm: 'text-[11.5px] px-[10px] py-[5px] rounded-[var(--r-sm)]',
    md: 'text-[13px] px-[18px] py-[9px] rounded-[var(--r-sm)]',
    lg: 'text-[15px] px-[24px] py-[12px] rounded-[var(--r-sm)]',
  };

  return (
    <button 
      className={`${baseStyles} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    />
  );
}
