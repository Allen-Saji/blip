"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function Home() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await fetch("/api/watches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url,
          description,
          cadence: "daily",
          email: email.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Something went wrong");
        return;
      }

      router.push("/dashboard");
    } catch {
      setError("Network error. Try again.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-6">
      <div className="w-full max-w-xl text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-neutral-200 px-3 py-1 text-sm text-neutral-600 mb-8">
          <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
          Self-healing web scrapers
        </div>

        <h1 className="text-5xl font-bold tracking-tight text-neutral-900 sm:text-6xl">
          You never miss a blip.
        </h1>

        <p className="mt-5 text-lg text-neutral-500 leading-relaxed">
          Paste any URL. Describe what matters in plain English. Blip watches it
          and emails you when it changes — even if the site redesigns itself.
        </p>

        <form onSubmit={handleSubmit} className="mt-10 space-y-3 text-left">
          <input
            type="url"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
            placeholder="https://example.com/product/123"
            required
            className="w-full rounded-lg border border-neutral-200 bg-white px-4 py-3 text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900"
          />

          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Tell me when the price drops below $120 or it comes back in stock."
            required
            rows={2}
            className="w-full rounded-lg border border-neutral-200 bg-white px-4 py-3 text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 resize-none"
          />

          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@example.com — get the diff by email (optional)"
            className="w-full rounded-lg border border-neutral-200 bg-white px-4 py-3 text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900"
          />

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-neutral-900 py-3 font-medium text-white transition hover:bg-neutral-700 disabled:opacity-50"
          >
            {loading ? "Setting up your watch..." : "Watch this page →"}
          </button>

          {error && <p className="text-sm text-red-600">{error}</p>}
        </form>

        <p className="mt-6 text-xs text-neutral-400">
          No signup needed. One free watch per guest — add your email to get the
          diff in your inbox.
        </p>
      </div>
    </main>
  );
}
