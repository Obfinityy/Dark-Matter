import React from 'react';

const operatorNotice = (
  <p className="legal-operator">
    Operator identity and privacy contact: <strong>[Add the verified legal entity name, postal address, and contact email before publication.]</strong>
  </p>
);

function DraftNotice() {
  return (
    <aside className="legal-draft" aria-label="Draft legal notice">
      <span className="legal-draft-mark" aria-hidden="true">!</span>
      <div>
        <strong>Draft — qualified legal review required</strong>
        <p>This page is not an approved legal policy. Confirm the operator, deployed services, data practices, and applicable law before publishing.</p>
      </div>
    </aside>
  );
}

function PrivacyContent() {
  return (
    <>
      <section>
        <h2>Information the service handles</h2>
        <p>The application sends account credentials for sign-in or account creation to its backend. When you use chat or hunting features, the interface also sends the messages and hunt details you submit, such as a target and scope, and receives replies, hunt status, findings, and reports.</p>
        <p>Optional voice features use microphone access requested by your browser and send recorded audio for transcription; spoken replies use the configured speech service. If you connect a provider integration or submit a payment claim, the corresponding key or claim details are sent to the backend feature you selected.</p>
        <p>The browser stores certain interface preferences, including spoken-reply settings. The project does not establish a general retention period for backend records, so this draft makes no retention promise.</p>
      </section>
      <section>
        <h2>Where processing takes place</h2>
        <p>Dark Matter's frontend communicates with its hosted orchestration backend. The product is designed to run hunt execution on the user's own Linux machine through the local engine, rather than execute hunts on the hosted orchestration service. The actual deployment and any connected providers should be verified before this statement is published.</p>
        <p>The project documentation describes saved plugin credentials as encrypted on the backend using AES-256-GCM. This statement does not cover other data, deployment key management, or independent verification of a running installation.</p>
      </section>
      <section>
        <h2>Service providers and sharing</h2>
        <p>The product can connect to model and speech providers, and includes a payment-claim workflow. Which services receive information depends on the deployed configuration and the features you use. The operator must identify those services and explain their roles before publication; this draft does not claim that information is never shared with a provider.</p>
      </section>
      <section>
        <h2>Retention, access, and requests</h2>
        <p>Do not assume that closing a page deletes information already sent to a service. This project guide does not establish backend retention periods or a complete deletion workflow. The operator must confirm how long each category is kept, how deletion requests are handled, and which legal rights apply in the relevant locations.</p>
      </section>
      <section>
        <h2>Security and updates</h2>
        <p>Reasonable security measures do not make any internet service or local installation risk-free. Do not send secrets or personal information unless you understand how the relevant configured service handles it. The operator should update this notice when the deployed data flows change.</p>
      </section>
      <section>
        <h2>Contact</h2>
        {operatorNotice}
      </section>
    </>
  );
}

function TermsContent() {
  return (
    <>
      <section>
        <h2>Use only with permission</h2>
        <p>Use Dark Matter only for systems you own or for which you have explicit, current authorization to test. Before starting a hunt, identify the target, confirm your authority, and follow the applicable program scope, rules, and limits. Do not use the service to access systems or data without permission, disrupt services, or exceed the authorization you have.</p>
        <p>You are responsible for confirming that your use is lawful and permitted. An authorization confirmation in the interface does not create permission from a system owner.</p>
      </section>
      <section>
        <h2>AI output requires human review</h2>
        <p>Automated and AI-generated output can be incomplete, inaccurate, outdated, or mistaken. Findings may be false positives, and suggested steps may be unsafe or inappropriate for a particular target. Independently validate results, review reports, and make your own decisions before acting or disclosing a finding.</p>
        <p>Do not rely on Dark Matter as a substitute for professional security, legal, or incident-response advice. You remain responsible for actions taken using the service.</p>
      </section>
      <section>
        <h2>Accounts and access</h2>
        <p>Keep your account credentials confidential and use the service only through an account you are authorized to use. Account availability and permissions may depend on administrator decisions and the service configuration. Do not attempt to bypass access controls or use another person's credentials.</p>
      </section>
      <section>
        <h2>Third-party services and local engine</h2>
        <p>Dark Matter may connect to services configured by the operator or by you. Those services may have their own terms and privacy practices. Hunt execution is designed to run on the user's local machine through the engine; you are responsible for securing and operating that machine and its environment.</p>
      </section>
      <section>
        <h2>No warranty; limits of reliance</h2>
        <p>The service and its output are provided without a promise that they will be available, accurate, complete, secure, or suitable for a particular purpose. To the extent permitted by applicable law, the operator disclaims warranties and is not responsible for decisions or actions you take in reliance on automated output. This draft does not limit rights or remedies that cannot lawfully be limited.</p>
      </section>
      <section>
        <h2>Changes and legal review</h2>
        <p>Terms for the published service, any payment features, governing law, and legally required notices must be confirmed by the operator and qualified counsel. No governing-law or dispute-resolution term is supplied in this draft.</p>
      </section>
      <section>
        <h2>Contact</h2>
        {operatorNotice}
      </section>
    </>
  );
}

export default function LegalPage({ type = 'privacy', onNavigate }) {
  const isPrivacy = type === 'privacy';
  return (
    <div className="page legal-page">
      <article className="legal-document">
        <header className="legal-header">
          <div className="legal-eyebrow">Dark Matter · Legal</div>
          <h1>{isPrivacy ? 'Privacy Policy' : 'Terms of Service'}</h1>
          <p className="page-sub">
            {isPrivacy
              ? 'A plain-language draft describing the information flows visible in the current product.'
              : 'Draft terms for responsible, authorized use of Dark Matter.'}
          </p>
          <DraftNotice />
        </header>
        <div className="legal-copy">
          {isPrivacy ? <PrivacyContent /> : <TermsContent />}
        </div>
        <footer className="legal-page-footer">
          <button type="button" className="btn btn-ghost" onClick={() => onNavigate && onNavigate('chat')}>
            Back to Dark Matter
          </button>
          <div className="legal-switch">
            <button type="button" onClick={() => onNavigate && onNavigate(isPrivacy ? 'terms' : 'privacy')}>
              {isPrivacy ? 'Read the Terms of Service' : 'Read the Privacy Policy'}
            </button>
          </div>
        </footer>
      </article>
    </div>
  );
}
