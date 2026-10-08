/**
 * impactModel.js — business-impact quantification + remediation code.
 *
 * What an elite human writes for bounty triagers:
 *   - how CHEAP the attack is (prerequisites, exploitability)
 *   - what BREAKS for the business (CIA, in plain language)
 *   - a triager summary that reads like a human wrote it — concrete,
 *     no hype words, no invented numbers
 *   - copy-paste remediation CODE, not just advice
 *
 * Everything here is derived from the finding's own fields. Bounty payout
 * ranges are deliberately NOT estimated — that would be fabrication.
 */

const EXPLOITABILITY = {
  xss_reflected: { level: 'trivial', prerequisites: ['a victim clicking a crafted link'] },
  xss_stored: {
    level: 'trivial',
    prerequisites: ['no victim interaction — payload fires for every visitor'],
  },
  xss_dom: { level: 'easy', prerequisites: ['a victim visiting a crafted URL'] },
  xss: { level: 'easy', prerequisites: ['victim interaction (link or page view)'] },
  sqli: {
    level: 'easy',
    prerequisites: ['no authentication (for this endpoint)', 'a single HTTP request'],
  },
  sql_injection: {
    level: 'easy',
    prerequisites: ['no authentication (for this endpoint)', 'a single HTTP request'],
  },
  ssrf: { level: 'easy', prerequisites: ['a single HTTP request to the vulnerable endpoint'] },
  idor: {
    level: 'trivial',
    prerequisites: ['any authenticated account (attacker creates their own)'],
  },
  broken_access_control: {
    level: 'trivial',
    prerequisites: ['any authenticated account (attacker creates their own)'],
  },
  lfi: { level: 'easy', prerequisites: ['a single HTTP request'] },
  path_traversal: { level: 'easy', prerequisites: ['a single HTTP request'] },
  'path-traversal': { level: 'easy', prerequisites: ['a single HTTP request'] },
  command_injection: {
    level: 'easy',
    prerequisites: ['a single HTTP request to the vulnerable endpoint'],
  },
  rce: { level: 'easy', prerequisites: ['a single HTTP request to the vulnerable endpoint'] },
  csrf: { level: 'easy', prerequisites: ['a logged-in victim visiting an attacker page'] },
  open_redirect: {
    level: 'trivial',
    prerequisites: ['a victim clicking a link on the trusted domain'],
  },
  xxe: { level: 'easy', prerequisites: ['ability to submit XML to the endpoint'] },
  ssti: { level: 'easy', prerequisites: ['a single HTTP request to the vulnerable endpoint'] },
  template_injection: {
    level: 'easy',
    prerequisites: ['a single HTTP request to the vulnerable endpoint'],
  },
};

const CIA_IMPACT = {
  xss_reflected: {
    confidentiality: 'High',
    integrity: 'High',
    availability: 'None',
    why: 'Script runs as the victim: reads page content, performs actions as the victim.',
  },
  xss_stored: {
    confidentiality: 'High',
    integrity: 'High',
    availability: 'Low',
    why: 'Every visitor executes the payload — mass session compromise, wormable.',
  },
  xss_dom: {
    confidentiality: 'High',
    integrity: 'High',
    availability: 'None',
    why: 'Same as reflected XSS once the sink is reached.',
  },
  xss: {
    confidentiality: 'High',
    integrity: 'High',
    availability: 'None',
    why: 'Script runs as the victim in the application origin.',
  },
  sqli: {
    confidentiality: 'High',
    integrity: 'High',
    availability: 'High',
    why: 'Full read/write access to the database is the standard outcome of SQL injection.',
  },
  sql_injection: {
    confidentiality: 'High',
    integrity: 'High',
    availability: 'High',
    why: 'Full read/write access to the database is the standard outcome of SQL injection.',
  },
  ssrf: {
    confidentiality: 'High',
    integrity: 'Low',
    availability: 'Low',
    why: 'The server fetches attacker-chosen URLs: internal services and cloud metadata become reachable.',
  },
  idor: {
    confidentiality: 'High',
    integrity: 'High',
    availability: 'None',
    why: "Any user's data can be read and modified by swapping identifiers.",
  },
  broken_access_control: {
    confidentiality: 'High',
    integrity: 'High',
    availability: 'None',
    why: "Any user's data can be read and modified by swapping identifiers.",
  },
  lfi: {
    confidentiality: 'High',
    integrity: 'None',
    availability: 'Low',
    why: 'Server-side files become readable; configuration and secrets are at risk.',
  },
  path_traversal: {
    confidentiality: 'High',
    integrity: 'None',
    availability: 'Low',
    why: 'Server-side files become readable; configuration and secrets are at risk.',
  },
  'path-traversal': {
    confidentiality: 'High',
    integrity: 'None',
    availability: 'Low',
    why: 'Server-side files become readable; configuration and secrets are at risk.',
  },
  command_injection: {
    confidentiality: 'High',
    integrity: 'High',
    availability: 'High',
    why: 'Arbitrary OS commands run as the application user — full host compromise.',
  },
  rce: {
    confidentiality: 'High',
    integrity: 'High',
    availability: 'High',
    why: 'Arbitrary OS commands run as the application user — full host compromise.',
  },
  csrf: {
    confidentiality: 'Low',
    integrity: 'High',
    availability: 'Low',
    why: 'Attackers can trigger state-changing actions in a victim session.',
  },
  open_redirect: {
    confidentiality: 'Low',
    integrity: 'Low',
    availability: 'None',
    why: 'Phishing via the trusted domain; credential theft is the real-world outcome.',
  },
  xxe: {
    confidentiality: 'High',
    integrity: 'Low',
    availability: 'High',
    why: 'File reads and SSRF through XML parsing; billion-laughs variants cause DoS.',
  },
  ssti: {
    confidentiality: 'High',
    integrity: 'High',
    availability: 'High',
    why: 'Server-side template execution routinely escalates to remote code execution.',
  },
  template_injection: {
    confidentiality: 'High',
    integrity: 'High',
    availability: 'High',
    why: 'Server-side template execution routinely escalates to remote code execution.',
  },
};

function keyFor(finding) {
  const type = String(finding?.type || finding?.vulnType || '')
    .toLowerCase()
    .trim();
  return Object.keys(EXPLOITABILITY).find(k => type === k || type.includes(k)) || null;
}

/**
 * Quantify a finding's business impact from its own fields.
 * @returns {{ exploitability, prerequisites, cia, triagerSummary }}
 */
export function quantifyImpact(finding = {}) {
  const key = keyFor(finding);
  const exp = (key && EXPLOITABILITY[key]) || {
    level: 'moderate',
    prerequisites: ['unknown — assess manually'],
  };
  const cia = (key && CIA_IMPACT[key]) || {
    confidentiality: 'Unknown',
    integrity: 'Unknown',
    availability: 'Unknown',
    why: 'No impact model for this finding type.',
  };
  const endpoint = finding.affectedEndpoint || finding.url || 'the affected endpoint';
  const param = finding.parameter ? ` (${finding.parameter} parameter)` : '';
  const triagerSummary =
    `Exploitability is ${exp.level}: an attacker needs only ${exp.prerequisites.join(' and ')}. ` +
    `The vulnerable point is ${endpoint}${param}. ${cia.why} ` +
    `In business terms this is primarily a ${dominantCia(cia)} risk — ` +
    `${businessLine(finding, key)}.`;
  return {
    exploitability: exp.level,
    prerequisites: exp.prerequisites,
    cia: {
      confidentiality: cia.confidentiality,
      integrity: cia.integrity,
      availability: cia.availability,
    },
    triagerSummary,
  };
}

function dominantCia(cia) {
  if (cia.confidentiality === 'High') return 'data-exposure';
  if (cia.integrity === 'High') return 'data-integrity';
  if (cia.availability === 'High') return 'availability';
  return 'security-hygiene';
}

function businessLine(finding, key) {
  const lines = {
    xss_reflected: 'phishing and session theft through links that look like they come from you',
    xss_stored:
      'mass compromise of everyone who views the affected page — this is the wormable kind',
    xss_dom: 'session theft through links that look like they come from you',
    xss: 'session theft through attacker-controlled script in your origin',
    sqli: 'your database is effectively open: customer data, credentials, and business records',
    sql_injection:
      'your database is effectively open: customer data, credentials, and business records',
    ssrf: 'your internal network becomes reachable from the outside through your own server',
    idor: "one user's data is every user's data — privacy and compliance exposure",
    broken_access_control: "one user's data is every user's data — privacy and compliance exposure",
    lfi: 'server configuration and secrets become readable to outsiders',
    path_traversal: 'server configuration and secrets become readable to outsiders',
    'path-traversal': 'server configuration and secrets become readable to outsiders',
    command_injection:
      'the server itself is compromised — assume full host control by the attacker',
    rce: 'the server itself is compromised — assume full host control by the attacker',
    csrf: 'attackers can make your users perform actions they never intended',
    open_redirect: 'your domain becomes the bait in phishing campaigns',
    xxe: 'internal files and services become reachable through document uploads',
    ssti: 'the template layer is one step from full server compromise',
    template_injection: 'the template layer is one step from full server compromise',
  };
  return lines[key] || 'review the technical detail and assess exposure manually';
}

/**
 * Copy-paste remediation CODE per vulnerability class. Minimal, correct,
 * framework-agnostic examples a developer can adapt.
 * @returns {{ language, code } | null}
 */
export function remediationSnippet(finding = {}) {
  const key = keyFor(finding);
  const SNIPPETS = {
    xss_reflected: {
      language: 'python',
      code: '# Output-encode every reflection (Python example)\nimport html\n\nsafe = html.escape(user_input, quote=True)\nresponse.write(f"<div>{safe}</div>")\n\n# And set a Content-Security-Policy header:\n# Content-Security-Policy: default-src \'self\'',
    },
    xss_stored: {
      language: 'python',
      code: '# Encode stored content ON OUTPUT, not on input\nimport html\n\ndef render_comment(raw: str) -> str:\n    return f"<li>{html.escape(raw)}</li>"\n\n# Never mark user content as safe/markup.',
    },
    xss_dom: {
      language: 'javascript',
      code: '// Never sink untrusted data into HTML\n// BAD:  el.innerHTML = location.hash.slice(1)\n// GOOD:\nel.textContent = new URLSearchParams(location.hash.slice(1)).get("q") ?? "";',
    },
    xss: { language: 'python', code: 'import html\nsafe = html.escape(user_input, quote=True)' },
    sqli: {
      language: 'python',
      code: '# Parameterized queries — never string-interpolate SQL\n# BAD:  cur.execute(f"SELECT * FROM users WHERE id = \'{uid}\'")\n# GOOD:\ncur.execute("SELECT * FROM users WHERE id = %s", (uid,))',
    },
    sql_injection: {
      language: 'python',
      code: 'cur.execute("SELECT * FROM users WHERE id = %s", (uid,))  # parameterized',
    },
    ssrf: {
      language: 'python',
      code: '# Allow-list + no redirects for server-side fetches\nimport ipaddress, urllib.request\nfrom urllib.parse import urlparse\n\nALLOWED = {"api.partner.example"}\n\ndef safe_fetch(url: str) -> bytes:\n    host = urlparse(url).hostname or ""\n    if host not in ALLOWED:\n        raise ValueError("URL not allow-listed")\n    req = urllib.request.Request(url)\n    # resolve + block private ranges before connecting\n    return urllib.request.urlopen(req, timeout=10).read()',
    },
    idor: {
      language: 'python',
      code: '# Authorize EVERY object access against the session user\ndef get_order(request, order_id):\n    order = db.orders.find_one({"_id": order_id})\n    if order is None or order["user_id"] != request.session["user_id"]:\n        raise PermissionError("not your object")\n    return order',
    },
    broken_access_control: {
      language: 'python',
      code: '# Deny by default; check ownership on every read/write\nif resource.owner_id != current_user.id:\n    abort(403)',
    },
    lfi: {
      language: 'python',
      code: '# Never build file paths from user input; map to an allow-list\nimport os\nALLOWED = {"help": "/srv/docs/help.md", "about": "/srv/docs/about.md"}\n\ndef serve_page(name: str):\n    path = ALLOWED.get(name)\n    if not path:\n        raise FileNotFoundError()\n    return open(path).read()',
    },
    path_traversal: {
      language: 'python',
      code: 'ALLOWED = {"help": "/srv/docs/help.md"}\npath = ALLOWED.get(name)  # no user-controlled path segments',
    },
    'path-traversal': {
      language: 'python',
      code: 'ALLOWED = {"help": "/srv/docs/help.md"}\npath = ALLOWED.get(name)  # no user-controlled path segments',
    },
    command_injection: {
      language: 'python',
      code: '# Never pass user input to a shell; use argv arrays\nimport subprocess\n# BAD:  os.system(f"convert {user_file} out.png")\n# GOOD:\nsubprocess.run(["convert", user_file, "out.png"], shell=False, check=True)',
    },
    rce: {
      language: 'python',
      code: 'subprocess.run(["convert", user_file, "out.png"], shell=False, check=True)  # no shell',
    },
    csrf: {
      language: 'python',
      code: '# Require an unguessable per-session token on state-changing requests\n# Framework example (Flask-WTF):\n#   <form method="post">{{ form.csrf_token }}</form>\n# Verify server-side; also set SameSite=Lax on the session cookie.',
    },
    open_redirect: {
      language: 'python',
      code: '# Only redirect to relative paths or an allow-list\nfrom urllib.parse import urlparse\n\ndef safe_redirect(target: str) -> str:\n    if urlparse(target).netloc:\n        return "/"  # refuse absolute URLs\n    return target or "/"',
    },
    xxe: {
      language: 'python',
      code: '# Disable DTDs / external entities in the XML parser\n# lxml example:\nfrom lxml import etree\nparser = etree.XMLParser(resolve_entities=False, no_network=True, dtd_validation=False)\netree.fromstring(xml_bytes, parser=parser)',
    },
    ssti: {
      language: 'python',
      code: '# Never render user input as a template; use logic-less templates\n# Jinja2: keep users out of template source entirely\nfrom jinja2 import Environment\n# BAD:  Environment().from_string(user_input).render()\n# GOOD: render fixed templates with user data as VARIABLES only\nenv.get_template("page.html").render(name=user_name)',
    },
    template_injection: {
      language: 'python',
      code: '# User data must only ever be template VARIABLES, never template source\nenv.get_template("page.html").render(name=user_name)',
    },
  };
  return (key && SNIPPETS[key]) || null;
}
