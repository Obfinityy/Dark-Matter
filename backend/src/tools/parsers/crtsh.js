/**
 * crt.sh output parser — extracts subdomains from Certificate Transparency logs.
 * Refactored from the old subdomainService into the parser pipeline.
 */

function unique(values) {
  return [...new Set(values.map(v => v.trim().toLowerCase()).filter(Boolean))].sort();
}

function inScope(name, hostname) {
  return name === hostname || name.endsWith(`.${hostname}`);
}

export function parseCrtsh(rawOutput, context = {}) {
  try {
    const records = typeof rawOutput === 'string' ? JSON.parse(rawOutput) : rawOutput;
    if (!Array.isArray(records)) return { subdomains: [], raw: records };

    const hostname = context.hostname || '';
    const names = records.flatMap(record => [
      record.common_name,
      ...String(record.name_value || '').split('\n'),
    ]);

    const subdomains = unique(
      names.map(name =>
        String(name || '')
          .replace(/^\*\./, '')
          .replace(/\.$/, '')
      )
    ).filter(name => (hostname ? inScope(name, hostname) && name !== hostname : Boolean(name)));

    return {
      subdomains,
      totalCerts: records.length,
      uniqueSubdomains: subdomains.length,
    };
  } catch (error) {
    return { subdomains: [], error: error.message };
  }
}
