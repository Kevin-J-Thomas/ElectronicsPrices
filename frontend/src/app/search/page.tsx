"use client";

import { FormEvent, useState } from "react";
import { Search as SearchIcon, ExternalLink, ArrowDownAZ, TrendingDown } from "lucide-react";
import TopNav from "@/components/TopNav";
import { ScoreBadge } from "@/components/ui/ScoreBadge";
import { TableSkeleton } from "@/components/ui/Skeleton";
import { api } from "@/lib/api";
import { formatINR } from "@/lib/utils";

type Result = {
  listing_id: number;
  title: string;
  site: string;
  url: string;
  condition: string;
  price: number;
  currency: string;
  score: number | null;
  scraped_at: string | null;
};

const EXAMPLE_QUERIES = ["Samsung SSD", "Ryzen 5 7600", "RTX 4060", "DDR5 RAM", "gaming laptop"];

export default function SearchPage() {
  const [q, setQ] = useState("");
  const [submitted, setSubmitted] = useState("");
  const [results, setResults] = useState<Result[] | null>(null);
  const [loading, setLoading] = useState(false);

  async function runSearch(query: string) {
    if (!query.trim()) return;
    setLoading(true);
    setSubmitted(query);
    try {
      const r = await api.get("/search", { params: { q: query, limit: 100 } });
      setResults(r.data.results);
    } finally {
      setLoading(false);
    }
  }

  function handleSubmit(e: FormEvent) {
    e.preventDefault();
    runSearch(q);
  }

  function pickExample(ex: string) {
    setQ(ex);
    runSearch(ex);
  }

  const lowest = results?.[0]?.price;

  return (
    <>
      <TopNav />
      <main className="max-w-6xl mx-auto px-6 py-10 md:py-14">

        <section className="mb-10 animate-slide-up">
          <div className="eyebrow mb-3">Section 02 · Discovery</div>
          <h1 className="font-serif text-5xl font-semibold tracking-tight leading-[1.05]">
            Search <span className="italic text-sienna">any product</span>,
            <br />
            compare every seller.
          </h1>
          <p className="mt-5 max-w-2xl text-lg text-ink-soft leading-relaxed">
            Results are sorted by price, scored against peers on a 5-point value scale.
          </p>
        </section>

        {/* Search form */}
        <form onSubmit={handleSubmit} className="mb-6 animate-slide-up-delay-1">
          <div className="relative">
            <SearchIcon
              size={18}
              className="absolute left-5 top-1/2 -translate-y-1/2 text-ink-faint pointer-events-none"
            />
            <input
              type="text"
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Samsung SSD, Ryzen 5 7600, RTX 4060…"
              className="w-full pl-14 pr-32 py-5 text-lg font-serif bg-surface border border-line rounded-xl focus:outline-none focus:border-ink focus:shadow-lift transition-all placeholder:text-ink-faint placeholder:italic"
              autoFocus
            />
            <button
              type="submit"
              disabled={loading || !q.trim()}
              className="absolute right-2 top-1/2 -translate-y-1/2 btn-accent disabled:opacity-40"
            >
              {loading ? "Searching…" : "Search"}
            </button>
          </div>

          {/* Example chips */}
          <div className="mt-4 flex flex-wrap items-center gap-2">
            <span className="eyebrow mr-1">Try</span>
            {EXAMPLE_QUERIES.map((ex) => (
              <button
                key={ex}
                type="button"
                onClick={() => pickExample(ex)}
                className="text-xs px-3 py-1.5 rounded-full border border-line bg-surface text-ink-soft hover:border-sienna hover:text-sienna hover:bg-sienna/5 transition-colors"
              >
                {ex}
              </button>
            ))}
          </div>
        </form>

        {/* Results summary strip */}
        {submitted && !loading && results !== null && (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 text-sm animate-fade-in">
            <div className="flex items-baseline gap-3">
              <span className="eyebrow">Results for</span>
              <span className="font-serif italic text-lg text-ink">&quot;{submitted}&quot;</span>
              <span className="text-ink-faint">· {results.length} matches</span>
            </div>
            {lowest !== undefined && (
              <div className="flex items-center gap-2 text-ink-soft">
                <TrendingDown size={14} className="text-sage" />
                <span>Lowest price:</span>
                <span className="num font-semibold text-sage">{formatINR(lowest)}</span>
              </div>
            )}
          </div>
        )}

        {loading ? (
          <TableSkeleton rows={6} cols={6} />
        ) : results === null ? (
          <EmptyState />
        ) : results.length === 0 ? (
          <NoResults query={submitted} />
        ) : (
          <div className="card overflow-hidden shadow-soft animate-slide-up">
            <table className="table-refined">
              <thead>
                <tr>
                  <th className="w-12 text-right">
                    <ArrowDownAZ size={12} className="inline text-ink-faint" />
                  </th>
                  <th>Product</th>
                  <th className="w-32">Site</th>
                  <th className="w-24 text-right">Price</th>
                  <th className="w-28">Score</th>
                  <th className="w-16 text-right"></th>
                </tr>
              </thead>
              <tbody>
                {results.map((r, i) => (
                  <tr key={r.listing_id} className="group">
                    <td className="num text-xs text-ink-faint text-right">
                      {String(i + 1).padStart(2, "0")}
                    </td>
                    <td>
                      <div className="flex flex-col">
                        <span className="text-ink leading-tight line-clamp-2 pr-4">
                          {r.title}
                        </span>
                        {r.condition && r.condition !== "new" && (
                          <span className="mt-1 text-2xs tracking-editorial uppercase text-amber">
                            {r.condition}
                          </span>
                        )}
                      </div>
                    </td>
                    <td>
                      <span className="text-2xs tracking-editorial uppercase text-ink-soft">
                        {r.site}
                      </span>
                    </td>
                    <td className="text-right">
                      <span className="num text-base font-semibold text-ink">
                        {formatINR(r.price)}
                      </span>
                    </td>
                    <td>
                      <ScoreBadge score={r.score} variant="column" />
                    </td>
                    <td className="text-right">
                      <a
                        href={r.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 text-xs text-ink-faint group-hover:text-sienna transition-colors"
                      >
                        Visit
                        <ExternalLink size={11} />
                      </a>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}

function EmptyState() {
  return (
    <div className="card p-16 text-center">
      <div className="font-serif text-2xl text-ink-soft italic mb-2">
        Type above to begin.
      </div>
      <p className="text-sm text-ink-faint max-w-sm mx-auto">
        Every query hits the live index of scraped listings across all enabled sites.
      </p>
    </div>
  );
}

function NoResults({ query }: { query: string }) {
  return (
    <div className="card p-12 text-center">
      <div className="font-serif text-xl italic text-ink-soft mb-2">
        Nothing found for &quot;{query}&quot;.
      </div>
      <p className="text-sm text-ink-faint">
        Try fewer or more generic words — the scraper only knows what it's indexed.
      </p>
    </div>
  );
}
