"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { createCateringOrderAction } from "../actions/catering";
import { CateringFactsForm, type CateringFactsDraft } from "./CateringFactsForm";

const EMPTY: CateringFactsDraft = { customerName: "", customerEmail: "", customerPhone: "", eventAtLocal: "", guestCount: "", deliveryAddress: "", notes: "" };

export function CreateCateringSheet({ timezone }: { timezone: string }) {
  const router = useRouter();
  const [open, setOpen] = React.useState(false);
  const [formKey, setFormKey] = React.useState(0);
  const createdId = React.useRef<string | null>(null);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <Button onClick={() => setOpen(true)} className="rounded-full"><Plus aria-hidden="true" />New inquiry</Button>
      <SheetContent aria-describedby={undefined} className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader><SheetTitle>New catering inquiry</SheetTitle></SheetHeader>
        <div className="mt-4">
          <CateringFactsForm
            key={formKey}
            idPrefix="new-catering"
            initial={EMPTY}
            timezone={timezone}
            withNotes
            submitLabel="Create inquiry"
            onSubmit={async (draft) => {
              const result = await createCateringOrderAction(draft);
              createdId.current = result.success ? result.id ?? null : null;
              return result;
            }}
            onDone={() => {
              setOpen(false);
              setFormKey((key) => key + 1);
              if (createdId.current) router.push(`/dashboard/platform/catering/${createdId.current}`);
              else router.refresh();
            }}
          />
        </div>
      </SheetContent>
    </Sheet>
  );
}
