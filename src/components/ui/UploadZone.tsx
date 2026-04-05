'use client';
import React, { useRef, useState } from 'react';
import { Upload } from 'lucide-react';

export interface UploadZoneProps {
  onFileAccepted: (file: File) => void;
  accept?: string;
  maxSizeMB?: number;
}

export function UploadZone({ onFileAccepted, accept = ".csv", maxSizeMB = 5 }: UploadZoneProps) {
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFile = (file: File) => {
    if (!file) return;
    if (file.size > maxSizeMB * 1024 * 1024) {
      alert(`파일 크기는 최대 ${maxSizeMB}MB 이하여야 합니다.`);
      return;
    }
    onFileAccepted(file);
  };

  return (
    <div 
      className={`border-[1.5px] border-dashed rounded-[var(--r-md)] p-[28px_20px] text-center bg-[var(--c-surface-subtle)] cursor-pointer transition-all ${isDragOver ? 'border-[var(--c-primary)] bg-[var(--c-primary-100)]' : 'border-[var(--c-neutral-300)] hover:border-[var(--c-primary)] hover:bg-[var(--c-primary-100)]'}`}
      onDragOver={(e) => { e.preventDefault(); setIsDragOver(true); }}
      onDragLeave={() => setIsDragOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setIsDragOver(false);
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          handleFile(e.dataTransfer.files[0]);
        }
      }}
      onClick={() => fileInputRef.current?.click()}
    >
      <input 
        type="file" 
        className="hidden" 
        ref={fileInputRef} 
        accept={accept}
        onChange={(e) => {
          if (e.target.files && e.target.files.length > 0) {
            handleFile(e.target.files[0]);
          }
        }}
      />
      <div className="flex flex-col items-center">
        <Upload className="w-7 h-7 text-[var(--c-neutral-500)] mb-2" />
        <div className="text-[13px] font-semibold text-[var(--c-neutral-700)] mb-[4px]">클릭하거나 파일을 드롭하세요</div>
        <div className="text-[11.5px] text-[var(--c-neutral-500)] mb-[10px]">최대 {maxSizeMB}MB 지원</div>
        <div className="flex gap-[5px] justify-center flex-wrap">
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded-[3px] bg-[var(--c-neutral-100)] text-[var(--c-neutral-500)] border border-[var(--c-border)]">CSV</span>
        </div>
      </div>
    </div>
  );
}
