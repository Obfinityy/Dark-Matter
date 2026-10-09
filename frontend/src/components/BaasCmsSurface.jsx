import { useMemo, useState } from 'react';
import { harvestBaasConfigs } from '../../backend/src/engines/baasConfigRecon.js';
import { mapCmsConfigs } from '../../backend/src/engines/cmsConfigRecon.js';
import './BaasCmsSurface.css';

const SAMPLE = `// Sample client bundle excerpt (the target's own publicly served JS)
import { initializeApp } from 'firebase/app';
const firebaseConfig = {
  apiKey: "AIzaSyDx8fK2mQpLxVnT3wY4zU5aB6cD7eF8g",
  authDomain: "my-shop-12345.firebaseapp.com",
  projectId: "my-shop-12345",
  storageBucket: "my-shop-12345.appspot.com",
  messagingSenderId: "987654321012"
};
initializeApp(firebaseConfig);

import PocketBase from 'pocketbase';
const pb = new PocketBase('https://pb.example-corp.com');
const articles = await pb.collection('articles').getFullList();

import { createClient } from 'contentful';
const ctf = createClient({ space: 'a1b2c3d4e5f6', accessToken: 'delivery', host: 'cdn.contentful.com' });

const HYGRAPH_EP = 'https://api-eu-west-2.hygraph.com/v2/clxyz1234567890abcd/master';
fetch(process.env.STRAPI_API_URL + '/api/articles?populate=*');`;

const PROVIDER_LABELS = {
  firebase: '981 · Firebase',
  amplify: '982 · Amplify',
  appwrite: '983 · Appwrite',
  pocketbase: '984 · PocketBase',
  directus: '985 · Directus',
  strapi: '986 · Strapi',
  contentful: '987 · Contentful',
  sanity: '988 · Sanity',
  storyblok: '989 · Storyblok',
  hygraph: '990 · Hygraph',
};

function ProviderSection({ provider, items }) {
  return (
    <div className="w981c-section">
      <h3 className="w981c-section-title">{PROVIDER_LABELS[provider] || provider}</h3>
      {items.length === 0 ? (
        <p className="w981c-empty">No config references detected.</p>
      ) : (
        <ul className="w981c-list">
          {items.map((f, i) => (
            <li key={i} className="w981c-item">
              <span className="w981c-badge">{f.kind}</span>
              <span className="w981c-val">{f.value}</span>
              <span className="w981c-line">line {f.line}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export default function BaasCmsSurface() {
  const [input, setInput] = useState(SAMPLE);

  const results = useMemo(() => {
    let baas = { firebase: [], amplify: [], appwrite: [], pocketbase: [], directus: [], total: 0 };
    let cms = { strapi: [], contentful: [], sanity: [], storyblok: [], hygraph: [], total: 0 };
    try {
      baas = harvestBaasConfigs(input);
      cms = mapCmsConfigs(input);
    } catch {
      // keep empty results on malformed input
    }
    return { baas, cms };
  }, [input]);

  const providers = [
    ['firebase', results.baas.firebase],
    ['amplify', results.baas.amplify],
    ['appwrite', results.baas.appwrite],
    ['pocketbase', results.baas.pocketbase],
    ['directus', results.baas.directus],
    ['strapi', results.cms.strapi],
    ['contentful', results.cms.contentful],
    ['sanity', results.cms.sanity],
    ['storyblok', results.cms.storyblok],
    ['hygraph', results.cms.hygraph],
  ];

  const total = results.baas.total + results.cms.total;

  return (
    <div className="w981c-root">
      <div className="w981c-head">
        <h2 className="w981c-title">BaaS &amp; CMS Config Surface</h2>
        <p className="w981c-sub">
          Paste the target&apos;s own publicly served client JS to harvest Backend-as-a-Service and
          headless-CMS config references — project IDs, endpoint URLs, dataset names and SDK usage
          markers (ideas 981–990). Passive static analysis only; values are config hints, never
          treated as secrets.
        </p>
      </div>
      <textarea
        className="w981c-input"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        rows={12}
        spellCheck={false}
        placeholder="Paste client JS bundle text here…"
      />
      <p className="w981c-total">{total} config reference{total === 1 ? '' : 's'} detected</p>
      <div className="w981c-grid">
        {providers.map(([provider, items]) => (
          <ProviderSection key={provider} provider={provider} items={items} />
        ))}
      </div>
    </div>
  );
}
