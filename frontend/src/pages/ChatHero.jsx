// Empty-state hero — the "Where should we begin?" landing view, extracted
// from ChatPage.jsx (P6). Includes the SEO landing copy (9 Nov 2026):
// visible, natural keyword content for search engines — no hidden text,
// no stuffing.
import React from 'react';

export default function ChatHero({ onStartHunt, onOpenReports }) {
  return (
    <div className="dm-hero-scroll">
      <div className="dm-hero">
        <div className="dm-emblem">
          <img src="/dark-matter-symbol.png" alt="Dark Matter" width="72" height="72" className="hero-symbol" />
        </div>
        <h1 className="dm-wordmark">DARK MATTER</h1>
        <p className="dm-tagline">Autonomous AI bug bounty hunter — hack with AI to find and verify vulnerabilities before attackers do</p>
        <div className="dm-quick-actions">
          <button className="dm-action-card" onClick={onStartHunt}>
            <span className="dm-action-icon" aria-hidden="true">01</span>
            <span className="dm-action-title">Start a hunt</span>
            <span className="dm-action-sub">Point the hunter at a target</span>
          </button>
          <button className="dm-action-card" onClick={() => onOpenReports && onOpenReports()}>
            <span className="dm-action-icon" aria-hidden="true">02</span>
            <span className="dm-action-title">Reports</span>
            <span className="dm-action-sub">Findings & hunt history</span>
          </button>
          <button className="dm-action-card" onClick={() => document.querySelector('.chat-page .composer input, .chat-page .composer textarea')?.focus()}>
            <span className="dm-action-icon" aria-hidden="true">03</span>
            <span className="dm-action-title">Ask the AI</span>
            <span className="dm-action-sub">Strategy, recon, technique</span>
          </button>
        </div>
        {/* SEO landing copy (9 Nov 2026): visible, natural keyword
            content for search engines — no hidden text, no stuffing.
            The hero stays the ChatGPT-exact empty state; this section
            sits below the quick actions in the same scroll area. */}
        <section className="dm-seo" aria-label="About Dark Matter">
          <h2>Hack with AI — an autonomous AI vulnerability scanner</h2>
          <p>
            Dark Matter is an AI hacker built by Obfinity. Paste any link and the autonomous
            hacking AI fingerprints the target, inventories every element on the page, and
            probes each one with a full battery of checks — injection, cross-site scripting,
            broken authentication, business-logic flaws and more. Every finding is verified
            in a real browser before it reaches your screen, so what you see is real.
            Automated penetration testing, in minutes.
          </p>
          <div className="dm-seo-grid">
            <div className="dm-seo-item">
              <h3>AI security scanner</h3>
              <p>A predefined, rule-based scanner that runs the full A-to-Z battery on your target — no prompts, no guesswork.</p>
            </div>
            <div className="dm-seo-item">
              <h3>Autonomous hacking AI</h3>
              <p>The hunter drives the whole flow itself — recon, probing, verification and reporting — while you watch it live.</p>
            </div>
            <div className="dm-seo-item">
              <h3>Verified findings, not noise</h3>
              <p>Each vulnerability is confirmed with a control test before it is reported — false positives stay out of your report.</p>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
