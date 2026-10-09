/**
 * PayloadLibraryPanel — the Payload Library browser inside the Hunt AI view.
 *
 * A curated, read-only collection of payload shapes across 22 vulnerability
 * classes (XSS, SQLi, SSRF, SSTI, XXE, …) for testing the user's OWN
 * authorized targets. Category dropdown, full-text search, copy-to-clipboard,
 * paged loading. No payload is ever fired from here — the panel only shows
 * and copies text.
 *
 * Branding: "Payload Library" only. No upstream project names anywhere.
 * Motion: zero decorative animation — only a functional loading indicator.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import { Copy, Check, Search, Library } from 'lucide-react';
import {
  getPayloadLibraryCategories,
  getPayloadLibraryCategory,
  searchPayloadLibrary,
} from '../../services/api.js';
import './PayloadLibraryPanel.css';

const PAGE_SIZE = 40;

export function PayloadLibraryPanel() {
  const [categories, setCategories] = useState([]);
  const [activeCategory, setActiveCategory] = useState('');
  const [query, setQuery] = useState('');
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [offset, setOffset] = useState(0);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [copiedId, setCopiedId] = useState('');
  const [totalPayloads, setTotalPayloads] = useState(0);
  const searchTimer = useRef(null);

  // Load categories once.
  useEffect(() => {
    let cancelled = false;
    getPayloadLibraryCategories()
      .then(data => {
        if (cancelled) return;
        const cats = data.categories || [];
        setCategories(cats);
        setTotalPayloads(cats.reduce((n, c) => n + (c.count || 0), 0));
        if (cats.length && !activeCategory) setActiveCategory(cats[0].slug);
      })
      .catch(() => {
        if (!cancelled) setError('Payload Library is unavailable. Make sure the backend is running.');
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadItems = useCallback(async ({ category, q, append = false, from = 0 }) => {
    if (append) setLoadingMore(true);
    else setLoading(true);
    setError('');
    try {
      let payloads;
      let count;
      if (q.trim()) {
        const data = await searchPayloadLibrary(q.trim(), 200);
        payloads = (data.results || []).map(r => ({ ...r, id: `${r.category}:${r.id}` }));
        count = data.total || payloads.length;
      } else {
        const data = await getPayloadLibraryCategory(category, { limit: PAGE_SIZE, offset: from });
        payloads = data.payloads || [];
        count = data.total || 0;
      }
      setItems(prev => (append ? [...prev, ...payloads] : payloads));
      setTotal(count);
      setOffset(from + payloads.length);
    } catch {
      setError('Could not load payloads. Check the backend connection and try again.');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, []);

  // Reload when the category changes.
  useEffect(() => {
    if (!activeCategory) return;
    loadItems({ category: activeCategory, q: '' });
  }, [activeCategory, loadItems]);

  // Debounced search.
  const onQueryChange = value => {
    setQuery(value);
    if (searchTimer.current) clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      if (!value.trim()) {
        loadItems({ category: activeCategory, q: '' });
      } else {
        loadItems({ category: activeCategory, q: value });
      }
    }, 350);
  };

  const copyPayload = async item => {
    try {
      await navigator.clipboard.writeText(item.payload);
    } catch {
      // Clipboard API unavailable (non-secure context) — fall back silently.
      const ta = document.createElement('textarea');
      ta.value = item.payload;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand('copy');
      ta.remove();
    }
    setCopiedId(item.id);
    setTimeout(() => setCopiedId(current => (current === item.id ? '' : current)), 1200);
  };

  const activeName = categories.find(c => c.slug === activeCategory)?.name || activeCategory;
  const showingSearch = query.trim().length > 0;

  return (
    <div className="pl-panel">
      <div className="pl-header">
        <div className="pl-title">
          <Library size={16} aria-hidden="true" />
          <h3>Payload Library</h3>
        </div>
        <p className="pl-scope">
          {totalPayloads.toLocaleString()} curated payloads · for your authorized targets only
        </p>
      </div>

      <div className="pl-controls">
        <label className="pl-search">
          <Search size={14} aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={e => onQueryChange(e.target.value)}
            placeholder="Search payloads…"
            aria-label="Search payloads"
          />
        </label>
        <label className="pl-category">
          <span className="pl-category-label">Category</span>
          <select
            value={activeCategory}
            onChange={e => setActiveCategory(e.target.value)}
            disabled={showingSearch}
            aria-label="Payload category"
          >
            {categories.map(c => (
              <option key={c.slug} value={c.slug}>
                {c.name} ({c.count})
              </option>
            ))}
          </select>
        </label>
      </div>

      <p className="pl-count" role="status">
        {loading
          ? 'Loading…'
          : showingSearch
            ? `${total} result${total === 1 ? '' : 's'} for “${query.trim()}”`
            : `${total} payloads in ${activeName}`}
      </p>

      {error && (
        <p className="pl-error" role="alert">
          {error}
        </p>
      )}

      <ul className="pl-list">
        {items.map(item => (
          <li key={item.id} className="pl-item">
            <div className="pl-item-main">
              <code className="pl-payload">{item.payload}</code>
              <span className="pl-context">{item.context || item.title}</span>
            </div>
            <button
              type="button"
              className="sg-btn sg-btn-sm pl-copy"
              onClick={() => copyPayload(item)}
              aria-label={copiedId === item.id ? 'Copied' : `Copy payload ${item.id}`}
              title="Copy payload"
            >
              {copiedId === item.id ? <Check size={13} /> : <Copy size={13} />}
              {copiedId === item.id ? 'Copied' : 'Copy'}
            </button>
          </li>
        ))}
      </ul>

      {!loading && !showingSearch && offset < total && (
        <button
          type="button"
          className="sg-btn pl-more"
          onClick={() => loadItems({ category: activeCategory, q: '', append: true, from: offset })}
          disabled={loadingMore}
        >
          {loadingMore ? 'Loading…' : `Show more (${total - offset} remaining)`}
        </button>
      )}

      {!loading && items.length === 0 && !error && (
        <p className="pl-empty">No payloads found. Try a different search or category.</p>
      )}
    </div>
  );
}
