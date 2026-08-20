"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Watch = {
  id: string;
  url: string;
  description: string;
  status: string;
  collectorId: string | null;
  lastRunAt: string | null;
  createdAt: string;
  latestRun: {
    status: string;
    snapshotId: string | null;
    rawJson: unknown;
    error: string | null;
    finishedAt: string | null;
  } | null;
};

type Change = {
  change: {
    id: string;
    summary: string;
    beforeJson: unknown;
    afterJson: unknown;
    createdAt: string;
  };
  watchUrl: string;
  watchDescription: string;
};

export default function Dashboard() {
  const [watches, setWatches] = useState<Watch[]>([]);
  const [changes, setChanges] = useState<Change[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const [wRes, cRes] = await Promise.all([
        fetch("/api/watches"),
        fetch("/api/changes"),
      ]);
      const wData = await wRes.json();
      const cData = await cRes.json();
      setWatches(wData.watches ?? []);
      setChanges(cData.changes ?? []);
      setLoading(false);
    }
    load();
  }, []);

  async function checkNow(id: string) {
    await fetch(`/api/watches/${id}/check`, { method: "POST" });
    // Refresh after a short delay to see status change.
    setTimeout(() => window.location.reload(), 1000);
  }

  function formatJson(value: unknown): string {
    return JSON.stringify(value, null, 2) ?? "null";
  }

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center">
        <p className="text-neutral-400">Loading...</p>
      </main>
    );
  }

  return (
    <main className="min-h-screen px-6 py-12">
      <div className="mx-auto max-w-3xl">
        <div className="flex items-center justify-between mb-10">
          <h1 className="text-2xl font-bold text-neutral-900">Your watches</h1>
          <Link
            href="/"
            className="rounded-lg border border-neutral-200 px-4 py-2 text-sm font-medium text-neutral-700 hover:bg-neutral-50"
          >
            + Add watch
          </Link>
        </div>

        {watches.length === 0 ? (
          <div className="rounded-xl border border-dashed border-neutral-300 p-12 text-center">
            <p className="text-neutral-500">
              No watches yet.{" "}
              <Link href="/" className="font-medium text-neutral-900 underline">
                Add your first one
              </Link>
              .
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {watches.map((watch) => (
              <div
                key={watch.id}
                className="rounded-xl border border-neutral-200 p-5"
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-neutral-900">
                      {watch.url}
                    </p>
                    <p className="mt-1 text-sm text-neutral-500 line-clamp-2">
                      {watch.description}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full px-2.5 py-1 text-xs font-medium ${
                      watch.status === "active"
                        ? "bg-emerald-50 text-emerald-700"
                        : watch.status === "error"
                          ? "bg-red-50 text-red-700"
                          : "bg-amber-50 text-amber-700"
                    }`}
                  >
                    {watch.status}
                  </span>
                </div>
                <div className="mt-4 flex items-center justify-between">
                  <span className="text-xs text-neutral-400">
                    Last run:{" "}
                    {watch.lastRunAt
                      ? new Date(watch.lastRunAt).toLocaleString()
                      : "never"}
                  </span>
                  {watch.status === "active" && (
                    <button
                      onClick={() => checkNow(watch.id)}
                      className="text-xs font-medium text-neutral-700 underline hover:text-neutral-900"
                    >
                      Check now
                    </button>
                  )}
                </div>

                {watch.collectorId && (
                  <div className="mt-4 border-t border-neutral-100 pt-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-400">
                        Structured output
                      </p>
                      <code className="rounded bg-neutral-100 px-2 py-1 text-[11px] text-neutral-500">
                        {watch.collectorId}
                      </code>
                    </div>
                    {watch.latestRun?.rawJson ? (
                      <details className="mt-3 overflow-hidden rounded-lg border border-neutral-200 bg-neutral-50">
                        <summary className="cursor-pointer px-3 py-2 text-xs font-medium text-neutral-700 hover:bg-neutral-100">
                          View latest result
                        </summary>
                        <pre className="max-h-72 overflow-auto border-t border-neutral-200 p-3 text-[11px] leading-relaxed text-neutral-600">
                          {formatJson(watch.latestRun.rawJson)}
                        </pre>
                      </details>
                    ) : (
                      <p className="mt-2 text-xs text-neutral-400">
                        No structured result yet.
                      </p>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {changes.length > 0 && (
          <>
            <h2 className="mt-12 mb-4 text-lg font-semibold text-neutral-900">
              Recent changes
            </h2>
            <div className="space-y-3">
              {changes.map(({ change, watchUrl }) => (
                <details
                  key={change.id}
                  className="group rounded-xl border border-neutral-200 bg-white"
                >
                  <summary className="cursor-pointer list-none p-4 [&::-webkit-details-marker]:hidden">
                    <div className="flex items-start justify-between gap-4">
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-neutral-900">
                          {change.summary}
                        </p>
                        <p className="mt-1 truncate text-xs text-neutral-400">
                          {watchUrl}
                        </p>
                        <p className="mt-1 text-xs text-neutral-400">
                          {new Date(change.createdAt).toLocaleString()}
                        </p>
                      </div>
                      <span className="shrink-0 rounded-full bg-neutral-100 px-2 py-1 text-[11px] font-medium text-neutral-500 group-open:bg-[#e6f3fe] group-open:text-[#0075de]">
                        View diff
                      </span>
                    </div>
                  </summary>
                  <div className="grid gap-3 border-t border-neutral-100 p-4 md:grid-cols-2">
                    <div>
                      <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-400">
                        Before
                      </p>
                      <pre className="max-h-64 overflow-auto rounded-lg bg-[#f6f5f4] p-3 text-[11px] leading-relaxed text-neutral-600">
                        {formatJson(change.beforeJson)}
                      </pre>
                    </div>
                    <div>
                      <p className="mb-2 text-[11px] font-medium uppercase tracking-[0.16em] text-neutral-400">
                        After
                      </p>
                      <pre className="max-h-64 overflow-auto rounded-lg bg-[#e6f3fe] p-3 text-[11px] leading-relaxed text-neutral-700">
                        {formatJson(change.afterJson)}
                      </pre>
                    </div>
                  </div>
                </details>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
