// Dark Matter rule-based scanner — IDOR probe (v1).
// Flags sequential numeric object references as a review surface.
// A true cross-user differential needs two authenticated sessions; without
// them the item stays UNCONFIRMED by design and is never reported as a
// finding. Pure function of the URL — no network.
export function probeIdorSurface(url) {
  const m = /\/(\d{3,})(\/|$|\?)/.exec(String(url));
  if (!m) return [];
  return [
    {
      class: 'idor',
      id: `idor-surface-${m[1]}`,
      title: `Sequential object ID in URL — IDOR review surface: ${url}`,
      severity: 'info',
      url,
      evidence: {
        request: `GET ${url}`,
        response: 'numeric object reference detected in the URL path',
        impact_demo: 'needs a second session for the cross-user differential — not auto-confirmed',
      },
    },
  ];
}
