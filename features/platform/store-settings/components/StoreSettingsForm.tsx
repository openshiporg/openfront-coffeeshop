'use client';

import { useEffect, useMemo, useRef, useState, useTransition, type FormEvent, type ReactNode } from "react";
import { Save, Store } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectValue } from "@/components/ui/select";
import * as SelectPrimitive from "@radix-ui/react-select";
import { Code } from "lucide-react";
import { LOGO_ICONS, HUE_PRESETS } from "../lib/icon-registry";
import { StoreSettingsSaveBar } from "./StoreSettingsSaveBar";
import { WeeklyHoursEditor, fromHoursRows, toHoursRows, type HoursRow } from "./WeeklyHoursEditor";
import { DEFAULT_STORE_LOGO_COLOR, DEFAULT_STORE_LOGO_ICON } from "../lib/store-logo";
import { saveCoffeeStoreSettingsAction } from "../actions/store-settings";
import {
  coffeeStoreSettingsInputSchema,
  PICKUP_LIMITS,
  type CoffeeStoreSettingsData,
  type CoffeeStoreSettingsInput,
} from "../lib/store-settings-input";
import { PlatformSelect } from "@/features/platform/components/PlatformSelect";

const DEFAULT_WEEKLY_HOURS: CoffeeStoreSettingsInput["weeklyHours"] = [
  { day: "Monday", open: "07:00", close: "17:00" },
  { day: "Tuesday", open: "07:00", close: "17:00" },
  { day: "Wednesday", open: "07:00", close: "17:00" },
  { day: "Thursday", open: "07:00", close: "17:00" },
  { day: "Friday", open: "07:00", close: "17:00" },
  { day: "Saturday", open: "08:00", close: "16:00" },
  { day: "Sunday", open: "08:00", close: "15:00" },
];

function supportedTimeZones(): string[] {
  try {
    const intl = Intl as unknown as { supportedValuesOf?: (key: "timeZone") => string[] };
    return intl.supportedValuesOf ? intl.supportedValuesOf("timeZone") : [];
  } catch {
    return [];
  }
}

type FormState = {
  name: string;
  tagline: string;
  description: string;
  address: string;
  phone: string;
  contactEmail: string;
  currencyCode: string;
  locale: string;
  timezone: string;
  logoIcon: string;
  logoColor: string;
  hours: HoursRow[];
  pickupLeadTimeMinutes: string;
  pickupWindowMinutes: string;
  pickupCapacityPerWindow: string;
  taxRateBasisPoints: string;
};

type FieldKey = keyof FormState;

const FIELD_IDS: Record<string, string> = {
  name: "store-name",
  tagline: "store-tagline",
  description: "store-description",
  address: "store-address",
  phone: "store-phone",
  contactEmail: "store-contact-email",
  timezone: "store-timezone",
  logoIcon: "store-logo",
  logoColor: "logo-hue",
  weeklyHours: "store-hours",
  pickupLeadTimeMinutes: "pickup-lead-time",
  pickupWindowMinutes: "pickup-window",
  pickupCapacityPerWindow: "pickup-capacity",
  taxRateBasisPoints: "tax-rate",
};

function toFormState(settings: CoffeeStoreSettingsData | null): FormState {
  return {
    name: settings?.name ?? "",
    tagline: settings?.tagline ?? "",
    description: settings?.description ?? "",
    address: settings?.address ?? "",
    phone: settings?.phone ?? "",
    contactEmail: settings?.contactEmail ?? "",
    currencyCode: settings?.currencyCode ?? "USD",
    locale: settings?.locale ?? "en-US",
    timezone: settings?.timezone ?? "America/New_York",
    logoIcon: settings?.logoIcon || DEFAULT_STORE_LOGO_ICON,
    logoColor: settings?.logoColor ?? DEFAULT_STORE_LOGO_COLOR,
    hours: toHoursRows(settings ? settings.weeklyHours : DEFAULT_WEEKLY_HOURS),
    pickupLeadTimeMinutes: String(settings?.pickupLeadTimeMinutes ?? 12),
    pickupWindowMinutes: String(settings?.pickupWindowMinutes ?? 15),
    pickupCapacityPerWindow: String(settings?.pickupCapacityPerWindow ?? 20),
    // Edited as a percent (8.875); stored as basis points (887.5).
    taxRateBasisPoints: settings?.taxRateBasisPoints == null ? "" : String(Math.round(Number(settings.taxRateBasisPoints) * 100) / 10_000),
  };
}

function toNumber(value: string) {
  return value.trim() === "" ? Number.NaN : Number(value);
}

function toInput(form: FormState): CoffeeStoreSettingsInput {
  return {
    name: form.name,
    tagline: form.tagline,
    description: form.description,
    address: form.address,
    phone: form.phone,
    contactEmail: form.contactEmail,
    currencyCode: form.currencyCode,
    locale: "en-US",
    timezone: form.timezone,
    logoIcon: form.logoIcon,
    logoColor: form.logoColor,
    weeklyHours: fromHoursRows(form.hours),
    pickupLeadTimeMinutes: toNumber(form.pickupLeadTimeMinutes),
    pickupWindowMinutes: toNumber(form.pickupWindowMinutes),
    pickupCapacityPerWindow: toNumber(form.pickupCapacityPerWindow),
    taxRateBasisPoints: Math.round(toNumber(form.taxRateBasisPoints) * 10_000) / 100,
  };
}

type StoreSettingsFormProps = {
  initialSettings: CoffeeStoreSettingsData | null;
  loadError?: string | null;
};

const LEAVE_MESSAGE = "You have unsaved store settings. Leave this page and discard them?";

export function StoreSettingsForm({ initialSettings, loadError }: StoreSettingsFormProps) {
  const [isPending, startTransition] = useTransition();
  const [status, setStatus] = useState<{ kind: "success" | "error"; message: string } | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<string, string>>>({});
  const [saved, setSaved] = useState<CoffeeStoreSettingsData | null>(initialSettings);
  const [baseline, setBaseline] = useState<FormState>(() => toFormState(initialSettings));
  const [form, setForm] = useState<FormState>(baseline);
  const [conflict, setConflict] = useState<CoffeeStoreSettingsData | null | undefined>(undefined);
  // Filled after mount: server and browser ICU zone lists can differ.
  const [timeZones, setTimeZones] = useState<string[]>([]);
  useEffect(() => setTimeZones(supportedTimeZones()), []);
  const summaryRef = useRef<HTMLDivElement>(null);

  // Same names as the E-commerce logo block, over this page's form state.
  const logoIcon = form.logoIcon
  const logoColor = form.logoColor
  const setLogoIcon = (value: string) => update("logoIcon", value)
  const setLogoColor = (value: string) => update("logoColor", value)
  // Find matching preset icon, but don't default to first icon if not found
  const selectedIcon = LOGO_ICONS.find((icon) => icon.lightSvg === logoIcon)

  const isConfigured = Boolean(saved);
  // Required fields missing from the last saved settings: shown as one notice at the top, each linking to its field.
  const missingRequired = isConfigured
    ? ([["contactEmail", "Contact email"], ["address", "Address"], ["name", "Store name"], ["timezone", "Timezone"]] as const).filter(([key]) => !String(baseline[key] ?? "").trim())
    : [];
  const isDirty = useMemo(() => JSON.stringify(form) !== JSON.stringify(baseline), [form, baseline]);

  // Unsaved-change protection for reloads, tab closes and in-app links.
  useEffect(() => {
    if (!isDirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin || (url.pathname === window.location.pathname && url.search === window.location.search)) return;
      if (!window.confirm(LEAVE_MESSAGE)) {
        event.preventDefault();
        event.stopPropagation();
      }
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    document.addEventListener("click", onClick, true);
    return () => {
      window.removeEventListener("beforeunload", onBeforeUnload);
      document.removeEventListener("click", onClick, true);
    };
  }, [isDirty]);

  const update = <Key extends FieldKey>(key: Key, value: FormState[Key]) => {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => {
      const errorKey = key === "hours" ? "weeklyHours" : key;
      if (!current[errorKey]) return current;
      const next = { ...current };
      delete next[errorKey];
      return next;
    });
  };


  const showErrors = (errors: Partial<Record<string, string>>, message: string) => {
    setFieldErrors(errors);
    setStatus({ kind: "error", message });
    const first = Object.keys(FIELD_IDS).find((key) => errors[key]);
    requestAnimationFrame(() => {
      const target = first ? document.getElementById(FIELD_IDS[first]) : null;
      (target ?? summaryRef.current)?.focus();
    });
  };

  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (isPending) return;
    setStatus(null);
    setConflict(undefined);

    const input = toInput(form);
    const parsed = coffeeStoreSettingsInputSchema.safeParse(input);
    if (!parsed.success) {
      const errors: Partial<Record<string, string>> = {};
      for (const issue of parsed.error.issues) {
        const key = String(issue.path[0] ?? "");
        if (key && !errors[key]) errors[key] = issue.message;
      }
      showErrors(errors, "Some settings need attention before they can be saved.");
      return;
    }

    const submitted = form;
    startTransition(async () => {
      const result = await saveCoffeeStoreSettingsAction(input, saved?.updatedAt ?? null);

      if (!result.success) {
        if (result.conflict !== undefined) setConflict(result.conflict);
        setStatus({ kind: "error", message: result.error });
        requestAnimationFrame(() => summaryRef.current?.focus());
        return;
      }

      const persisted = result.data;
      const persistedForm = toFormState(persisted);
      setSaved(persisted);
      setBaseline(persistedForm);
      // Reflect the normalized saved values unless the form changed after submit.
      setForm((current) => (JSON.stringify(current) === JSON.stringify(submitted) ? persistedForm : current));
      setFieldErrors({});
      setStatus({ kind: "success", message: "Store settings saved." });
    });
  };

  const loadLatest = () => {
    if (conflict === undefined) return;
    const latest = toFormState(conflict);
    setSaved(conflict);
    setBaseline(latest);
    setForm(latest);
    setConflict(undefined);
    setFieldErrors({});
    setStatus({ kind: "success", message: "Loaded the latest saved settings. Reapply your changes and save." });
  };

  if (loadError) {
    return (
      <div className="p-4 md:p-6">
        <div role="alert" className="rounded-[6px] border border-destructive/30 bg-destructive/10 p-4 text-sm text-destructive">
          <p className="font-medium">Store settings could not be loaded.</p>
          <p className="mt-1">{loadError}</p>
          <Button type="button" variant="outline" size="sm" className="mt-3 min-h-11" onClick={() => window.location.reload()}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-6 px-4 pb-24 pt-6 md:px-6 md:pb-0" aria-describedby="store-settings-status">
      {!isConfigured ? (
        <div className="rounded-[6px] border border-amber-500/40 bg-amber-500/5 p-4 text-sm">
          <div className="flex items-start gap-3">
            <Store className="mt-0.5 h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <p className="font-medium">Store not configured. The storefront is unavailable until these settings are saved.</p>
          </div>
        </div>
      ) : null}

      {missingRequired.length ? (
        <div role="status" className="flex flex-col gap-2 rounded-[6px] border border-amber-500/50 bg-amber-500/10 p-4 text-sm sm:flex-row sm:items-center sm:justify-between">
          <p className="font-medium">
            {missingRequired.length === 1 ? `${missingRequired[0][1]} is missing.` : `Missing: ${missingRequired.map(([, label]) => label.toLowerCase()).join(", ")}.`}
            <span className="font-normal text-muted-foreground"> Required for order receipts and customer contact.</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {missingRequired.map(([key, label]) => (
              <Button key={key} asChild size="sm" variant="outline" className="min-h-9 rounded-[6px] bg-background active:scale-[0.97]">
                <a
                  href={`#${FIELD_IDS[key]}`}
                  onClick={(event) => {
                    const target = document.getElementById(FIELD_IDS[key]);
                    if (!target) return;
                    event.preventDefault();
                    target.scrollIntoView({ block: "center", behavior: "smooth" });
                    target.focus({ preventScroll: true });
                  }}
                >
                  Add {label.toLowerCase()}
                </a>
              </Button>
            ))}
          </div>
        </div>
      ) : null}

      <div id="store-settings-status" ref={summaryRef} tabIndex={-1} aria-live="polite" className="outline-none">
        {status ? (
          <div
            className={cn(
              "rounded-[6px] border p-3 text-sm",
              status.kind === "success"
                ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-800 dark:text-emerald-200"
                : "border-destructive/30 bg-destructive/10 text-destructive",
            )}
            role={status.kind === "error" ? "alert" : "status"}
          >
            <p>{status.message}</p>
            {status.kind === "error" && Object.keys(fieldErrors).length > 0 ? (
              <ul className="mt-2 list-disc space-y-1 pl-5">
                {Object.entries(fieldErrors).map(([key, message]) => (
                  <li key={key}>
                    {FIELD_IDS[key] ? <a className="underline" href={`#${FIELD_IDS[key]}`}>{message}</a> : message}
                  </li>
                ))}
              </ul>
            ) : null}
            {conflict !== undefined ? (
              <Button type="button" variant="outline" size="sm" className="mt-3 min-h-11" onClick={loadLatest}>
                Load latest settings (discards your changes)
              </Button>
            ) : null}
          </div>
        ) : null}
      </div>

      {/* Scroll margins keep a focused or linked field clear of the Save bar and the page header. */}
      <fieldset disabled={isPending} className="divide-y divide-border [&_input]:scroll-mb-28 [&_input]:scroll-mt-24 [&_select]:scroll-mb-28 [&_select]:scroll-mt-24 [&_textarea]:scroll-mb-28">
        <SettingsSection title="Identity">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="name" label="Store name" required error={fieldErrors.name}>
              <Input className="rounded-[6px]" id={FIELD_IDS.name} required maxLength={200} value={form.name} onChange={(event) => update("name", event.target.value)} aria-invalid={Boolean(fieldErrors.name)} aria-describedby={fieldErrors.name ? "name-error" : undefined} />
            </Field>
            <Field id="tagline" label="Tagline" error={fieldErrors.tagline}>
              <Input className="rounded-[6px]" id={FIELD_IDS.tagline} maxLength={300} value={form.tagline} onChange={(event) => update("tagline", event.target.value)} aria-invalid={Boolean(fieldErrors.tagline)} aria-describedby={fieldErrors.tagline ? "tagline-error" : undefined} />
            </Field>
            <Field id="description" label="Description" className="sm:col-span-2" error={fieldErrors.description}>
              <Textarea className="rounded-[6px]" id={FIELD_IDS.description} maxLength={2000} value={form.description} onChange={(event) => update("description", event.target.value)} rows={3} aria-invalid={Boolean(fieldErrors.description)} aria-describedby={fieldErrors.description ? "description-error" : undefined} />
            </Field>
          </div>
        </SettingsSection>

        <SettingsSection title="Logo">
          <div id={FIELD_IDS.logoIcon} tabIndex={-1} className="space-y-6 outline-none">
          {/* Logo Icon Selector */}
          <div>
            <Label>Logo Icon</Label>
            <div className="mt-2 flex items-center gap-2">
              <Select
                value={selectedIcon?.id || ''}
                onValueChange={(id) => {
                  const icon = LOGO_ICONS.find((i) => i.id === id);
                  if (icon) setLogoIcon(icon.lightSvg);
                }}
              >
                <SelectPrimitive.Trigger
                  className={cn(
                    'flex h-12 w-12 shrink-0 rounded-lg border border-input bg-background focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 p-0 overflow-hidden items-center justify-center'
                  )}
                >
                  <div
                    dangerouslySetInnerHTML={{ __html: logoIcon }}
                    style={{ filter: `hue-rotate(${logoColor}deg)` }}
                    className="[&>svg]:w-6 [&>svg]:h-6"
                  />
                </SelectPrimitive.Trigger>
                <SelectContent className="border-border dark:border-blue-700">
                  {LOGO_ICONS.map((icon) => (
                    <SelectItem key={icon.id} value={icon.id}>
                      <span className="flex items-center gap-3">
                        <div
                          dangerouslySetInnerHTML={{ __html: icon.lightSvg }}
                          style={{ filter: `hue-rotate(${logoColor}deg)` }}
                          className="[&>svg]:w-6 [&>svg]:h-6"
                        />
                        <span>
                          <span className="block font-medium text-gray-900 dark:text-gray-100">
                            {icon.name}
                          </span>
                        </span>
                      </span>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* SVG Code Editor Popover */}
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-12 w-12 shrink-0"
                    type="button"
                  >
                    <Code className="h-4 w-4" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[min(500px,calc(100vw-2rem))]" align="start">
                  <div className="space-y-4">
                    <div>
                      <h4 className="font-medium mb-2">Edit SVG Code</h4>
                      <p className="text-sm text-muted-foreground mb-4">
                        Edit the SVG code directly. Changes will be reflected in the icon preview.
                      </p>
                    </div>
                    <Textarea
                      value={logoIcon}
                      onChange={(e) => setLogoIcon(e.target.value)}
                      className="font-mono text-xs min-h-[300px]"
                      placeholder="<svg>...</svg>"
                    />
                    <div className="flex items-center gap-2">
                      <div className="text-sm text-muted-foreground">Preview:</div>
                      <div
                        dangerouslySetInnerHTML={{ __html: logoIcon }}
                        style={{ filter: `hue-rotate(${logoColor}deg)` }}
                        className="[&>svg]:w-8 [&>svg]:h-8 flex items-center justify-center p-2 border rounded"
                      />
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            </div>
          </div>

          {/* Logo Color Selector */}
          <div>
            <Label>Logo Color</Label>
            <div className="mt-2">
              <Select
                value={logoColor}
                onValueChange={(value) => setLogoColor(value)}
              >
                <SelectPrimitive.Trigger
                  className={cn(
                    'flex h-12 w-12 shrink-0 rounded-lg border border-input bg-background focus:outline-none disabled:cursor-not-allowed disabled:opacity-50 p-0 overflow-hidden items-center justify-center'
                  )}
                >
                  <SelectValue>
                    <div
                      className="w-6 h-6 rounded-full"
                      style={{
                        background: `hsl(${(240 + parseInt(logoColor)) % 360}, 70%, 50%)`
                      }}
                    />
                  </SelectValue>
                </SelectPrimitive.Trigger>
                <SelectContent className="border-border dark:border-blue-700">
                  <div className="grid grid-cols-4 gap-2 p-2">
                    {HUE_PRESETS.map((preset) => (
                      <SelectItem
                        key={preset.value}
                        value={preset.value.toString()}
                        className="cursor-pointer p-0 h-12 w-12 flex items-center justify-center [&>span:first-child]:hidden"
                      >
                        <div
                          className="w-6 h-6 rounded-full"
                          style={{
                            background: `hsl(${(240 + preset.value) % 360}, 70%, 50%)`
                          }}
                        />
                      </SelectItem>
                    ))}
                  </div>
                </SelectContent>
              </Select>
            </div>
          </div>
            <FieldError id="logoIcon" message={fieldErrors.logoIcon} />
          </div>
        </SettingsSection>

        <SettingsSection title="Contact and location">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field id="address" label="Address" required className="sm:col-span-2" error={fieldErrors.address}>
              <Input className="rounded-[6px]" id={FIELD_IDS.address} required maxLength={500} autoComplete="street-address" value={form.address} onChange={(event) => update("address", event.target.value)} aria-invalid={Boolean(fieldErrors.address)} aria-describedby={fieldErrors.address ? "address-error" : undefined} />
            </Field>
            <Field id="phone" label="Phone" error={fieldErrors.phone}>
              <Input className="rounded-[6px]" id={FIELD_IDS.phone} type="tel" maxLength={100} autoComplete="tel" value={form.phone} onChange={(event) => update("phone", event.target.value)} aria-invalid={Boolean(fieldErrors.phone)} aria-describedby={fieldErrors.phone ? "phone-error" : undefined} />
            </Field>
            <Field id="contactEmail" label="Contact email" required error={fieldErrors.contactEmail}>
              <Input className="rounded-[6px]" id={FIELD_IDS.contactEmail} type="email" required autoComplete="email" value={form.contactEmail} onChange={(event) => update("contactEmail", event.target.value)} aria-invalid={Boolean(fieldErrors.contactEmail)} aria-describedby={fieldErrors.contactEmail ? "contactEmail-error" : undefined} />
            </Field>
            <Field id="timezone" label="Timezone" required className="sm:col-span-2" error={fieldErrors.timezone}>
              <PlatformSelect
                id={FIELD_IDS.timezone}
                value={form.timezone}
                onValueChange={(next) => update("timezone", next)}
                placeholder="Select timezone"
                searchable
                aria-invalid={Boolean(fieldErrors.timezone)}
                aria-describedby={fieldErrors.timezone ? "timezone-error" : undefined}
                options={[
                  ...(form.timezone && !timeZones.includes(form.timezone) ? [{ value: form.timezone, label: form.timezone }] : []),
                  ...timeZones.map((zone) => ({ value: zone, label: zone.replaceAll("_", " ") })),
                ]}
              />
            </Field>
          </div>
        </SettingsSection>

        <SettingsSection title="Hours">
          <div id={FIELD_IDS.weeklyHours} tabIndex={-1} className="outline-none">
            <WeeklyHoursEditor
              hours={form.hours}
              timezone={form.timezone}
              error={fieldErrors.weeklyHours ?? null}
              disabled={isPending}
              onChange={(hours) => update("hours", hours)}
            />
          </div>
        </SettingsSection>

        <SettingsSection title="Pickup and tax">
          <div className="grid gap-4 sm:grid-cols-2">
            <NumberField field="pickupLeadTimeMinutes" label="Lead time (minutes)" value={form.pickupLeadTimeMinutes} error={fieldErrors.pickupLeadTimeMinutes} onChange={(value) => update("pickupLeadTimeMinutes", value)} />
            <NumberField field="pickupWindowMinutes" label="Pickup window (minutes)" value={form.pickupWindowMinutes} error={fieldErrors.pickupWindowMinutes} onChange={(value) => update("pickupWindowMinutes", value)} />
            <NumberField field="pickupCapacityPerWindow" label="Orders per window" value={form.pickupCapacityPerWindow} error={fieldErrors.pickupCapacityPerWindow} onChange={(value) => update("pickupCapacityPerWindow", value)} />
            <NumberField field="taxRateBasisPoints" label="Sales tax (%)" step={0.001} min={0} max={100} value={form.taxRateBasisPoints} error={fieldErrors.taxRateBasisPoints} onChange={(value) => update("taxRateBasisPoints", value)} />
            <Field id="currencyCode" label="Currency">
              <Input id="store-currency" value={form.currencyCode} readOnly aria-readonly="true" className="rounded-[6px] bg-muted/50" />
            </Field>
            <Field id="locale" label="Locale">
              <Input id="store-locale" value={form.locale} readOnly aria-readonly="true" className="rounded-[6px] bg-muted/50" />
            </Field>
          </div>
        </SettingsSection>
      </fieldset>

      <StoreSettingsSaveBar
        isSaving={isPending}
        status={isDirty && !isPending ? "Unsaved changes" : null}
        className="justify-end border-t border-border py-3"
        button={
          <Button type="submit" className="min-h-11 rounded-[6px] px-5 active:scale-[0.97]" disabled={isPending}>
            <Save className="mr-2 h-4 w-4" aria-hidden="true" />
            {isPending ? "Saving…" : isConfigured ? "Save changes" : "Configure store"}
          </Button>
        }
      />
    </form>
  );
}

function SettingsSection({ title, children }: { title: string; children: ReactNode }) {
  const id = `settings-${title.toLowerCase().replace(/[^a-z]+/g, "-")}`;
  return (
    <section aria-labelledby={id} className="grid gap-4 py-6 first:pt-0 md:grid-cols-[12rem_minmax(0,1fr)] md:gap-8">
      <h2 id={id} className="text-sm font-semibold">{title}</h2>
      <div className="min-w-0 max-w-3xl">{children}</div>
    </section>
  );
}

function FieldError({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return <p id={`${id}-error`} className="mt-1.5 text-xs text-destructive">{message}</p>;
}

function Field({
  id,
  label,
  required,
  hint,
  error,
  className,
  children,
}: {
  id: string;
  label: string;
  required?: boolean;
  hint?: string;
  error?: string;
  className?: string;
  children: ReactNode;
}) {
  const controlId = FIELD_IDS[id] ?? `store-${id}`;
  return (
    <div className={cn("block", className)}>
      <Label htmlFor={id === "currencyCode" ? "store-currency" : id === "locale" ? "store-locale" : controlId}>
        {label}
        {required ? <span className="ml-1 text-destructive" aria-hidden="true">*</span> : null}
      </Label>
      <div className="mt-2">{children}</div>
      {hint && !error ? <p id={`${id}-hint`} className="mt-1.5 text-xs text-muted-foreground">{hint}</p> : null}
      <FieldError id={id} message={error} />
    </div>
  );
}

function NumberField({
  field,
  label,
  hint,
  value,
  error,
  onChange,
  step = 1,
  min,
  max,
}: {
  field: keyof typeof PICKUP_LIMITS;
  label: string;
  hint?: string;
  step?: number;
  min?: number;
  max?: number;
  value: string;
  error?: string;
  onChange(value: string): void;
}) {
  const limits = PICKUP_LIMITS[field];
  return (
    <Field id={field} label={label} required hint={hint} error={error}>
      <Input className="rounded-[6px]"
        id={FIELD_IDS[field]}
        type="number"
        inputMode={step < 1 ? "decimal" : "numeric"}
        required
        step={step}
        min={min ?? limits.min}
        max={max ?? limits.max}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        aria-invalid={Boolean(error)}
        aria-describedby={error ? `${field}-error` : hint ? `${field}-hint` : undefined}
      />
    </Field>
  );
}
