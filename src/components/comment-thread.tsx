"use client";
// Client Component: interactive thread with an optimistic update. The new
// comment shows instantly, then is replaced by the server's version (or rolled
// back with an error). Initial data comes from the Server Component, so the
// thread is fully rendered on first paint without a client-side fetch.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { inputClass, primaryButtonClass } from "@/components/form-field";
import { LocalTime } from "@/components/local-time";
import { useTRPC } from "@/lib/trpc/client";
import type { CommentDTO } from "@/server/queries/comments";

type Viewer = { id: string; name: string; role: "ADMIN" | "CLIENT" };

export function CommentThread({
  deliverableId,
  viewer,
  initialComments,
  canComment,
}: {
  deliverableId: string;
  viewer: Viewer;
  initialComments: CommentDTO[];
  canComment: boolean;
}) {
  const trpc = useTRPC();
  const queryClient = useQueryClient();
  const listOptions = trpc.comment.list.queryOptions({ deliverableId });
  const { data: comments = initialComments } = useQuery({ ...listOptions, initialData: initialComments });

  const [body, setBody] = useState("");
  const [error, setError] = useState<string | null>(null);

  const addComment = useMutation(
    trpc.comment.add.mutationOptions({
      onMutate: async ({ body: text }) => {
        setError(null);
        // Stop in-flight refetches from overwriting the optimistic entry.
        await queryClient.cancelQueries({ queryKey: listOptions.queryKey });
        const previous = queryClient.getQueryData(listOptions.queryKey);
        const optimistic: CommentDTO = {
          id: `optimistic-${crypto.randomUUID()}`,
          body: text.trim(),
          createdAt: new Date().toISOString(),
          author: viewer,
        };
        queryClient.setQueryData(listOptions.queryKey, (old) => [...(old ?? []), optimistic]);
        setBody("");
        return { previous, text };
      },
      onError: (err, _vars, context) => {
        // Roll back and give the user their text back.
        if (context) {
          queryClient.setQueryData(listOptions.queryKey, context.previous);
          setBody(context.text);
        }
        setError(err.data?.zodError?.body?.[0] ?? err.message ?? "Could not post comment");
      },
      onSettled: () => queryClient.invalidateQueries({ queryKey: listOptions.queryKey }),
    }),
  );

  function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!body.trim() || addComment.isPending) return;
    addComment.mutate({ deliverableId, body });
  }

  return (
    <section className="flex flex-col gap-3" aria-labelledby="comments-heading">
      <h2 id="comments-heading" className="text-lg font-semibold">
        Comments <span className="text-sm font-normal text-zinc-500">({comments.length})</span>
      </h2>

      {comments.length === 0 ? (
        <p className="text-sm text-zinc-500">No comments yet.</p>
      ) : (
        <ul className="flex flex-col gap-3" aria-live="polite">
          {comments.map((c) => {
            const pending = c.id.startsWith("optimistic-");
            return (
              <li
                key={c.id}
                className={`rounded-md border border-zinc-200 p-3 text-sm dark:border-zinc-800 ${pending ? "opacity-60" : ""}`}
              >
                <div className="mb-1 flex items-center gap-2 text-xs text-zinc-500">
                  <span className="font-medium text-zinc-900 dark:text-zinc-100">{c.author.name}</span>
                  {c.author.role === "ADMIN" && <span className="rounded bg-zinc-100 px-1 dark:bg-zinc-800">Agency</span>}
                  {pending ? <span>Sending…</span> : <LocalTime iso={c.createdAt} />}
                </div>
                <p className="whitespace-pre-wrap">{c.body}</p>
              </li>
            );
          })}
        </ul>
      )}

      {canComment && (
        <form onSubmit={submit} className="flex flex-col gap-2">
          <label htmlFor="comment-body" className="sr-only">
            Add a comment
          </label>
          <textarea
            id="comment-body"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            rows={3}
            maxLength={5000}
            placeholder="Write a comment…"
            className={inputClass}
          />
          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}
          <div>
            <button type="submit" disabled={!body.trim() || addComment.isPending} className={primaryButtonClass}>
              Comment
            </button>
          </div>
        </form>
      )}
    </section>
  );
}
