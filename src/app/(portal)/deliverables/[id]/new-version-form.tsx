"use client";
// Client Component: pending state and inline URL validation errors.

import { useActionState } from "react";
import { FieldError, inputClass, primaryButtonClass } from "@/components/form-field";
import { submitNewVersionAction } from "@/server/actions/deliverables";

export function NewVersionForm({ deliverableId, nextVersion }: { deliverableId: string; nextVersion: number }) {
  const [state, formAction, pending] = useActionState(submitNewVersionAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
      <h2 className="font-semibold">Submit version {nextVersion}</h2>
      <input type="hidden" name="deliverableId" value={deliverableId} />
      <label className="flex flex-col gap-1 text-sm">
        Link to the revised deliverable
        <input name="linkUrl" type="url" required placeholder="https://" className={inputClass} />
        <FieldError errors={state?.fieldErrors?.linkUrl} />
      </label>
      {state?.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className={primaryButtonClass}>
        {pending ? "Submitting…" : "Submit for review"}
      </button>
    </form>
  );
}
