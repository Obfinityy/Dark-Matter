/**
 * Infinity AI — Wave 48 (ideas 51896–51920): voice control components.
 * Purely presentational, export-only (not mounted anywhere). Data flows from
 * voiceCore pure functions over sample transcripts — no mic, no TTS side
 * effects; spoken text goes through the existing Infinity Voice layer.
 *
 * Part of: Infinity AI / Dark-Matter frontend (hunt operations).
 */
import {
  parsePauseResume,
  statusAnswer,
  parseSteering,
  spokenApproval,
  parseTestCommand,
  findingBriefing,
  parseStrategyChange,
  etaAnswer,
  detectLanguage,
  pushToTalkSession,
  wakeWordConfig,
  isWakeWord,
  logVoiceCommand,
  searchCommandHistory,
  confirmationPrompt,
  resolveVoiceShortcut,
  registerVoiceShortcut,
  feedbackTone,
  errorRecovery,
  voiceHelpList,
  voiceHelpText,
  parseMultiHuntSwitch,
  parseSnapshotRequest,
  parseExplanationRequest,
  dictateNote,
  voiceChatTurn,
  interruptionSignal,
  duckingPolicy,
  verifyVoiceProfile,
  enrollVoiceProfile,
} from './voiceCore.js';

const SAMPLE_HUNT = {
  id: 'h1',
  name: 'API hunt',
  status: 'running',
  findings: [
    { severity: 'critical', title: 'SQLi in search' },
    { severity: 'critical', title: 'Auth bypass' },
    { severity: 'high', title: 'Verbose errors' },
  ],
  etaMs: Date.now() + 3600000,
};
const SAMPLE_HUNTS = [
  SAMPLE_HUNT,
  { id: 'h2', name: 'Web hunt', client: 'acme', status: 'running' },
];

const Card = ({ title, children }) => (
  <div className="vc48-card">
    <div className="vc48-card-title">{title}</div>
    <div className="vc48-card-body">{children}</div>
  </div>
);
const Row = ({ k, v }) => (
  <div className="vc48-row">
    <span className="vc48-k">{k}</span>
    <span className="vc48-v">{v}</span>
  </div>
);

// 51896
export const VoicePauseResume = () => {
  const a = parsePauseResume('pause the hunt');
  const b = parsePauseResume('resume everything');
  return (
    <Card title="Voice pause / resume">
      <Row k='"pause the hunt"' v={`${a.action} · ${a.scope}`} />
      <Row k='"resume everything"' v={`${b.action} · ${b.scope}`} />
    </Card>
  );
};
// 51897
export const VoiceStatus = () => (
  <Card title='Voice status: "what are you doing?"'>
    <div className="vc48-say">{statusAnswer(SAMPLE_HUNT)}</div>
  </Card>
);
// 51898
export const VoiceSteering = () => {
  const r = parseSteering('focus on the API now');
  return (
    <Card title='Voice steering: "focus on the API now"'>
      <Row k="Focus" v={r.ok ? r.focus : r.error} />
    </Card>
  );
};
// 51899
export const SpokenApprovals = () => {
  const r = spokenApproval('approve', { enrolled: true, speakerId: 's1', matchedSpeakerId: 's1' });
  return (
    <Card title="Spoken approval decisions">
      <Row k='"approve" (verified voice)' v={`${r.decision} · authorized: ${r.authorized}`} />
    </Card>
  );
};
// 51900
export const DictatedTests = () => {
  const r = parseTestCommand('try SQLi on the login form');
  return (
    <Card title='Dictated test: "try SQLi on the login form"'>
      <Row k="Technique" v={r.ok ? `${r.technique} (${r.techniqueId})` : r.error} />
      <Row k="Target" v={r.ok ? r.target : ''} />
    </Card>
  );
};
// 51901
export const VoiceBriefings = () => (
  <Card title='Voice briefing: "read me the new criticals"'>
    <div className="vc48-say">{findingBriefing(SAMPLE_HUNT.findings)}</div>
  </Card>
);
// 51902
export const VoiceStrategy = () => {
  const r = parseStrategyChange('switch to depth mode');
  return (
    <Card title='Voice strategy: "switch to depth mode"'>
      <Row k="Strategy" v={r.ok ? r.strategy : r.error} />
    </Card>
  );
};
// 51903
export const VoiceEta = () => (
  <Card title='Voice ETA: "how much longer?"'>
    <div className="vc48-say">{etaAnswer(SAMPLE_HUNT)}</div>
  </Card>
);
// 51904
export const VoiceLanguage = () => (
  <Card title="Voice language choice">
    <Row k='"hunt ko rok do"' v={detectLanguage('hunt ko rok do')} />
    <Row k='"hunt को रोको"' v={detectLanguage('hunt को रोको')} />
    <Row k='"pause the hunt"' v={detectLanguage('pause the hunt')} />
  </Card>
);
// 51905
export const PushToTalk = () => {
  const s = pushToTalkSession({ key: 'Space' });
  return (
    <Card title="Push-to-talk control">
      <Row k="Key" v={s.key} />
      <Row k="Mode" v={s.mode} />
    </Card>
  );
};
// 51906
export const AlwaysListening = () => {
  const c = wakeWordConfig(['hey infinity']);
  return (
    <Card title="Always-listening mode">
      <Row k="Wake words" v={c.wakeWords.join(', ')} />
      <Row
        k='"hey infinity, pause"'
        v={isWakeWord('hey infinity, pause the hunt', c) ? 'wake detected' : 'not detected'}
      />
    </Card>
  );
};
// 51907
export const CommandHistory = () => {
  let h = logVoiceCommand([], { transcript: 'pause the hunt', intent: 'pause', result: 'ok' });
  h = logVoiceCommand(h, { transcript: 'hunt ko tez karo', intent: 'steer', result: 'ok' });
  const hits = searchCommandHistory(h, 'pause');
  return (
    <Card title="Voice command history">
      <Row k="Logged" v={h.length} />
      <Row k="Languages" v={h.map(e => e.language).join(', ')} />
      <Row k='Search "pause"' v={hits.length} />
    </Card>
  );
};
// 51908
export const VoiceConfirmation = () => {
  const c = confirmationPrompt('pause all hunts');
  const safe = confirmationPrompt('read me the criticals');
  return (
    <Card title="Voice confirmation">
      <Row k="Risky" v={c.needsConfirmation ? c.text : 'no confirmation'} />
      <Row k="Safe" v={safe.needsConfirmation ? 'needs confirmation' : 'no confirmation needed'} />
    </Card>
  );
};
// 51909
export const VoiceShortcutList = () => {
  let s = registerVoiceShortcut([], 'start my morning sweep', [
    'resume all hunts',
    'read me the new criticals',
  ]);
  const r = resolveVoiceShortcut('start my morning sweep', s);
  return (
    <Card title="Voice shortcuts">
      <Row k="Phrase" v={r.ok ? r.phrase : r.error} />
      <Row k="Commands" v={r.ok ? r.commands.join(' → ') : ''} />
    </Card>
  );
};
// 51910
export const FeedbackTones = () => (
  <Card title="Voice feedback tones">
    <Row k="Accepted" v={JSON.stringify(feedbackTone('accepted'))} />
    <Row k="Rejected" v={JSON.stringify(feedbackTone('rejected'))} />
  </Card>
);
// 51911
export const ErrorRecovery = () => {
  const r = errorRecovery('paws the hunt', [
    'pause the hunt',
    'resume the hunt',
    'what are you doing?',
  ]);
  return (
    <Card title="Voice error recovery">
      <div className="vc48-say">{r.text}</div>
    </Card>
  );
};
// 51912
export const VoiceHelp = () => (
  <Card title='Voice help: "what can I say?"'>
    <Row k="Commands" v={voiceHelpList().length} />
    <div className="vc48-say">{voiceHelpText()}</div>
  </Card>
);
// 51913
export const VoiceMultiHuntSwitch = () => {
  const r = parseMultiHuntSwitch('switch to the client acme hunt', SAMPLE_HUNTS);
  return (
    <Card title='Voice multi-hunt: "switch to the client acme hunt"'>
      <Row k="Resolved" v={r.ok ? r.huntId : r.error} />
    </Card>
  );
};
// 51914
export const VoiceSnapshots = () => {
  const r = parseSnapshotRequest('take a report snapshot');
  return (
    <Card title='Voice snapshots: "take a report snapshot"'>
      <Row k="Snapshot" v={r.ok ? r.snapshot.kind : r.error} />
    </Card>
  );
};
// 51915
export const VoiceExplanations = () => {
  const r = parseExplanationRequest('explain that SQLi simply', SAMPLE_HUNT.findings);
  return (
    <Card title='Voice explanations: "explain that SQLi simply"'>
      <Row k="Finding" v={r.ok ? r.findingId : 'not found'} />
      <Row k="Level" v={r.level} />
    </Card>
  );
};
// 51916
export const VoiceNotes = () => {
  const n = dictateNote('login form looks interesting, try harder here', 'h1');
  return (
    <Card title="Voice note dictation">
      <Row k="Note" v={n.ok ? n.note.text : n.error} />
    </Card>
  );
};
// 51917
export const VoiceChatMode = () => {
  const t = voiceChatTurn('hello', { hunt: SAMPLE_HUNT });
  return (
    <Card title="Voice chat mode">
      <div className="vc48-say">{t.reply}</div>
    </Card>
  );
};
// 51918
export const VoiceInterruption = () => {
  const r = interruptionSignal({ type: 'barge-in' });
  return (
    <Card title="Voice interruption (barge-in)">
      <Row k="Interrupted" v={String(r.interrupted)} />
      <Row k="Action" v={r.action || '—'} />
    </Card>
  );
};
// 51919
export const VolumeDucking = () => {
  const d = duckingPolicy(true);
  return (
    <Card title="Voice volume ducking">
      <Row k="Alert volume" v={d.alertVolume} />
      <Row k="Reason" v={d.reason} />
    </Card>
  );
};
// 51920
export const VoiceProfiles = () => {
  let p = enrollVoiceProfile([], { speakerId: 's1', name: 'Bhavesh', allowSensitive: true });
  const v = verifyVoiceProfile({ speakerId: 's1' }, p);
  const stranger = verifyVoiceProfile({ speakerId: 's9' }, p);
  return (
    <Card title="Voice profiles">
      <Row
        k="Bhavesh"
        v={v.recognized ? `recognized · sensitive: ${v.sensitiveCommandsAllowed}` : 'unknown'}
      />
      <Row k="Stranger" v={stranger.recognized ? 'recognized' : 'not recognized'} />
    </Card>
  );
};

export const VoiceSuiteGallery = () => (
  <div className="vc48-gallery">
    <VoicePauseResume />
    <VoiceStatus />
    <VoiceSteering />
    <SpokenApprovals />
    <DictatedTests />
    <VoiceBriefings />
    <VoiceStrategy />
    <VoiceEta />
    <VoiceLanguage />
    <PushToTalk />
    <AlwaysListening />
    <CommandHistory />
    <VoiceConfirmation />
    <VoiceShortcutList />
    <FeedbackTones />
    <ErrorRecovery />
    <VoiceHelp />
    <VoiceMultiHuntSwitch />
    <VoiceSnapshots />
    <VoiceExplanations />
    <VoiceNotes />
    <VoiceChatMode />
    <VoiceInterruption />
    <VolumeDucking />
    <VoiceProfiles />
  </div>
);
