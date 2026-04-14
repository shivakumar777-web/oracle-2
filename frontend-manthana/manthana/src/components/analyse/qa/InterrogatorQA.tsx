"use client";

import React, { useMemo, useState } from "react";
import type { InterrogatorQuestion } from "@/lib/analyse/types";

interface Props {
  questions: InterrogatorQuestion[];
  onSubmit: (answers: Array<{ question_id: string; answer: string }>) => void;
  onCancel?: () => void;
  disabled?: boolean;
}

export default function InterrogatorQA({
  questions,
  onSubmit,
  onCancel,
  disabled,
}: Props) {
  const [values, setValues] = useState<Record<string, string>>({});

  const sorted = useMemo(
    () => [...questions].sort((a, b) => a.id.localeCompare(b.id)),
    [questions]
  );

  const setVal = (id: string, v: string) => {
    setValues((prev) => ({ ...prev, [id]: v }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const answers = sorted.map((q) => ({
      question_id: q.id,
      answer: values[q.id] ?? "",
    }));
    onSubmit(answers);
  };

  return (
    <form
      onSubmit={handleSubmit}
      className="flex min-h-0 w-full max-w-full flex-col gap-4 rounded-xl border border-[var(--border)] bg-[var(--panel)] p-4 shadow-lg md:max-w-xl"
    >
      <h3 className="text-sm font-semibold uppercase tracking-wide text-[var(--muted)]">
        Clinical context
      </h3>
      <p className="text-xs text-[var(--muted)]">
        Each answer you add narrows clinical uncertainty and improves the structured report. Leave
        fields blank if unknown.
      </p>
      <div className="flex min-h-0 max-h-[min(75dvh,720px)] flex-col gap-3 overflow-y-auto pr-1">
        {sorted.map((q) => (
          <div key={q.id} className="rounded-lg border border-[var(--border-subtle)] p-3">
            <label className="mb-1 block text-sm font-medium text-[var(--foreground)]">
              {q.text}
            </label>
            {q.type === "boolean" && (
              <select
                className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-2 text-sm"
                value={values[q.id] ?? ""}
                onChange={(e) => setVal(q.id, e.target.value)}
                disabled={disabled}
              >
                <option value="">—</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
              </select>
            )}
            {q.type === "select" && q.options && (
              <select
                className="mt-1 w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-2 text-sm"
                value={values[q.id] ?? ""}
                onChange={(e) => setVal(q.id, e.target.value)}
                disabled={disabled}
              >
                <option value="">Select…</option>
                {q.options.map((o) => (
                  <option key={o} value={o}>
                    {o}
                  </option>
                ))}
              </select>
            )}
            {q.type === "text" && (
              <textarea
                className="mt-1 min-h-[72px] w-full rounded-md border border-[var(--border)] bg-[var(--background)] px-2 py-2 text-sm"
                value={values[q.id] ?? ""}
                onChange={(e) => setVal(q.id, e.target.value)}
                disabled={disabled}
                placeholder="Type your answer…"
              />
            )}
          </div>
        ))}
      </div>
      <div className="flex shrink-0 flex-wrap gap-2 pt-1">
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            className="rounded-md border border-[var(--border)] px-4 py-2 text-sm"
            disabled={disabled}
          >
            Back
          </button>
        )}
        <button
          type="submit"
          disabled={disabled || sorted.length === 0}
          className="rounded-md bg-[var(--accent)] px-4 py-2 text-sm font-semibold text-[var(--accent-fg)] disabled:opacity-50"
        >
          Continue to analysis
        </button>
      </div>
    </form>
  );
}
