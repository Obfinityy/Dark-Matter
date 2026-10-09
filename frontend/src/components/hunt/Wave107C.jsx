import React, { useMemo, useState } from 'react';
import {
  WAVE107_C_IDEAS,
  findingHistoryFactor,
  changeVelocityFactor,
  authComplexityFactor,
  apiRichnessFactor,
  thirdPartyRiskFactor,
  certificateHygieneFactor,
  securityHeaderFactor,
  subdomainSprawlFactor,
  cloudFootprintFactor,
  explainScoreBreakdown,
} from './wave107CCores.js';

/**
 * Wave107C — Target Risk Scoring Factors (ideas 54261–54270).
 *
 * Demonstrates Infinity AI's per-target risk factors: nine factor calculators
 * feeding the score breakdown explainer, so every target score shows exactly
 * which factors contributed how many points and why.
 */

const SAMPLE_PROFILE = {
  history: { validFindings: 6, totalFindings: 9, pastHunts: 3 },
  velocity: { deploysPerWeek: 8, newEndpoints: 12, diffLines: 3200 },
  auth: { roles: 4, ssoProviders: 2, oauthClients: 3, mfaModes: 2 },
  api: { graphqlOps: 25, restEndpoints: 120, undocumentedEndpoints: 18 },
  thirdParty: { scripts: 14, integrations: 6, adTrackers: 4 },
  cert: { chainValid: true, daysToExpiry: 45, issuerReputation: 0.95 },
  headers: { 'Content-Security-Policy': "default-src 'self'", 'Strict-Transport-Security': 'max-age=31536000' },
  sprawl: { total: 120, unmanaged: 22, dangling: 3 },
  cloud: { buckets: 8, functions: 15, publicIps: 40, misconfigs: 2 },
};

const REASONS = {
  findingHistory: 'Proven productive ground: past valid findings on this target.',
  changeVelocity: 'Fast churn ships fresh bugs every deploy.',
  authComplexity: 'Multi-role + SSO + OAuth surface hides logic flaws.',
  apiRichness: 'Broad GraphQL/REST surface with undocumented endpoints.',
  thirdPartyRisk: 'Heavy third-party script and integration sprawl.',
  certificateHygiene: 'Chain validity, expiry window, and issuer reputation.',
  securityHeader: 'Missing or misconfigured protective headers.',
  subdomainSprawl: 'Unmanaged-looking subdomains raise takeover risk.',
  cloudFootprint: 'Broad cloud asset exposure, misconfiguration likely.',
};

const FACTOR_FNS = {
  findingHistory: findingHistoryFactor,
  changeVelocity: changeVelocityFactor,
  authComplexity: authComplexityFactor,
  apiRichness: apiRichnessFactor,
  thirdPartyRisk: thirdPartyRiskFactor,
  certificateHygiene: certificateHygieneFactor,
  securityHeader: securityHeaderFactor,
  subdomainSprawl: subdomainSprawlFactor,
  cloudFootprint: cloudFootprintFactor,
};

const INPUT_KEYS = {
  history: ['history'],
  velocity: ['velocity'],
  auth: ['auth'],
  api: ['api'],
  thirdParty: ['thirdParty'],
  cert: ['cert'],
  headers: ['headers'],
  sprawl: ['sprawl'],
  cloud: ['cloud'],
};

export default function Wave107C() {
  const [profile] = useState(SAMPLE_PROFILE);
  const [highlight, setHighlight] = useState('findingHistory');

  const breakdown = useMemo(() => {
    const factors = {};
    for (const [key, fn] of Object.entries(FACTOR_FNS)) {
      const input = {};
      for (const k of INPUT_KEYS[key]) input[k] = profile[k];
      // Each factor takes its own slice; pass through the matching sub-object.
      const sliceKey = INPUT_KEYS[key][0];
      factors[key] = { points: fn(profile[sliceKey]), reason: REASONS[key] };
    }
    return explainScoreBreakdown(factors);
  }, [profile]);

  const maxPoints = Math.max(1, ...breakdown.parts.map(p => p.points));

  return (
    <div style={{ padding: 24, maxWidth: 960, fontFamily: 'inherit', color: 'inherit' }}>
      <h2 style={{ margin: '0 0 4px' }}>Target Risk Scoring Factors</h2>
      <p style={{ margin: '0 0 20px', opacity: 0.75 }}>
        Infinity AI scores each target across nine factors, then explains every point of the final score.
      </p>

      <div style={{ display: 'flex', gap: 16, alignItems: 'center', marginBottom: 20 }}>
        <div
          style={{
            width: 120,
            height: 120,
            borderRadius: '50%',
            border: '6px solid rgba(255, 215, 0, 0.25)',
            borderTopColor: '#FFD700',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexDirection: 'column',
          }}
          title="Total target risk score"
        >
          <span style={{ fontSize: 28, fontWeight: 700 }}>{breakdown.total}</span>
          <span style={{ fontSize: 11, opacity: 0.7 }}>/ 90</span>
        </div>
        <div>
          <div style={{ fontWeight: 600 }}>Overall target score</div>
          <div style={{ opacity: 0.7, fontSize: 13 }}>
            {breakdown.parts.length} factors contributing, summed and clamped to a single priority number.
          </div>
        </div>
      </div>

      <div style={{ display: 'grid', gap: 10 }}>
        {breakdown.parts.map(part => {
          const key = Object.keys(FACTOR_FNS).find(
            k => REASONS[k] === part.reason || part.factor.includes('factor')
          );
          return (
            <button
              key={part.factor}
              onClick={() => setHighlight(part.factor)}
              style={{
                textAlign: 'left',
                cursor: 'pointer',
                background: highlight === part.factor ? 'rgba(255, 215, 0, 0.08)' : 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.12)',
                borderRadius: 10,
                padding: '10px 14px',
                color: 'inherit',
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <strong style={{ fontSize: 14 }}>{part.factor}</strong>
                <span style={{ fontSize: 14, fontWeight: 700, color: '#FFD700' }}>
                  +{part.points} pts
                </span>
              </div>
              <div
                style={{
                  height: 8,
                  borderRadius: 4,
                  background: 'rgba(255,255,255,0.08)',
                  overflow: 'hidden',
                  marginBottom: 6,
                }}
              >
                <div
                  style={{
                    width: `${(part.points / maxPoints) * 100}%`,
                    height: '100%',
                    background: 'linear-gradient(90deg, #b8860b, #FFD700)',
                    borderRadius: 4,
                  }}
                />
              </div>
              <div style={{ fontSize: 12, opacity: 0.7 }}>{part.reason}</div>
            </button>
          );
        })}
      </div>

      <div style={{ marginTop: 24, fontSize: 12, opacity: 0.6 }}>
        Factors: {WAVE107_C_IDEAS.slice(0, 9).map(i => i.id).join(' · ')} — Explainer: {WAVE107_C_IDEAS[9].id}
      </div>
    </div>
  );
}
