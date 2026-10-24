"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Sheet, SheetContent, SheetDescription, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { createRecipeAction, searchMenuItemsAction, updateRecipeAction } from "../actions/recipes";
import { quantityError } from "../lib/recipeMath";
import { YIELD_UNIT_SUGGESTIONS, type MenuItemOption, type RecipeDetail } from "../lib/recipeTypes";
import { SearchPicker } from "./SearchPicker";

type Draft = { name: string; menuItem: MenuItemOption | null; yieldQuantity: string; yieldUnit: string; prepInstructions: string; allergenNotes: string };
type Errors = Partial<Record<"name" | "yieldQuantity" | "yieldUnit", string>>;

function initialDraft(recipe?: RecipeDetail | null): Draft {
  return {
    name: recipe?.name ?? "",
    menuItem: recipe?.menuItem ?? null,
    yieldQuantity: recipe?.yieldQuantity ? String(Number(recipe.yieldQuantity)) : "1",
    yieldUnit: recipe?.yieldUnit ?? "serving",
    prepInstructions: recipe?.prepInstructions ?? "",
    allergenNotes: recipe?.allergenNotes ?? "",
  };
}

function validate(draft: Draft): Errors {
  const errors: Errors = {};
  if (!draft.name.trim()) errors.name = "Name is required";
  const yieldError = quantityError(draft.yieldQuantity, "Yield");
  if (yieldError) errors.yieldQuantity = yieldError;
  if (!draft.yieldUnit.trim()) errors.yieldUnit = "Yield unit is required";
  else if (draft.yieldUnit.trim().length > 40) errors.yieldUnit = "Yield unit must be 40 characters or fewer";
  return errors;
}

function FieldError({ id, message }: { id: string; message?: string }) {
  return message ? <p id={id} className="text-sm text-destructive">{message}</p> : null;
}

export function RecipeFormSheet({ recipe, disabled = false }: { recipe?: RecipeDetail | null; disabled?: boolean }) {
  const router = useRouter();
  const editing = Boolean(recipe);
  const [open, setOpen] = React.useState(false);
  const [draft, setDraft] = React.useState<Draft>(() => initialDraft(recipe));
  const [errors, setErrors] = React.useState<Errors>({});
  const [serverError, setServerError] = React.useState<string | null>(null);
  const [pending, setPending] = React.useState(false);

  function openSheet(next: boolean) {
    if (next) {
      setDraft(initialDraft(recipe));
      setErrors({});
      setServerError(null);
    }
    setOpen(next);
  }

  function update(patch: Partial<Draft>) {
    setDraft((current) => ({ ...current, ...patch }));
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const nextErrors = validate(draft);
    setErrors(nextErrors);
    setServerError(null);
    if (Object.keys(nextErrors).length) return;
    setPending(true);
    const input = {
      name: draft.name,
      menuItemId: draft.menuItem?.id ?? null,
      yieldQuantity: draft.yieldQuantity,
      yieldUnit: draft.yieldUnit,
      prepInstructions: draft.prepInstructions,
      allergenNotes: draft.allergenNotes,
    };
    const response = recipe ? await updateRecipeAction(recipe.id, input) : await createRecipeAction(input);
    setPending(false);
    if (!response.success) return setServerError(response.error);
    setOpen(false);
    if (!recipe && response.data && "id" in response.data) router.push(`/dashboard/platform/recipes/${response.data.id}`);
    else router.refresh();
  }

  return (
    <>
      <Button type="button" variant={editing ? "outline" : "default"} className="rounded-full" disabled={disabled} onClick={() => openSheet(true)}>
        {editing ? <Pencil className="size-4" aria-hidden="true" /> : <Plus className="size-4" aria-hidden="true" />}
        {editing ? "Edit" : "New recipe"}
      </Button>
      <Sheet open={open} onOpenChange={openSheet}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-md">
          <form onSubmit={submit} noValidate className="flex min-h-full flex-col gap-4">
            <SheetHeader>
              <SheetTitle>{editing ? "Edit recipe" : "New recipe"}</SheetTitle>
              <SheetDescription className="sr-only">Recipe details</SheetDescription>
            </SheetHeader>
            <div className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="recipe-name">Name</Label>
                <Input id="recipe-name" value={draft.name} maxLength={200} aria-invalid={Boolean(errors.name) || undefined} aria-describedby={errors.name ? "recipe-name-error" : undefined} onChange={(event) => update({ name: event.currentTarget.value })} />
                <FieldError id="recipe-name-error" message={errors.name} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="recipe-menu-item">Menu item</Label>
                <SearchPicker<MenuItemOption>
                  id="recipe-menu-item"
                  selected={draft.menuItem}
                  onSelect={(menuItem) => update({ menuItem })}
                  search={searchMenuItemsAction}
                  placeholder="Search menu items"
                  emptyLabel="No menu items."
                  clearable
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <Label htmlFor="recipe-yield">Yield</Label>
                  <Input id="recipe-yield" inputMode="decimal" value={draft.yieldQuantity} aria-invalid={Boolean(errors.yieldQuantity) || undefined} aria-describedby={errors.yieldQuantity ? "recipe-yield-error" : undefined} onChange={(event) => update({ yieldQuantity: event.currentTarget.value })} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="recipe-yield-unit">Yield unit</Label>
                  <Input id="recipe-yield-unit" list="recipe-yield-units" value={draft.yieldUnit} maxLength={40} aria-invalid={Boolean(errors.yieldUnit) || undefined} aria-describedby={errors.yieldUnit ? "recipe-yield-unit-error" : undefined} onChange={(event) => update({ yieldUnit: event.currentTarget.value })} />
                  <datalist id="recipe-yield-units">
                    {YIELD_UNIT_SUGGESTIONS.map((unit) => <option key={unit} value={unit} />)}
                  </datalist>
                </div>
                <div className="col-span-2 space-y-1">
                  <FieldError id="recipe-yield-error" message={errors.yieldQuantity} />
                  <FieldError id="recipe-yield-unit-error" message={errors.yieldUnit} />
                </div>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="recipe-prep">Prep instructions</Label>
                <Textarea id="recipe-prep" rows={5} value={draft.prepInstructions} maxLength={5000} onChange={(event) => update({ prepInstructions: event.currentTarget.value })} />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="recipe-allergens">Allergen notes</Label>
                <Textarea id="recipe-allergens" rows={3} value={draft.allergenNotes} maxLength={5000} onChange={(event) => update({ allergenNotes: event.currentTarget.value })} />
              </div>
              <p role="alert" aria-live="assertive" className={serverError ? "rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive" : "sr-only"}>{serverError || ""}</p>
            </div>
            <SheetFooter className="mt-auto flex-row justify-end gap-2">
              <Button type="button" variant="ghost" className="rounded-full" onClick={() => setOpen(false)}>Cancel</Button>
              <Button type="submit" className="rounded-full" disabled={pending}>{pending ? "Saving…" : editing ? "Save" : "Create recipe"}</Button>
            </SheetFooter>
          </form>
        </SheetContent>
      </Sheet>
    </>
  );
}
