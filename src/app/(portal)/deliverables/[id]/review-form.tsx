"use client";
// Client Component: two submit buttons (approve / request changes) share one
// form, with pending state and validation errors from the Server Action.

import { useActionState } from "react";
import { FieldError, inputClass } from "@/components/form-field";
import { reviewDeliverableAction } from "@/server/actions/deliverables";

export function ReviewForm({ deliverableId }: { deliverableId: string }) {
  const [state, formAction, pending] = useActionState(reviewDeliverableAction, undefined);

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-md border border-zinc-200 p-4 dark:border-zinc-800">
      <h2 className="font-semibold">Your review</h2>
      <input type="hidden" name="deliverableId" value={deliverableId} />
      <label className="flex flex-col gap-1 text-sm">
        Comment <span className="text-xs text-zinc-500">(required when requesting changes)</span>
        <textarea name="comment" rows={3} maxLength={5000} className={inputClass} />
        <FieldError errors={state?.fieldErrors?.comment} />
      </label>
      {state?.error && !state.fieldErrors?.comment && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
      <div className="flex flex-wrap gap-2">
        <button
          type="submit"
          name="decision"
          value="APPROVE"
          disabled={pending}
          className="rounded-md bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
        >
          Approve
        </button>
        <button
          type="submit"
          name="decision"
          value="REQUEST_CHANGES"
          disabled={pending}
          className="rounded-md border border-red-300 px-4 py-2 text-sm font-medium text-red-700 hover:bg-red-50 disabled:opacity-60 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
        >
          Request changes
        </button>
      </div>
    </form>
  );
}
