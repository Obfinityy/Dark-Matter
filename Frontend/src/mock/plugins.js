export const basePlugins = [
  // Normal Tier (Free)
  { id: 't1', name: 'Nmap Basic', category: 'Reconnaissance', version: '7.93', description: 'Standard network mapping and port scanning.', status: 'Available', tier: 'Normal' },
  { id: 't2', name: 'Sublist3r', category: 'Reconnaissance', version: '1.0', description: 'Fast subdomains enumeration tool for penetration testers.', status: 'Available', tier: 'Normal' },
  { id: 't3', name: 'Amass', category: 'Reconnaissance', version: '3.21', description: 'In-depth attack surface mapping and asset discovery.', status: 'Available', tier: 'Normal' },
  { id: 't4', name: 'Masscan', category: 'Reconnaissance', version: '1.3.2', description: 'TCP port scanner, spews SYN packets asynchronously.', status: 'Available', tier: 'Normal' },
  { id: 't5', name: 'FFuf', category: 'Discovery', version: '2.0', description: 'Fast web fuzzer written in Go.', status: 'Available', tier: 'Normal' },
  { id: 't6', name: 'DirBuster', category: 'Discovery', version: '1.0', description: 'Multi threaded java application designed to brute force directories.', status: 'Available', tier: 'Normal' },
  { id: 't7', name: 'Nikto', category: 'Analysis', version: '2.1.6', description: 'Web server scanner which performs comprehensive tests.', status: 'Available', tier: 'Normal' },
  { id: 't8', name: 'WPScan', category: 'Analysis', version: '3.8', description: 'Black box WordPress vulnerability scanner.', status: 'Available', tier: 'Normal' },
  { id: 't9', name: 'WhatWeb', category: 'Reconnaissance', version: '0.5', description: 'Next generation web scanner to identify technologies.', status: 'Available', tier: 'Normal' },
  { id: 't10', name: 'Nuclei (Community)', category: 'Analysis', version: '3.0', description: 'Fast and customizable vulnerability scanner based on simple YAML based DSL.', status: 'Available', tier: 'Normal' },
  { id: 't11', name: 'SQLMap (Basic)', category: 'Validation', version: '1.7', description: 'Automatic SQL injection and database takeover tool.', status: 'Available', tier: 'Normal' },
  
  // Pro Tier ($20)
  { id: 'p1', name: 'Nuclei (Pro Templates)', category: 'Analysis', version: '3.0', description: 'Nuclei with access to premium, updated private templates.', status: 'Restricted', tier: 'Pro' },
  { id: 'p2', name: 'Burp Suite Pro (API)', category: 'Analysis', version: '2023.8', description: 'Integration with Burp Suite Professional\'s automated scanner.', status: 'Restricted', tier: 'Pro' },
  { id: 'p3', name: 'Acunetix (Integration)', category: 'Analysis', version: '15.0', description: 'End-to-end web security scanner API integration.', status: 'Restricted', tier: 'Pro' },
  { id: 'p4', name: 'Nessus Pro', category: 'Analysis', version: '10.5', description: 'Industry standard vulnerability scanner integration.', status: 'Restricted', tier: 'Pro' },
  { id: 'p5', name: 'Metasploit Auto-Pwn', category: 'Exploitation', version: '6.3', description: 'Automated exploitation of known vulnerabilities via Metasploit RPC.', status: 'Restricted', tier: 'Pro' },
  { id: 'p6', name: 'SQLMap (Advanced)', category: 'Validation', version: '1.7', description: 'SQLMap with WAF bypass payloads, tamper scripts, and os-shell access.', status: 'Restricted', tier: 'Pro' },
  { id: 'p7', name: 'XSStrike', category: 'Validation', version: '3.1', description: 'Advanced XSS detection and exploitation suite.', status: 'Restricted', tier: 'Pro' },
  { id: 'p8', name: 'Commix', category: 'Validation', version: '3.2', description: 'Automated command injection exploitation tool.', status: 'Restricted', tier: 'Pro' },
  { id: 'p9', name: 'Hydra Auto-Brute', category: 'Validation', version: '9.5', description: 'Parallelized network logon cracker with custom wordlists.', status: 'Restricted', tier: 'Pro' },
  { id: 'p10', name: 'Hashcat (Cloud GPU)', category: 'Validation', version: '6.2', description: 'Advanced password recovery utility using cloud GPU instances.', status: 'Restricted', tier: 'Pro' },
  { id: 'p11', name: 'Gopherus', category: 'Exploitation', version: '1.0', description: 'Generates gopher link for exploiting SSRF and gaining RCE.', status: 'Restricted', tier: 'Pro' },
  
  // Elite Tier ($99)
  { id: 'e1', name: 'Cobalt Strike (Beacon)', category: 'Exploitation', version: '4.8', description: 'Threat emulation software integration for advanced post-exploitation.', status: 'Restricted', tier: 'Elite' },
  { id: 'e2', name: 'BloodHound (Auto)', category: 'Analysis', version: '4.3', description: 'Automated Active Directory domain privilege escalation path mapping.', status: 'Restricted', tier: 'Elite' },
  { id: 'e3', name: 'CrackMapExec', category: 'Exploitation', version: '5.4', description: 'A swiss army knife for pentesting networks and AD environments.', status: 'Restricted', tier: 'Elite' },
  { id: 'e4', name: 'Impacket Suite', category: 'Exploitation', version: '0.10', description: 'Collection of Python classes for working with network protocols.', status: 'Restricted', tier: 'Elite' },
  { id: 'e5', name: 'Responder (Auto-Poison)', category: 'Exploitation', version: '3.1', description: 'LLMNR, NBT-NS and MDNS poisoner with built-in rogue servers.', status: 'Restricted', tier: 'Elite' },
  { id: 'e6', name: 'Core Impact (API)', category: 'Exploitation', version: '21.1', description: 'Automated penetration testing software integration.', status: 'Restricted', tier: 'Elite' },
  { id: 'e7', name: 'Canvas (Integration)', category: 'Exploitation', version: '7.0', description: 'Provides hundreds of exploits, an automated exploitation system.', status: 'Restricted', tier: 'Elite' },
  { id: 'e8', name: 'Mythic C2', category: 'Post-Exploitation', version: '3.0', description: 'Collaborative, multi-platform, cross-architecture Command and Control.', status: 'Restricted', tier: 'Elite' },
  { id: 'e9', name: 'Auto-Pivot Framework', category: 'Post-Exploitation', version: '2.0', description: 'AI-driven network pivoting and lateral movement orchestrator.', status: 'Restricted', tier: 'Elite' },

  // Infinity Tier ($499)
  { id: 'i1', name: 'Zero-Day Hunter AI', category: 'Exploitation', version: '1.0', description: 'Advanced ML models trained on binary analysis to discover and validate 0-days.', status: 'Restricted', tier: 'Infinity' },
  { id: 'i2', name: 'Unlimited Cloud Cracking', category: 'Validation', version: '1.0', description: 'Unrestricted access to a massive cluster of A100 GPUs for hash cracking.', status: 'Restricted', tier: 'Infinity' },
  { id: 'i3', name: 'ML WAF Evasion Engine', category: 'Evasion', version: '2.5', description: 'Generative AI payload mutator that continuously adapts to bypass modern WAFs.', status: 'Restricted', tier: 'Infinity' },
  { id: 'i4', name: 'Custom Exploit Generator', category: 'Exploitation', version: '1.0', description: 'Dynamically writes, compiles, and deploys custom exploit code based on target environment.', status: 'Restricted', tier: 'Infinity' },
  { id: 'i5', name: 'Hardware-in-Loop Fuzzer', category: 'Analysis', version: '1.0', description: 'Direct access to IoT/Hardware emulation environments for firmware fuzzing.', status: 'Restricted', tier: 'Infinity' },
  { id: 'i6', name: 'Global Botnet Simulation', category: 'Reconnaissance', version: '1.0', description: 'Distributed reconnaissance across 50,000+ IPs to avoid rate limiting and geo-blocking.', status: 'Restricted', tier: 'Infinity' }
];

// Dynamically generate up to 10,000 tools to demonstrate scale
const generateLargeDataset = () => {
  const generated = [...basePlugins];
  const tiers = ['Normal', 'Pro', 'Elite', 'Infinity'];
  const categories = ['Reconnaissance', 'Discovery', 'Analysis', 'Validation', 'Exploitation', 'Post-Exploitation', 'Evasion'];
  
  for (let i = generated.length; i < 10100; i++) {
    const tier = tiers[i % 4];
    const category = categories[i % categories.length];
    
    generated.push({
      id: `sim_tool_${i}`,
      name: `AI ${category} Module ${i}`,
      category: category,
      version: `${Math.floor(Math.random() * 5) + 1}.${Math.floor(Math.random() * 9)}`,
      description: `Autonomously generated ${category.toLowerCase()} module allocated for the ${tier} subscription tier.`,
      status: tier === 'Normal' ? 'Available' : 'Restricted',
      tier: tier
    });
  }
  return generated;
};

export const mockPlugins = generateLargeDataset();
