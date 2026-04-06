'use client';
import React, { useState, useRef, useEffect } from 'react';

interface EditableTextProps {
  value: string;
  onSave: (newValue: string) => void;
  as?: 'input' | 'textarea';
  className?: string;
  rows?: number;
  placeholder?: string;
}

/**
 * Inline editable text — hover shows ✏️, click activates edit mode.
 * - input:    Enter = save, Escape = cancel
 * - textarea: Ctrl+Enter = save, Escape = cancel, blur = save
 * Calls onSave only when the value actually changed.
 */
export function EditableText({
  value,
  onSave,
  as = 'input',
  className = '',
  rows = 3,
  placeholder,
}: EditableTextProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [hovered, setHovered] = useState(false);
  const inputRef = useRef<HTMLInputElement & HTMLTextAreaElement>(null);

  // sync draft when parent value changes (e.g. after regeneration)
  useEffect(() => {
    if (!editing) setDraft(value);
  }, [value, editing]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [editing]);

  const commit = () => {
    setEditing(false);
    setHovered(false);
    const trimmed = draft.trim();
    if (trimmed && trimmed !== value.trim()) onSave(trimmed);
    else setDraft(value);
  };

  const cancel = () => {
    setEditing(false);
    setDraft(value);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') { e.stopPropagation(); cancel(); return; }
    if (as === 'input' && e.key === 'Enter') { e.preventDefault(); commit(); }
    if (as === 'textarea' && e.key === 'Enter' && e.ctrlKey) { e.preventDefault(); commit(); }
  };

  const sharedInputClass = `w-full border border-[var(--c-primary)] rounded-[4px] px-[8px] py-[4px] bg-[var(--c-primary-100)] outline-none text-inherit resize-none ${className}`;

  if (editing) {
    return as === 'textarea' ? (
      <textarea
        ref={inputRef}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        rows={rows}
        placeholder={placeholder}
        className={sharedInputClass}
      />
    ) : (
      <input
        type="text"
        ref={inputRef}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        className={sharedInputClass}
      />
    );
  }

  return (
    <span
      className={`cursor-text ${className}`}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onClick={() => { setDraft(value); setEditing(true); }}
      title="클릭하여 수정"
    >
      {value}
      <span
        className="ml-[4px] text-[11px] transition-opacity select-none"
        style={{ opacity: hovered ? 1 : 0 }}
      >
        ✏️
      </span>
    </span>
  );
}
