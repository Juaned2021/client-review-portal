"use client";
// Client Component: pending state and field errors from the Server Action.

import { useActionState } from "react";
import { FieldError, inputClass, primaryButtonClass } from "@/components/form-field";
import { createDeliverableAction } from "@/server/actions/deliverables";

export function DeliverableForm({ projectId }: { projectId: string }) {
  const [state, formAction, pending] = useActionState(createDeliverableAction, undefined);
  const errors = state?.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex flex-col gap-3 rounded-md border border-zinc-200 p-4 sm:flex-row sm:items-start dark:border-zinc-800">
      <input type="hidden" name="projectId" value={projectId} />
      <label className="flex flex-1 flex-col gap-1 text-sm">
        Title
        <input name="title" required minLength={2} maxLength={160} className={inputClass} />
        <FieldError errors={errors.title} />
      </label>
      <label className="flex flex-1 flex-col gap-1 text-sm">
        Link
        <input name="linkUrl" type="url" required placeholder="https://" className={inputClass} />
        <FieldError errors={errors.linkUrl} />
      </label>
      <div className="flex flex-col gap-1 sm:pt-5">
        <button type="submit" disabled={pending} className={primaryButtonClass}>
          {pending ? "Adding…" : "Add deliverable"}
        </button>
        {state?.error && (
          <p role="alert" className="text-sm text-red-600">
            {state.error}
          </p>
        )}
      </div>
    </form>
  );
}
