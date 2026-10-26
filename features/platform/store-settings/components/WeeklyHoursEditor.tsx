'use client'

// Adapted from Restaurant's WeeklyHoursEditor for Coffee Shop's weekly hours
// shape: one opening window per weekday, or closed.

import { useId, useState } from 'react'
import { AlertCircle, Copy } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'
import { WEEKDAYS, type Weekday } from '../lib/store-settings-input'

export type HoursRow = { day: Weekday; closed: boolean; open: string; close: string }

const DEFAULT_OPEN = '07:00'
const DEFAULT_CLOSE = '17:00'

/** Converts stored weekly hours into one row per weekday. Missing days are closed, as at checkout. */
export function toHoursRows(weeklyHours: unknown): HoursRow[] {
  const rows = Array.isArray(weeklyHours) ? weeklyHours : []
  return WEEKDAYS.map((day) => {
    const row = rows.find((entry) => entry && typeof entry === 'object' && (entry as { day?: unknown }).day === day) as
      | { open?: unknown; close?: unknown; closed?: unknown }
      | undefined
    const open = typeof row?.open === 'string' ? row.open : ''
    const close = typeof row?.close === 'string' ? row.close : ''
    return { day, closed: !row || row.closed === true, open, close }
  })
}

/** Converts editor rows back to the stored weekly hours shape. */
export function fromHoursRows(rows: HoursRow[]) {
  return rows.map((row) => (row.closed ? { day: row.day, closed: true } : { day: row.day, open: row.open, close: row.close }))
}

interface WeeklyHoursEditorProps {
  hours: HoursRow[]
  timezone: string
  error: string | null
  disabled?: boolean
  onChange: (hours: HoursRow[]) => void
}

function todayIn(timezone: string) {
  try {
    return new Intl.DateTimeFormat('en-US', { timeZone: timezone, weekday: 'long' }).format(new Date())
  } catch {
    return ''
  }
}

export function WeeklyHoursEditor({ hours, timezone, error, disabled, onChange }: WeeklyHoursEditorProps) {
  const id = useId()
  const [activeDay, setActiveDay] = useState<Weekday>(WEEKDAYS[0])
  const active = hours.find((row) => row.day === activeDay) ?? hours[0]
  const todayKey = todayIn(timezone)

  const updateDay = (day: Weekday, patch: Partial<HoursRow>) => {
    onChange(hours.map((row) => (row.day === day ? { ...row, ...patch } : row)))
  }

  const setOpen = (day: Weekday, open: boolean) => {
    const row = hours.find((entry) => entry.day === day)
    updateDay(day, {
      closed: !open,
      open: open && !row?.open ? DEFAULT_OPEN : row?.open ?? '',
      close: open && !row?.close ? DEFAULT_CLOSE : row?.close ?? '',
    })
  }

  const copyToAll = (day: Weekday) => {
    const source = hours.find((row) => row.day === day)
    if (!source) return
    onChange(hours.map((row) => ({ ...row, closed: source.closed, open: source.open, close: source.close })))
  }

  return (
    <div className="divide-y divide-border overflow-hidden rounded-[6px] border border-border bg-card">
      <div role="radiogroup" aria-label="Choose a day to edit" className="grid grid-cols-7 gap-px bg-border">
        {hours.map((row) => {
          const selected = row.day === activeDay
          return (
            <button
              key={row.day}
              type="button"
              role="radio"
              aria-checked={selected}
              onClick={() => setActiveDay(row.day)}
              aria-label={`${row.day}${row.day === todayKey ? ' (today)' : ''}, ${row.closed ? 'closed' : `${row.open || '--:--'} to ${row.close || '--:--'}`}`}
              className={cn(
                'flex min-h-14 flex-col items-center justify-center gap-0.5 px-1 py-2 text-sm font-medium outline-none transition-[background-color,color,transform] duration-150 ease-out active:scale-[0.97] focus-visible:z-10 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring',
                selected ? 'bg-foreground text-background' : 'bg-card text-foreground hover:bg-muted',
              )}
            >
              <span className={row.day === todayKey ? 'underline decoration-dotted underline-offset-4' : undefined}>{row.day.slice(0, 3)}</span>
              <span className={cn('text-[11px] font-normal tabular-nums', selected ? 'text-background/75' : row.closed ? 'text-muted-foreground' : 'text-emerald-700 dark:text-emerald-400')}>
                {row.closed ? 'Closed' : row.open ? row.open : 'Open'}
              </span>
            </button>
          )
        })}
      </div>

      <div className="flex items-center justify-between gap-3 px-5 py-3">
        <div>
          <p className="text-sm font-semibold">{active.day}</p>
          <p className="text-xs text-muted-foreground">{active.closed ? 'Closed' : 'Open for pickup'}</p>
        </div>
        <div className="flex items-center gap-2.5">
          <Label htmlFor={`${id}-open-switch`} className="text-xs text-muted-foreground">
            {active.closed ? 'Closed' : 'Open'}
          </Label>
          <Switch
            id={`${id}-open-switch`}
            checked={!active.closed}
            disabled={disabled}
            onCheckedChange={(value) => setOpen(active.day, value)}
            aria-label={`${active.day} open`}
          />
        </div>
      </div>

      {active.closed ? (
        <p className="px-5 py-4 text-xs text-muted-foreground">Closed</p>
      ) : (
        <div className="grid grid-cols-2 divide-x divide-border">
          <div className="px-5 py-3">
            <Label htmlFor={`${id}-open`} className="text-xs text-muted-foreground">Opens</Label>
            <Input
              id={`${id}-open`}
              type="time"
              required
              disabled={disabled}
              value={active.open}
              onChange={(event) => updateDay(active.day, { open: event.target.value })}
              className="mt-1.5 h-11 rounded-[6px] text-sm font-semibold"
            />
          </div>
          <div className="px-5 py-3">
            <Label htmlFor={`${id}-close`} className="text-xs text-muted-foreground">Closes</Label>
            <Input
              id={`${id}-close`}
              type="time"
              required
              disabled={disabled}
              value={active.close}
              onChange={(event) => updateDay(active.day, { close: event.target.value })}
              className="mt-1.5 h-11 rounded-[6px] text-sm font-semibold"
            />
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 px-5 py-3">
        <Button type="button" variant="ghost" size="sm" className="min-h-11 rounded-[6px] px-2.5 text-xs text-muted-foreground" disabled={disabled} onClick={() => copyToAll(active.day)}>
          <Copy size={11} className="mr-1" aria-hidden="true" />
          Copy {active.day} to all days
        </Button>
      </div>

      {error ? (
        <div className="flex items-center gap-2 px-5 py-3 text-xs text-destructive" role="alert">
          <AlertCircle size={12} aria-hidden="true" />
          {error}
        </div>
      ) : null}
    </div>
  )
}
