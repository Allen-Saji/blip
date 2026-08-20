"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

/* Scroll-reveal wrapper: fades/slides content up when it enters the viewport. */
function Reveal({
  children,
  className = "",
  delayClass = "",
}: {
  children: React.ReactNode;
  className?: string;
  delayClass?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.classList.add("visible");
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div ref={ref} className={`reveal ${delayClass} ${className}`}>
      {children}
    </div>
  );
}

/* Flat illustrated character mark in a 2px colored circle, per the design doc. */
const MARK_COLORS = ["#097fe8", "#f64932", "#ffb110", "#62aef0"];

function CharacterMark({
  variant,
  color,
  className = "",
  delayClass = "",
}: {
  variant: number;
  color: string;
  className?: string;
  delayClass?: string;
}) {
  return (
    <span
      className={`mark-pop inline-flex h-11 w-11 items-center justify-center rounded-full border-2 bg-white ${delayClass} ${className}`}
      style={{ borderColor: color }}
      aria-hidden="true"
    >
      <svg width="26" height="26" viewBox="0 0 26 26" fill="none">
        <circle cx="13" cy="12" r="7" fill={color} />
        {variant % 3 === 0 && (
          <path d="M8 9h10M8 9c2 4 8 4 10 0" stroke="#fff" strokeWidth="1.4" />
        )}
        {variant % 3 === 1 && (
          <>
            <circle cx="10.5" cy="11" r="1" fill="#fff" />
            <circle cx="15.5" cy="11" r="1" fill="#fff" />
            <path d="M10.5 14.5c1.6 1.2 3.4 1.2 5 0" stroke="#fff" strokeWidth="1.4" />
          </>
        )}
        {variant % 3 === 2 && (
          <>
            <path d="M9.5 11.5h2M14.5 11.5h2" stroke="#fff" strokeWidth="1.4" />
            <path d="M11 15.5c1.3-1 2.7-1 4 0" stroke="#fff" strokeWidth="1.4" />
          </>
        )}
      </svg>
    </span>
  );
}

function Squiggle({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      width="120"
      height="40"
      viewBox="0 0 120 40"
      fill="none"
      aria-hidden="true"
    >
      <path
        className="squiggle-path"
        d="M4 26c8-14 16-6 24-18s16-6 24-18 16-6 24-18 16-6 24-18 16-6 16-16"
        stroke="#000"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
    </svg>
  );
}

function Sparkle({ className = "", color = "#ffb110" }: { className?: string; color?: string }) {
  return (
    <svg className={className} width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden="true">
      <path
        d="M11 2c.8 4.6 3.4 7.2 8 8-4.6.8-7.2 3.4-8 8-.8-4.6-3.4-7.2-8-8 4.6-.8 7.2-3.4 8-8Z"
        fill={color}
      />
    </svg>
  );
}

const FEATURES = [
  {
    title: "Describe once",
    body: "Paste a URL and say what you care about in plain English. The price, whether it is in stock, a deadline on a grant page. No selectors, no code.",
    mark: <CharacterMark variant={0} color="#097fe8" />,
  },
  {
    title: "We watch it",
    body: "Bright Data Scraper Studio extracts the field as structured data, and Blip snapshots it on a schedule. Nothing to install, nothing to maintain.",
    mark: <CharacterMark variant={1} color="#f64932" />,
  },
  {
    title: "You get a clean diff",
    body: "When the value changes, Blip emails you a human-readable diff. Not a wall of HTML, not a search alert. Just the change you asked about.",
    mark: <CharacterMark variant={2} color="#ffb110" />,
  },
  {
    title: "Self-heal",
    body: "Sites redesign. Selectors break. Blip hands your original plain-language description back to Scraper Studio, the scraper heals itself, and the watch keeps running.",
    mark: <CharacterMark variant={0} color="#62aef0" />,
  },
];

export default function Home() {
  const router = useRouter();
  const [url, setUrl] = useState("");
  const [description, setDescription] = useState("");
  const [alertRule, setAlertRule] = useState("any meaningful change");
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const formRef = useRef<HTMLFormElement>(null);

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
          alertRule,
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
    <main className="overflow-x-clip bg-[#f6f5f4] text-black">
      {/* ---------- Nav ---------- */}
      <header
        className="fixed inset-x-0 top-0 z-50 border-b border-black/[0.08] bg-[#f6f5f4]/95 backdrop-blur-sm"
        style={{ boxShadow: "0px 0.7px 1.462px 0px rgb(0 0 0 / 0.015), 0px 3px 9px 0px rgb(0 0 0 / 0.03)" }}
      >
        <nav className="mx-auto flex h-16 max-w-[1440px] items-center justify-between px-6">
          <a href="#" className="flex items-center gap-2 font-semibold tracking-tight">
            <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[#0075de] text-white">
              <span className="h-1.5 w-1.5 rounded-full bg-white" />
            </span>
            Blip
          </a>

          <div className="hidden items-center gap-1 md:flex">
            <a href="#how" className="rounded-lg px-4 py-3 text-sm text-black/55 transition hover:text-black">
              How it works
            </a>
            <a href="#heal" className="rounded-lg px-4 py-3 text-sm text-black/55 transition hover:text-black">
              Self-heal
            </a>
            <a href="#watch" className="rounded-lg px-4 py-3 text-sm text-black/55 transition hover:text-black">
              Start watching
            </a>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => document.getElementById("watch")?.scrollIntoView({ behavior: "smooth" })}
              className="hidden rounded-lg px-4 py-2 text-sm font-medium text-black/95 transition hover:bg-black/5 sm:block"
            >
              Sign in
            </button>
            <button
              type="button"
              onClick={() => document.getElementById("watch")?.scrollIntoView({ behavior: "smooth" })}
              className="rounded-lg bg-[#0075de] px-4 py-2 text-sm font-medium text-white transition hover:bg-[#0065c0]"
            >
              Watch a page
            </button>
          </div>
        </nav>
      </header>

      {/* ---------- Hero ---------- */}
      <section className="relative pt-36 pb-20 text-center">
        <div className="pointer-events-none absolute inset-x-0 top-24 flex justify-center">
          <div className="relative">
            <Squiggle className="absolute -left-40 top-8 rotate-[-6deg] opacity-60" />
            <Squiggle className="absolute -right-44 top-6 rotate-[8deg] opacity-40" />
            <Sparkle className="absolute -left-60 top-0 floaty" color="#ffb110" />
            <Sparkle className="absolute -right-56 top-16 floaty delay-2" color="#f64932" />
          </div>
        </div>

        <div className="mx-auto flex max-w-[1100px] flex-col items-center px-6">
          <Reveal className="flex items-center gap-1">
            {Array.from({ length: 7 }).map((_, i) => (
              <CharacterMark
                key={i}
                variant={i}
                color={MARK_COLORS[i % MARK_COLORS.length]}
                delayClass={`delay-${i + 1}`}
              />
            ))}
          </Reveal>

          <Reveal delayClass="delay-2" className="mt-8">
            <h1 className="display mx-auto max-w-4xl font-semibold">
              You never miss a <span className="highlight-pill">blip.</span>
            </h1>
          </Reveal>

          <Reveal delayClass="delay-3" className="mt-6">
            <p className="mx-auto max-w-xl text-lg leading-relaxed text-[#615d59]">
              Paste any URL. Describe what matters in plain English. Blip watches
              it and emails you a clean diff when it changes, even if the site
              redesigns itself overnight.
            </p>
          </Reveal>

          {/* Watch form card */}
          <Reveal delayClass="delay-4" className="mt-12 w-full max-w-lg">
            <div className="rounded-xl border border-black/[0.08] bg-white p-6 text-left sm:p-8">
              <form ref={formRef} onSubmit={handleSubmit} className="space-y-3">
                <div>
                  <label htmlFor="url" className="mb-1.5 block text-sm font-medium text-black/90">
                    Page URL
                  </label>
                  <input
                    id="url"
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    placeholder="https://example.com/product/123"
                    required
                    className="w-full rounded-lg border border-black/10 bg-white px-4 py-3 text-[15px] text-black placeholder:text-black/40 focus:border-[#0075de] focus:outline-none focus:ring-2 focus:ring-[#0075de]/20"
                  />
                </div>

                <div>
                  <label htmlFor="description" className="mb-1.5 block text-sm font-medium text-black/90">
                    What to watch
                  </label>
                  <textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Tell me when the price drops below $120 or it comes back in stock."
                    required
                    rows={2}
                    className="w-full resize-none rounded-lg border border-black/10 bg-white px-4 py-3 text-[15px] text-black placeholder:text-black/40 focus:border-[#0075de] focus:outline-none focus:ring-2 focus:ring-[#0075de]/20"
                  />
                </div>

                <div>
                  <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-black/90">
                    Email <span className="font-normal text-black/40">(optional)</span>
                  </label>
                  <input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full rounded-lg border border-black/10 bg-white px-4 py-3 text-[15px] text-black placeholder:text-black/40 focus:border-[#0075de] focus:outline-none focus:ring-2 focus:ring-[#0075de]/20"
                  />
                </div>

                <div>
                  <label htmlFor="alertRule" className="mb-1.5 block text-sm font-medium text-black/90">
                    Alert rule
                  </label>
                  <input
                    id="alertRule"
                    type="text"
                    value={alertRule}
                    onChange={(e) => setAlertRule(e.target.value)}
                    placeholder="price drops below $120"
                    className="w-full rounded-lg border border-black/10 bg-white px-4 py-3 text-[15px] text-black placeholder:text-black/40 focus:border-[#0075de] focus:outline-none focus:ring-2 focus:ring-[#0075de]/20"
                  />
                  <p className="mt-1.5 text-xs text-black/40">
                    Examples: price drops below $120, back in stock, or any meaningful change.
                  </p>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full rounded-lg bg-[#0075de] px-4 py-3 text-sm font-medium text-white transition hover:bg-[#0065c0] disabled:opacity-50"
                >
                  {loading ? "Setting up your watch..." : "Watch this page"}
                </button>

                {error && <p className="text-sm text-[#e32d14]">{error}</p>}
              </form>
            </div>
          </Reveal>

          <Reveal delayClass="delay-5" className="mt-5">
            <p className="text-xs text-black/40">
              No signup needed. One free watch per guest, add your email to get
              the diff in your inbox.
            </p>
          </Reveal>
        </div>
      </section>

      {/* ---------- How it works ---------- */}
      <section id="how" className="mx-auto max-w-[1440px] px-6 pb-20 pt-10">
        <Reveal className="text-center">
          <h2 className="display-sm mx-auto max-w-3xl font-medium">
            Scrapers break. <span className="highlight-pill highlight-pill-yellow">Blip</span> heals
            itself.
          </h2>
          <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-[#615d59]">
            A personal change monitor built for the way the web actually works.
            Four steps, zero maintenance.
          </p>
        </Reveal>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map((feature, i) => (
            <Reveal key={feature.title} delayClass={`delay-${(i % 4) + 1}`}>
              <div className="h-full rounded-xl border border-black/[0.08] bg-white p-6">
                {feature.mark}
                <h3 className="mt-5 text-[22px] font-semibold tracking-tight">{feature.title}</h3>
                <p className="mt-2 text-[15px] leading-relaxed text-[#615d59]">{feature.body}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* ---------- Self-heal accent panel ---------- */}
      <section id="heal" className="mx-auto max-w-[1440px] px-6 pb-20">
        <Reveal>
          <div className="overflow-hidden rounded-xl bg-[#ffb110]">
            <div className="grid items-center gap-10 p-8 sm:p-12 lg:grid-cols-2">
              <div>
                <h2 className="heading font-medium text-black">
                  The description is the source of truth.
                </h2>
                <p className="mt-4 max-w-md text-base leading-relaxed text-black/80">
                  When a site redesigns and extraction comes back empty, Blip
                  hands Scraper Studio your original plain-language description.
                  Scraper Studio rewrites the extraction, the collector heals,
                  and the data keeps flowing. You never see the gap.
                </p>
                <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-white px-4 py-2 text-sm font-medium text-black">
                  <span className="h-2 w-2 rounded-full bg-[#0075de]" />
                  Verified live against a redesigning fixture site
                </div>
              </div>

              <div
                className="relative rounded-lg bg-white p-6 text-sm text-black"
                style={{ boxShadow: "0px 4px 12px rgba(0,0,0,0.1)" }}
              >
                <div className="flex items-center justify-between border-b border-black/10 pb-3">
                  <span className="font-medium">Self-heal event</span>
                  <span className="rounded-full bg-[#e6f3fe] px-2.5 py-0.5 text-xs font-medium text-[#0075de]">
                    recovered
                  </span>
                </div>
                <div className="mt-4 space-y-2 text-black/70">
                  <p className="flex items-center gap-2">
                    <span className="rounded-full bg-[#f64932] px-2 py-0.5 text-xs font-medium text-white">break</span>
                    extraction came back empty
                  </p>
                  <p className="flex items-center gap-2">
                    <span className="rounded-full bg-[#ffb110] px-2 py-0.5 text-xs font-medium text-black">heal</span>
                    scraper rewrites from your description
                  </p>
                  <p className="flex items-center gap-2">
                    <span className="rounded-full bg-[#0075de] px-2 py-0.5 text-xs font-medium text-white">flow</span>
                    watch resumes, diff email sent
                  </p>
                </div>
                <div className="mt-4 rounded-lg border border-black/10 bg-[#f6f5f4] p-3">
                  <p className="font-mono text-xs text-black/60">$109 - $79 (price drop)</p>
                  <p className="font-mono text-xs text-black/60">In stock - ships today</p>
                </div>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ---------- Midnight diff panel ---------- */}
      <section className="mx-auto max-w-[1440px] px-6 pb-20">
        <Reveal>
          <div className="overflow-hidden rounded-xl bg-[#02093a]">
            <div className="grid items-center gap-10 p-8 sm:p-12 lg:grid-cols-2">
              <div>
                <h2 className="heading font-medium text-white">
                  A clean diff in your inbox.
                </h2>
                <p className="mt-4 max-w-md text-base leading-relaxed text-white/70">
                  No HTML dumps, no keyword noise. When the value you described
                  changes, Blip emails exactly what changed: before, after, and
                  the field it happened on.
                </p>
                <div className="mt-6 inline-flex items-center gap-2 rounded-full bg-white/10 px-4 py-2 text-sm font-medium text-white">
                  Sent via Resend, verified end to end
                </div>
              </div>

              <div className="rounded-lg bg-white p-5 text-sm text-black">
                <div className="border-b border-black/10 pb-3">
                  <p className="text-xs text-black/50">Blip - change detected</p>
                  <p className="mt-1 font-semibold">Aurora X9 Wireless Earbuds</p>
                </div>
                <div className="mt-3 rounded-lg border border-black/10 bg-[#f6f5f4] p-3">
                  <p className="text-xs text-black/50">Price</p>
                  <p className="mt-0.5 font-mono text-sm">
                    <span className="text-black/40 line-through">$189</span>
                    <span className="mx-1 text-black/50">-</span>
                    <span className="font-semibold text-[#0075de]">$109</span>
                  </p>
                </div>
                <p className="mt-3 text-xs text-black/40">
                  Hello from Blip. The thing you asked us to watch just changed.
                </p>
              </div>
            </div>
          </div>
        </Reveal>
      </section>

      {/* ---------- Final CTA ---------- */}
      <section id="watch" className="pb-24 pt-6 text-center">
        <Reveal>
          <h2 className="display mx-auto max-w-3xl font-semibold">
            Start <span className="highlight-pill">watching</span> something.
          </h2>
          <p className="mx-auto mt-4 max-w-md text-base text-[#615d59]">
            One URL, one plain-English description. That is the whole setup.
          </p>
          <button
            type="button"
            onClick={() =>
              document
                .querySelector("input#url")
                ?.scrollIntoView({ behavior: "smooth", block: "center" })
            }
            className="mt-8 rounded-lg bg-[#0075de] px-6 py-3 text-sm font-medium text-white transition hover:bg-[#0065c0]"
          >
            Watch a page
          </button>
        </Reveal>
      </section>

      {/* ---------- Footer ---------- */}
      <footer className="border-t border-black/[0.08] py-8">
        <div className="mx-auto flex max-w-[1440px] flex-col items-center justify-between gap-4 px-6 text-sm text-black/55 sm:flex-row">
          <span className="flex items-center gap-2 font-medium text-black/80">
            <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-[#0075de]">
              <span className="h-1 w-1 rounded-full bg-white" />
            </span>
            Blip
          </span>
          <p className="text-xs text-black/40">
            Powered by Bright Data Scraper Studio.
          </p>
        </div>
      </footer>
    </main>
  );
}
