"use client";

import * as React from "react";
import { PlatformSelect, type PlatformSelectOption } from "@/features/platform/components/PlatformSelect";
import { cn } from "@/lib/utils";

function optionsFrom(children: React.ReactNode): PlatformSelectOption[] {
  const options: PlatformSelectOption[] = [];
  React.Children.forEach(children, (child) => {
    if (!React.isValidElement<{ value?: string | number; children?: React.ReactNode; disabled?: boolean }>(child)) return;
    if (child.type === React.Fragment) { options.push(...optionsFrom(child.props.children)); return; }
    const label = React.Children.toArray(child.props.children).join("");
    options.push({ value: String(child.props.value ?? label), label, disabled: child.props.disabled });
  });
  return options;
}

/**
 * Compact GET-form filter: `<option>` children become a popover list, and choosing one
 * submits the surrounding form (the value travels in a hidden input named `name`).
 */
export function FilterSelect({ id, name, defaultValue, className, children, "aria-label": ariaLabel }: {
  id?: string;
  name: string;
  defaultValue?: string;
  className?: string;
  children: React.ReactNode;
  "aria-label"?: string;
}) {
  const options = optionsFrom(children);
  return (
    <div className={cn("min-w-0", className)}>
      <PlatformSelect id={id} name={name} defaultValue={defaultValue} options={options} submitOnChange searchable={false} size="sm" aria-label={ariaLabel} />
    </div>
  );
}
