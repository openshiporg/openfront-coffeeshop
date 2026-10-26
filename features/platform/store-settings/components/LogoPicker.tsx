'use client'

/* Hallmark · component: logo picker · genre: modern-minimal · theme: existing restaurant system
 * states: default · hover · focus · active · disabled · loading · error · success
 * contrast: pass (46–50)
 */

import { useEffect, useId, useMemo, useRef, useState } from 'react'
import { CheckCircle2, Code2, X } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { sanitizeStoreLogoSvg } from '@/features/lib/sanitize-store-logo'
import { LOGO_ICONS } from '@/features/platform/store-settings/lib/untitled-logo-registry'

interface LogoPickerProps {
  value: string
  hue: string
  onChange: (svg: string) => void
  /** Reports whether an edited custom SVG is waiting to be applied or discarded. */
  onPendingDraftChange?: (pending: boolean) => void
}

const triggerClassName = 'min-h-11 w-full justify-between border-0 bg-transparent px-0 py-0 text-sm font-semibold shadow-none focus:ring-0 focus:ring-offset-0 [&>svg]:size-3.5 [&>svg]:opacity-40'

export function LogoPicker({ value, hue, onChange, onPendingDraftChange }: LogoPickerProps) {
  const fieldId = useId()
  const selectedIcon = useMemo(
    () => LOGO_ICONS.find((icon) => icon.lightSvg === value),
    [value]
  )
  // The SVG editor stays collapsed until asked for, even when the saved logo is custom.
  const [isEditingCustom, setIsEditingCustom] = useState(false)
  const [draft, setDraft] = useState(value)
  const safeDraft = useMemo(() => sanitizeStoreLogoSvg(draft), [draft])
  const hasValidDraft = safeDraft.length > 0
  const hasDraftChanges = safeDraft !== value
  const hasPendingDraft = isEditingCustom && draft !== value
  const previousValue = useRef(value)

  // A saved/normalized logo replaces an untouched draft, never an edited one.
  useEffect(() => {
    const previous = previousValue.current
    previousValue.current = value
    setDraft((current) => (current === previous ? value : current))
  }, [value])

  useEffect(() => {
    onPendingDraftChange?.(hasPendingDraft)
  }, [hasPendingDraft, onPendingDraftChange])

  const selectLogo = (id: string) => {
    if (id === 'custom') {
      setDraft(value)
      setIsEditingCustom(true)
      return
    }
    const icon = LOGO_ICONS.find((candidate) => candidate.id === id)
    if (!icon) return
    onChange(icon.lightSvg)
    setDraft(icon.lightSvg)
    setIsEditingCustom(false)
  }

  return (
    <div className="min-w-0">
      <p className="text-sm">Logo</p>
      <Select value={selectedIcon?.id || 'custom'} onValueChange={selectLogo}>
        <SelectTrigger className={`rounded-[6px] ${triggerClassName}`} aria-label="Choose a logo">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="max-h-[min(420px,var(--radix-select-content-available-height))] min-w-[280px]">
          <SelectItem value="custom" className="min-h-11">
            <span className="flex items-center gap-3">
              <span className="flex size-7 items-center justify-center rounded-[4px] border border-dashed border-border bg-muted/30">
                <Code2 className="size-3.5 text-muted-foreground" />
              </span>
              <span className="font-medium">Custom SVG</span>
            </span>
          </SelectItem>
          {/* Registry names are stock brand names; the picker shows neutral numbered labels. */}
          {LOGO_ICONS.map((icon, index) => (
            <SelectItem key={icon.id} value={icon.id} className="min-h-11">
              <span className="flex items-center gap-3">
                <span
                  className="flex size-7 items-center justify-center overflow-hidden rounded-[4px] border border-border bg-background p-1 [&>svg]:block [&>svg]:size-full"
                  style={{ filter: `hue-rotate(${hue}deg)` }}
                  dangerouslySetInnerHTML={{ __html: icon.lightSvg }}
                  aria-hidden="true"
                />
                <span className="font-medium">Mark {index + 1}</span>
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="mt-2 flex items-center gap-2">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="min-h-11 px-2 text-xs text-muted-foreground"
          onClick={() => {
            setDraft(value)
            setIsEditingCustom((open) => !open)
          }}
          aria-expanded={isEditingCustom}
        >
          <Code2 className="mr-1.5 size-3.5" />
          {selectedIcon ? 'Edit SVG' : 'Custom SVG'}
        </Button>
        {!selectedIcon ? (
          <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="size-3" /> Custom
          </span>
        ) : null}
      </div>

      {isEditingCustom ? (
        <div className="mt-3 rounded-[4px] border border-border bg-muted/15 p-3">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold">Custom SVG</p>
              <p className="mt-0.5 text-[11px] leading-4 text-muted-foreground">
                Paste a complete SVG. Scripts, links, styles, event handlers, and external assets are rejected.
              </p>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="size-11 shrink-0"
              onClick={() => {
                setDraft(value)
                setIsEditingCustom(false)
              }}
              aria-label="Discard custom SVG changes and close the editor"
            >
              <X className="size-3.5" />
            </Button>
          </div>

          <Label htmlFor={`${fieldId}-svg`} className="mt-3 block text-xs">SVG markup</Label>
          <Textarea
            id={`${fieldId}-svg`}
            data-logo-draft
            aria-describedby={`${fieldId}-status`}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
            className="mt-1.5 min-h-32 resize-y rounded-[6px] font-mono text-[11px] leading-4"
            placeholder='<svg viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">…</svg>'
            spellCheck={false}
            aria-invalid={draft.length > 0 && !hasValidDraft}
          />

          <div className="mt-3 flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2">
              <span
                className="flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-[4px] border border-border bg-background p-1.5 [&>svg]:block [&>svg]:size-full"
                style={{ filter: `hue-rotate(${hue}deg)` }}
                dangerouslySetInnerHTML={{ __html: safeDraft }}
                aria-hidden="true"
              />
              <span id={`${fieldId}-status`} aria-live="polite" className={`truncate text-[11px] ${hasValidDraft ? 'text-muted-foreground' : 'text-destructive'}`}>
                {hasValidDraft ? 'Safe preview' : 'Enter a valid, safe SVG document'}
              </span>
            </div>
            <Button
              type="button"
              size="sm"
              className="min-h-11 shrink-0 px-3 text-xs"
              disabled={!hasValidDraft || !hasDraftChanges}
              onClick={() => {
                onChange(safeDraft)
                setIsEditingCustom(false)
              }}
            >
              Apply SVG
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
