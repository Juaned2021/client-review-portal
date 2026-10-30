"use client";
// Client Component: useActionState shows pending state and validation errors
// returned by the Server Action without a full page reload.

import { useActionState } from "react";
import { FieldError, inputClass, primaryButtonClass } from "@/components/form-field";
import { createProjectAction } from "@/server/actions/projects";

type Props = { clients: Array<{ id: string; name: string }> };

export function ProjectForm({ clients }: Props) {
  const [state, formAction, pending] = useActionState(createProjectAction, undefined);
  const errors = state?.fieldErrors ?? {};

  return (
    <form action={formAction} className="flex max-w-md flex-col gap-4">
      <label className="flex flex-col gap-1 text-sm">
        Name
        <input name="name" required minLength={2} maxLength={120} className={inputClass} />
        <FieldError errors={errors.name} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Client
        <select name="clientId" required className={inputClass} defaultValue="">
          <option value="" disabled>
            Select a client…
          </option>
          {clients.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
        <FieldError errors={errors.clientId} />
      </label>
      <label className="flex flex-col gap-1 text-sm">
        Due date
        <input name="dueDate" type="date" className={inputClass} />
        <FieldError errors={errors.dueDate} />
      </label>
      {state?.error && (
        <p role="alert" className="text-sm text-red-600">
          {state.error}
        </p>
      )}
      <button type="submit" disabled={pending} className={primaryButtonClass}>
        {pending ? "Creating…" : "Create project"}
      </button>
    </form>
  );
}
