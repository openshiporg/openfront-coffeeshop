import React from 'react';
import { AlertCircle, CheckCircle2, Circle, Loader2 } from 'lucide-react';

interface SectionItemProps {
  item: string;
  status: 'normal' | 'loading' | 'completed' | 'error';
  errorMessage?: string;
}

export function SectionItem({ item, status, errorMessage }: SectionItemProps) {
  return (
    <div className="inline-flex items-center gap-2 rounded-md border px-2 py-1 text-xs">
      {status === 'completed' ? (
        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
      ) : status === 'loading' ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin text-amber-700" />
      ) : status === 'error' ? (
        <AlertCircle className="h-3.5 w-3.5 text-red-600" />
      ) : (
        <Circle className="h-3.5 w-3.5 text-muted-foreground" />
      )}
      <span>{item}</span>
      {status === 'error' && errorMessage ? <span className="sr-only">{errorMessage}</span> : null}
    </div>
  );
}
