/**
 * hydraVocabMiner.js — Hydra vocabulary parser for API operation mapping.
 *
 * Hydra (hydra-cg.com) is a JSON-LD vocabulary for hypermedia-driven Web APIs.
 * Its ApiDocumentation resources declare supported classes, the operations each
 * class supports (HTTP method, expects/returns types) and the properties a
 * client may read or write. Parsing that vocabulary reconstructs the full
 * advertised operation surface of an API without issuing a single request.
 *
 * Pure text/structure analysis: the caller supplies the fetched ApiDocumentation
 * document (JSON string or already-parsed object). Defensive use: authorized
 * asset/API-surface discovery for bug-bounty review coverage.
 */

const CONTEXT_URL_RE = /hydra\/core/i;

/**
 * Try to detect whether a document looks like a Hydra ApiDocumentation.
 *
 * @param {any} doc
 * @returns {boolean}
 */
export function looksLikeHydra(doc) {
  if (!doc || typeof doc !== 'object') return false;
  const context = JSON.stringify(doc['@context'] ?? '');
  const type = JSON.stringify(doc['@type'] ?? '');
  const hasHydraContext = CONTEXT_URL_RE.test(context);
  const hasSupportedClass = type.includes('ApiDocumentation') || Array.isArray(doc.supportedClass);
  return hasHydraContext || hasSupportedClass;
}

/**
 * Normalize the supportedClass list regardless of how the context shortens keys.
 *
 * @param {object} doc
 * @returns {object[]}
 */
export function extractSupportedClasses(doc) {
  if (!doc || typeof doc !== 'object') return [];
  const classes = doc.supportedClass ?? doc['hydra:supportedClass'] ?? [];
  return Array.isArray(classes) ? classes : [classes];
}

/**
 * Parse one supported class into a structured operation mapping.
 *
 * @param {object} cls
 * @returns {{ id: string|null, title: string|null, operations: object[], properties: object[] }}
 */
export function parseSupportedClass(cls = {}) {
  const ops = cls.supportedOperation ?? cls['hydra:supportedOperation'] ?? [];
  const props = cls.supportedProperty ?? cls['hydra:supportedProperty'] ?? [];
  const opList = (Array.isArray(ops) ? ops : [ops]).filter(o => o && typeof o === 'object');
  const propList = (Array.isArray(props) ? props : [props]).filter(p => p && typeof p === 'object');

  const operations = opList.map(op => ({
    id: op['@id'] ?? null,
    title: op.title ?? null,
    method: op.method ?? op['hydra:method'] ?? null,
    expects: typeof op.expects === 'object' ? (op.expects['@id'] ?? null) : (op.expects ?? null),
    returns: typeof op.returns === 'object' ? (op.returns['@id'] ?? null) : (op.returns ?? null),
    possibleStatus: op.possibleStatus ?? op['hydra:possibleStatus'] ?? [],
  }));

  const properties = propList.map(prop => {
    const inner = prop.property ?? {};
    return {
      id: prop['@id'] ?? null,
      title: prop.title ?? null,
      property: typeof inner === 'object' ? (inner['@id'] ?? null) : (inner ?? null),
      readable: prop.readable ?? prop['hydra:readable'] ?? null,
      writable: prop.writable ?? prop['hydra:writable'] ?? null,
      required: prop.required ?? prop['hydra:required'] ?? null,
    };
  });

  return {
    id: cls['@id'] ?? null,
    title: cls.title ?? null,
    operations,
    properties,
  };
}

/**
 * Build the entrypoint → class operation mapping for a whole ApiDocumentation.
 *
 * @param {object} doc
 * @returns {Array<{ classId: string|null, title: string|null, operations: object[] }>}
 */
export function mapApiOperations(doc = {}) {
  return extractSupportedClasses(doc).map(parseSupportedClass);
}

/**
 * Collect every distinct HTTP method declared across all classes.
 *
 * @param {object} doc
 * @returns {string[]}
 */
export function listDeclaredMethods(doc = {}) {
  const methods = new Set();
  for (const cls of mapApiOperations(doc)) {
    for (const op of cls.operations) {
      if (op.method) methods.add(String(op.method).toUpperCase());
    }
  }
  return [...methods].sort();
}

/**
 * Full analysis of a fetched Hydra ApiDocumentation document.
 *
 * @param {{ url?: string, document: string|object }} input
 * @returns {{ type: string, confidence: string, classes: object[], methods: string[], operationCount: number, evidence: string }}
 */
export function analyzeHydraVocab({ url = '', document = null } = {}) {
  let doc = document;
  if (typeof document === 'string') {
    try {
      doc = JSON.parse(document);
    } catch {
      return {
        type: 'Hydra Vocabulary Operation Mapping',
        confidence: 'low',
        classes: [],
        methods: [],
        operationCount: 0,
        evidence: `Document${url ? ` at ${url}` : ''} is not valid JSON; no Hydra vocabulary could be parsed.`,
      };
    }
  }

  const classes = mapApiOperations(doc);
  const methods = listDeclaredMethods(doc);
  const operationCount = classes.reduce((n, c) => n + c.operations.length, 0);
  const isHydra = looksLikeHydra(doc);

  return {
    type: 'Hydra Vocabulary Operation Mapping',
    confidence: isHydra && classes.length ? 'high' : classes.length ? 'medium' : 'low',
    classes: classes.map(c => ({
      classId: c.id,
      title: c.title,
      operations: c.operations,
      properties: c.properties,
    })),
    methods,
    operationCount,
    evidence: isHydra
      ? `Hydra ApiDocumentation${url ? ` at ${url}` : ''} declares ${classes.length} supported class(es) with ${operationCount} operation(s) across methods [${methods.join(', ') || 'none'}].`
      : `Document${url ? ` at ${url}` : ''} does not look like a Hydra ApiDocumentation.`,
  };
}

export const HYDRA_VOCAB_MINER = {
  looksLikeHydra,
  extractSupportedClasses,
  parseSupportedClass,
  mapApiOperations,
  listDeclaredMethods,
  analyzeHydraVocab,
};
export default HYDRA_VOCAB_MINER;
