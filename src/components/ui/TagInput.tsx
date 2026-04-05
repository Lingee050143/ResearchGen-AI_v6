'use client';
import React, { useState } from 'react';

export interface TagInputProps {
  tags: string[];
  onChange: (tags: string[]) => void;
  placeholder?: string;
}

export function TagInput({ tags, onChange, placeholder = "기능 추가 후 Enter..." }: TagInputProps) {
  const [inputValue, setInputValue] = useState('');

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const val = inputValue.trim();
      if (val && !tags.includes(val)) {
        onChange([...tags, val]);
        setInputValue('');
      }
    }
  };

  const removeTag = (tagToRemove: string) => {
    onChange(tags.filter(t => t !== tagToRemove));
  };

  return (
    <div className="flex flex-col gap-1 w-full">
      <div className="border-[1.5px] border-[var(--c-neutral-300)] rounded-[var(--r-sm)] p-[8px] bg-[var(--c-surface)] flex flex-wrap gap-[6px] items-center cursor-text transition-all focus-within:border-[var(--c-primary)] focus-within:ring-[3px] focus-within:ring-[rgba(79,70,229,0.1)] min-h-[46px]">
        {tags.map(tag => (
          <span key={tag} className="inline-flex items-center gap-[5px] bg-[var(--c-primary-100)] text-[var(--c-primary)] border border-[var(--c-primary-200)] rounded-full text-[12px] font-medium py-[3px] pr-[10px] pl-[12px] animate-[chipIn_200ms_ease-out]">
            {tag}
            <button
              onClick={() => removeTag(tag)}
              className="text-[14px] cursor-pointer text-[var(--c-primary)] opacity-55 leading-none transition-opacity hover:opacity-100 bg-none border-none p-0 focus:outline-none"
            >
              ×
            </button>
          </span>
        ))}
        <input
          type="text"
          value={inputValue}
          onChange={e => setInputValue(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder={tags.length === 0 ? placeholder : ""}
          className="border-none outline-none text-[13px] text-[var(--c-neutral-900)] bg-transparent flex-1 min-w-[130px] p-[2px_4px] placeholder:text-[var(--c-neutral-300)]"
        />
      </div>
      <div className="text-[10.5px] text-[var(--c-neutral-500)] mt-[4px]">각 태그는 독립 리서치 차원이 됩니다 · Enter로 추가 · × 로 삭제</div>
    </div>
  );
}
