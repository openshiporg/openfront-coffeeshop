import React from 'react';
import { Check, Clipboard, Copy } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface DataCardProps {
  title: string;
  content: string;
  onCopy: (text: string, key: string) => Promise<void>;
  copied: boolean;
  copyKey: string;
  showPasteButton?: boolean;
  onPaste?: () => void;
}

export function DataCard({ title, content, onCopy, copied, copyKey, showPasteButton, onPaste }: DataCardProps) {
  return (
    <div className="overflow-hidden rounded-lg border">
      <div className="flex items-center justify-between border-b bg-muted px-4 py-2">
        <span className="text-sm font-medium text-muted-foreground">{title}</span>
        <div className="flex items-center space-x-2">
          {showPasteButton && onPaste ? (
            <Button size="sm" variant="ghost" onClick={onPaste} className="h-6 w-6 p-0 hover:bg-background/80">
              <Clipboard className="h-3 w-3 text-muted-foreground" />
            </Button>
          ) : null}
          <Button size="sm" variant="ghost" onClick={() => onCopy(content, copyKey)} className="h-6 w-6 p-0 hover:bg-background/80">
            {copied ? <Check className="h-3 w-3 text-green-600" /> : <Copy className="h-3 w-3 text-muted-foreground" />}
          </Button>
        </div>
      </div>
      <div className="bg-background">
        <div className="h-[200px] overflow-auto whitespace-pre-wrap break-words p-4 font-mono text-xs text-foreground">{content}</div>
      </div>
    </div>
  );
}
