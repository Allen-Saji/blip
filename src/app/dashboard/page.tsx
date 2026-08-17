"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

type Watch = {
  id: string;
  url: string;
  description: string;
  status: string;
  lastRunAt: string | null;
  createdAt: string;
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
                <div
                  key={change.id}
                  className="rounded-xl border border-neutral-200 p-4"
                >
                  <p className="text-sm text-neutral-900">{change.summary}</p>
                  <p className="mt-1 truncate text-xs text-neutral-400">
                    {watchUrl}
                  </p>
                  <p className="mt-1 text-xs text-neutral-400">
                    {new Date(change.createdAt).toLocaleString()}
                  </p>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </main>
  );
}
