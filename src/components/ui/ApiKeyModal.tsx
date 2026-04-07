'use client';
import React, { useState, useEffect } from 'react';
import { usePathname } from 'next/navigation';

export function useApiKey() {
  const [apiKey, setApiKeyState] = useState<string | null>(null);

  useEffect(() => {
    // localStorage 대신 sessionStorage 사용 (브라우저 탭 닫으면 초기화됨)
    const key = sessionStorage.getItem('CLAUDE_API_KEY');
    if (key) setApiKeyState(key);

    // 탭 내의 다른 컴포넌트들과 API 키 상태를 즉각 동기화하기 위한 이벤트 리스너
    const handleSync = () => {
      const updatedKey = sessionStorage.getItem('CLAUDE_API_KEY');
      setApiKeyState(updatedKey);
    };
    window.addEventListener('api-key-updated', handleSync);
    return () => window.removeEventListener('api-key-updated', handleSync);
  }, []);

  const setApiKey = (key: string) => {
    sessionStorage.setItem('CLAUDE_API_KEY', key);
    setApiKeyState(key);
    // 모달에서 키를 저장했을 때 다른 화면들(Step 1~9)이 즉시 알아채도록 이벤트 발송
    window.dispatchEvent(new Event('api-key-updated'));
  };

  return { apiKey, setApiKey };
}

const DEFERRED_PATHS = ['/', '/dashboard', '/steps/1'];

export function ApiKeyModal() {
  const { apiKey, setApiKey } = useApiKey();
  const [input, setInput] = useState('');
  const pathname = usePathname();

  // 이미 세션에 키가 있으면 모달을 띄우지 않음
  if (apiKey !== null) return null;

  // AI 통신이 필요 없는 초기 페이지에서는 모달을 띄우지 않음
  if (DEFERRED_PATHS.includes(pathname)) return null;

  return (
    <div className="fixed inset-0 bg-black/50 z-[999] flex items-center justify-center p-4">
      <div className="bg-[var(--c-surface)] rounded-[var(--r-lg)] p-[24px] max-w-[400px] w-full shadow-lg">
        <h2 className="text-[17px] font-bold text-[var(--c-neutral-900)] mb-2">Claude API 키가 필요합니다</h2>
        <p className="text-[13px] text-[var(--c-neutral-500)] mb-4">
          Anthropic API 키를 입력해주세요. 이 키는 현재 세션에만 임시 보관되며 브라우저를 닫으면 안전하게 삭제됩니다.
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
