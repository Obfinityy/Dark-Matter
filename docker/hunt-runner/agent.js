// Dark Matter hunt-container agent loop (runs INSIDE the hunt container).
// Uses AWS Bedrock directly (creds from env) — no local model needed.
// Emits JSON event lines on stdout.

const HUNT_ID = process.env.DM_HUNT_ID || 'unknown';
const TARGET = process.env.DM_TARGET || '';
const MODE = process.env.DM_MODE || 'normal';

const emit = (obj) => console.log(JSON.stringify({ huntId: HUNT_ID, ...obj }));

async function main() {
  if (!process.env.AWS_ACCESS_KEY_ID) {
    emit({ type: 'thinking', text: 'No AWS credentials in container — running recon-only mode.' });
    return;
  }

  // Lazy-load AWS SDK (optional dep inside the container)
  let BedrockRuntimeClient, ConverseCommand;
  try {
    ({ BedrockRuntimeClient, ConverseCommand } = await import('@aws-sdk/client-bedrock-runtime'));
  } catch {
    emit({ type: 'thinking', text: 'AWS SDK not bundled — recon-only mode.' });
    return;
  }

  const client = new BedrockRuntimeClient({
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
    },
  });
  const model = process.env.BEDROCK_MODEL || 'anthropic.claude-3-5-sonnet-20241022-v2:0';

  const phases = [
    'Enumerate the attack surface: list likely endpoints, parameters, and technologies for the target.',
    'Prioritize the top 5 vulnerability classes to test based on the target profile.',
    'For each class, describe the exact test to run and what a positive looks like.',
  ];

  for (const instruction of phases) {
    emit({ type: 'thinking', text: `Agent planning: ${instruction.slice(0, 80)}...` });
    try {
      const cmd = new ConverseCommand({
        modelId: model,
        system: [{ text: `You are an elite bug-bounty hunter. Target: ${TARGET}. Mode: ${MODE}. Authorized test only, non-destructive. Be specific and actionable.` }],
        messages: [{ role: 'user', content: [{ text: instruction }] }],
        inferenceConfig: { maxTokens: 1200, temperature: 0.5 },
      });
      const out = await client.send(cmd);
      const blocks = (out.output?.message?.content) || [];
      const text = blocks.map((b) => b.text || '').join('\n').slice(0, 2000);
      emit({ type: 'thinking', text });
    } catch (err) {
      emit({ type: 'thinking', text: `Agent call failed: ${err.message || err}` });
      break;
    }
  }
  emit({ type: 'status', state: 'agent_loop_done' });
}

main().catch((err) => {
  emit({ type: 'status', state: 'failed', error: String(err.message || err) });
  process.exit(1);
});
