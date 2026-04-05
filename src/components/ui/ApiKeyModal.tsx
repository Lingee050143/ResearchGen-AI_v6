'use client';
import React, { useState, useEffect } from 'react';

export function useApiKey() {
  const [apiKey, setApiKeyState] = useState<string | null>(null);

  useEffect(() => {
    const key = localStorage.getItem('CLAUDE_API_KEY');
    if (key) setApiKeyState(key);
  }, []);

  const setApiKey = (key: string) => {
    localStorage.setItem('CLAUDE_API_KEY', key);
    setApiKeyState(key);
  };

  return { apiKey, setApiKey };
}

export function ApiKeyModal() {
  const { apiKey, setApiKey } = useApiKey();
  const [input, setInput] = useState('');

  if (apiKey !== null) return null; // Already set

  return (
    <div className="fixed inset-0 bg-black/50 z-[999] flex items-center justify-center p-4">
      <div className="bg-[var(--c-surface)] rounded-[var(--r-lg)] p-[24px] max-w-[400px] w-full shadow-lg">
        <h2 className="text-[17px] font-bold text-[var(--c-neutral-900)] mb-2">Claude API 키가 필요합니다</h2>
        <p className="text-[13px] text-[var(--c-neutral-500)] mb-4">
          Anthropic API 키를 입력해주세요. 이 키는 클라이언트(브라우저)에만 저장되며 외부로 전송되지 않습니다.
        </p>
        <input 
          type="password" 
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="sk-ant-..."
          className="w-full border-[1.5px] border-[var(--c-neutral-300)] rounded-[var(--r-sm)] p-[10px_13px] text-[13px] outline-none focus:border-[var(--c-primary)] mb-4"
        />
        <button 
          onClick={() => { if(input.trim()) setApiKey(input.trim()) }}
          className="w-full bg-[var(--c-ai)] text-white font-bold py-[10px] rounded-[var(--r-sm)] hover:bg-[var(--c-ai-hover)]"
        >
          저장하고 이어서 진행
        </button>
      </div>
    </div>
  );
}
