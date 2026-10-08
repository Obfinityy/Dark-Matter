/* Infinity AI Runner — status window logic. No terminal output, ever. */
const $ = (id) => document.getElementById(id);

const STATE_LABEL = {
  running: 'Running',
  restarting: 'Restarting…',
  stopped: 'Stopped',
  crashed: 'Error',
  'waiting-signin': 'Waiting for sign-in',
};

function setDot(id, state) {
  const el = $(id);
  el.className = 'dot ' + (state === 'running' ? 'green' : state === 'stopped' || state === 'waiting-signin' ? '' : state === 'crashed' ? 'red' : 'amber');
}

function render(s) {
  $('version').textContent = 'v' + (s.version || '?');

  setDot('dot-runner', s.runner);
  $('txt-runner').textContent = STATE_LABEL[s.runner] || s.runner;

  const vmUp = s.vm && s.vm.up;
  setDot('dot-vm', vmUp ? 'running' : s.runner === 'running' ? 'amber' : 'stopped');
  $('txt-vm').textContent = vmUp
    ? `Ready${s.vm.qemu && s.vm.qemu.accel ? ' · ' + s.vm.qemu.accel : ''}`
    : s.runner === 'running' ? 'Starting…' : 'Not running';

  setDot('dot-poller', s.poller);
  $('txt-poller').textContent = STATE_LABEL[s.poller] || s.poller;

  const running = s.runner === 'running' || s.runner === 'restarting';
  $('btn-toggle').textContent = running ? 'Stop' : 'Start';
  $('btn-toggle').disabled = s.runner === 'restarting';

  const hint = $('status-hint');
  if (s.runner === 'crashed') {
    hint.textContent = 'The runner hit an error. Press Start to try again — details are in the logs.';
  } else if (s.poller === 'waiting-signin') {
    hint.textContent = 'Sign in below to enable the 24/7 hunt agent. The Kali sandbox works without sign-in.';
  } else if (s.poller === 'crashed') {
    hint.textContent = 'Hunt agent stopped unexpectedly. Sign out and back in, or press Start.';
  } else {
    hint.textContent = running
      ? 'Everything is running. You can close this window — the runner stays in the system tray.'
      : 'The runner is stopped. Press Start, or use the tray icon.';
  }

  if (s.account && s.account.email) {
    $('account-signed').classList.remove('hidden');
    $('account-form').classList.add('hidden');
    $('account-email').textContent = s.account.email;
  } else {
    $('account-signed').classList.add('hidden');
    $('account-form').classList.remove('hidden');
  }

  $('chk-autostart').checked = s.autoStart !== false;
}

async function refresh() {
  try { render(await window.runner.getStatus()); } catch { /* tray still works */ }
}

$('btn-toggle').addEventListener('click', async () => {
  const s = await window.runner.getStatus();
  const running = s.runner === 'running' || s.runner === 'restarting';
  render(await (running ? window.runner.stop() : window.runner.start()));
});
$('btn-open').addEventListener('click', () => window.runner.openApp());
$('btn-logs').addEventListener('click', () => window.runner.openLogs());
$('btn-signout').addEventListener('click', async () => render(await window.runner.signOut()));
$('chk-autostart').addEventListener('change', (e) => window.runner.setAutoStart(e.target.checked));

$('account-form').addEventListener('submit', async (e) => {
  e.preventDefault();
  const err = $('signin-error');
  err.classList.add('hidden');
  $('btn-signin').disabled = true;
  try {
    render({ ...(await window.runner.getStatus()), account: await window.runner.signIn($('in-email').value, $('in-pass').value) });
    $('in-pass').value = '';
  } catch (ex) {
    err.textContent = ex.message || 'Sign-in failed.';
    err.classList.remove('hidden');
  } finally {
    $('btn-signin').disabled = false;
    refresh();
  }
});

window.runner.onStatus(render);
refresh();
setInterval(refresh, 8000);

/* ── first-time setup ─────────────────────────────────────────────── */
const STEP_LABEL = { qemu: 'QEMU virtualization', whpx: 'Hardware acceleration', kali: 'Kali Linux image' };

async function refreshSetup() {
  let r;
  try { r = await window.runner.getReadiness(); } catch { return; }
  if (!r || r.error || !Array.isArray(r.steps) || r.steps.length === 0) return;
  const missing = r.steps.filter((s) => s.status !== 'ready');
  $('setup-card').style.display = missing.length ? '' : 'none';
  if (!missing.length) return;

  $('setup-steps').innerHTML = r.steps.map((s) => {
    const dot = s.status === 'ready' ? 'green' : s.status === 'action-needed' ? 'amber' : 'red';
    const txt = s.status === 'ready' ? 'Ready' : s.status === 'action-needed' ? 'Action needed' : 'Missing';
    return `<div class="row"><span class="dot ${dot}"></span><span>${STEP_LABEL[s.id] || s.id}</span><b>${s.detail || txt}</b></div>`;
  }).join('');

  $('btn-setup-qemu').classList.toggle('hidden', !r.qemuMissing);
  $('btn-setup-whpx').classList.toggle('hidden', !r.whpxMissing);
  $('btn-setup-kali').classList.toggle('hidden', !r.kaliMissing);
}

function setupBusy(busy, detail) {
  for (const id of ['btn-setup-qemu', 'btn-setup-whpx', 'btn-setup-kali']) $(id).disabled = busy;
  $('setup-error').classList.add('hidden');
  if (detail !== undefined) {
    $('setup-progress').classList.remove('hidden');
    $('setup-detail').textContent = detail;
  }
}

window.runner.onSetupProgress((p) => {
  $('setup-progress').classList.remove('hidden');
  if (typeof p.percent === 'number') $('setup-bar').style.width = p.percent + '%';
  if (p.detail) $('setup-detail').textContent = p.detail;
});

$('btn-setup-qemu').addEventListener('click', async () => {
  setupBusy(true, 'Installing QEMU…');
  try {
    const r = await window.runner.setupQemu();
    if (!r.ok) throw new Error(r.reason || 'QEMU setup failed.');
  } catch (ex) {
    const e = $('setup-error');
    e.textContent = ex.message || 'QEMU setup failed.';
    e.classList.remove('hidden');
  } finally {
    setupBusy(false);
    refreshSetup();
  }
});

$('btn-setup-kali').addEventListener('click', async () => {
  if (!confirm('Download the Kali Linux image (~3 GB, one-time)?')) return;
  setupBusy(true, 'Starting download…');
  $('setup-bar').style.width = '0%';
  try {
    await window.runner.setupKali();
  } catch (ex) {
    const e = $('setup-error');
    e.textContent = ex.message || 'Kali download failed.';
    e.classList.remove('hidden');
  } finally {
    setupBusy(false);
    refreshSetup();
  }
});

$('btn-setup-whpx').addEventListener('click', async () => {
  setupBusy(true, 'Enabling acceleration (Windows may ask for permission)…');
  try {
    await window.runner.enableWhpx();
    $('setup-detail').textContent = 'Enabled — please restart Windows, then reopen the Runner.';
  } catch (ex) {
    const e = $('setup-error');
    e.textContent = 'Could not enable it automatically. Turn on "Windows Hypervisor Platform" in Windows Features manually.';
    e.classList.remove('hidden');
  } finally {
    setupBusy(false);
    refreshSetup();
  }
});

refreshSetup();
setInterval(refreshSetup, 15000);
