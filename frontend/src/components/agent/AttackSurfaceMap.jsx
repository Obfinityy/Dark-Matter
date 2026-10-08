/**
 * AttackSurfaceMap — the live map of what the agent has discovered.
 *
 * Five panels: subdomains, endpoints, parameters, technologies, open ports.
 * Each panel lists what the agent found, with counts. Updates as the hunt
 * progresses (parent re-fetches on job events).
 *
 * Props: { surface, loading } — surface from GET /jobs/:id/attack-surface
 */
import React from 'react';
import { Globe, Link2, SlidersHorizontal, Cpu, Plug } from 'lucide-react';

function Panel({ icon: Icon, title, items, renderItem, emptyHint }) {
  const list = Array.isArray(items) ? items : [];
  return (
    <section className="dm-surface-panel" aria-label={`${title} — ${list.length} found`}>
      <header>
        <span className="dm-surface-icon" aria-hidden="true">
          <Icon size={15} />
        </span>
        <h4>{title}</h4>
        <span className="dm-surface-count" title={`${list.length} found`}>
          {list.length}
        </span>
      </header>
      {list.length === 0 ? (
        <p className="dm-surface-empty" role="status">
          {emptyHint}
        </p>
      ) : (
        <ul className="dm-surface-list">
          {list.slice(0, 12).map((item, i) => (
            <li
              key={
                typeof item === 'string'
                  ? item
                  : item?.id || item?.path || item?.url || item?.name || i
              }
              tabIndex={0}
              title={typeof item === 'string' ? item : undefined}
            >
              {renderItem ? renderItem(item) : String(item)}
            </li>
          ))}
          {list.length > 12 && (
            <li className="dm-surface-more" aria-label={`${list.length - 12} more items`}>
              +{list.length - 12} more
            </li>
          )}
        </ul>
      )}
    </section>
  );
}

export function AttackSurfaceMap({ surface = {}, loading = false }) {
  if (loading)
    return (
      <div className="dm-surface-loading" role="status">
        Mapping the attack surface…
      </div>
    );

  const updatedAt = surface.updatedAt ? new Date(surface.updatedAt) : null;
  const updatedLabel =
    updatedAt && !Number.isNaN(updatedAt.getTime()) ? updatedAt.toLocaleTimeString() : null;

  return (
    <div className="dm-surface-map">
      <Panel
        icon={Globe}
        title="Subdomains"
        items={surface.subdomains}
        emptyHint="No subdomains enumerated yet."
      />
      <Panel
        icon={Link2}
        title="Endpoints"
        items={surface.endpoints}
        renderItem={e => (typeof e === 'string' ? e : e.path || e.url || JSON.stringify(e))}
        emptyHint="No endpoints discovered yet."
      />
      <Panel
        icon={SlidersHorizontal}
        title="Parameters"
        items={surface.parameters}
        renderItem={p => (typeof p === 'string' ? p : p.name || JSON.stringify(p))}
        emptyHint="No parameters fingerprinted yet."
      />
      <Panel
        icon={Cpu}
        title="Technologies"
        items={surface.technologies}
        emptyHint="Technology fingerprinting pending."
      />
      <Panel
        icon={Plug}
        title="Open ports"
        items={surface.openPorts}
        emptyHint="Port scan hasn't reported yet."
      />
      {updatedLabel && <p className="dm-surface-updated">Last updated {updatedLabel}</p>}
    </div>
  );
}
