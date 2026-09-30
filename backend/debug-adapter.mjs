import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { MemoryDatabase } from './src/models/database.js';
import { EventService } from './src/services/eventService.js';
import { ComputerState } from './src/computer/computerState.js';
import { ComputerEvents } from './src/computer/computerEvents.js';
import { OpenInterfaceAdapter } from './src/computer/openInterfaceAdapter.js';
import { ComputerTaskModel } from './src/models/computerTaskModel.js';
import { InfiniteChatModel } from './src/models/infiniteChatModel.js';
import { ComputerTaskWorker } from './src/jobs/computerTaskWorker.js';
import { ComputerTaskManager } from './src/services/computerTaskManager.js';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'dm-debug-'));
const bridgeFile = path.join(TMP, 'bridge.cjs');
fs.writeFileSync(bridgeFile, `
const readline = require('readline');
const capabilities = { bridge: 'x', platform: 'TestOS', pythonVersion: '3', pyautoguiAvailable: true, pyautoguiError: null, screen: {width:1920,height:1080}, actions: [], neverCallsLlm: true, shellAccess: false };
if (process.argv.includes('--probe')) { process.stdout.write(JSON.stringify({type:'capabilities',ok:true,result:capabilities})+'\\n'); process.exit(0); }
process.stdout.write(JSON.stringify({type:'ready',ok:true,result:capabilities})+'\\n');
readline.createInterface({input:process.stdin}).on('line',(line)=>{
  const r = JSON.parse(line);
  if (r.cmd==='__shutdown__'){process.exit(0);}
  const out = r.cmd==='get_active_window' ? {supported:true,title:'Untitled - Notepad'} : (r.cmd==='open_application'?{launched:r.params.name}:{done:true});
  process.stdout.write(JSON.stringify({id:r.id,ok:true,command:r.cmd,output:out,durationMs:1})+'\\n');
});
`);

const taskModel = new ComputerTaskModel(new MemoryDatabase());
const eventService = new EventService(new MemoryDatabase());
const computerState = new ComputerState();
const computerEvents = new ComputerEvents({ eventService, state: computerState });
const computer = new OpenInterfaceAdapter({
  config: {
    enabled: true, pythonBin: process.execPath, bridgePath: bridgeFile,
    spawnArgs: [], verifyArgs: ['-e', "console.log('python-ok ' + process.version)"],
    actionTimeoutMs: 5000, probeTimeoutMs: 5000, requireApproval: false
  },
  state: computerState,
  events: computerEvents
});

const result1 = await computer.execute({ type: 'open_application', params: { name: 'notepad' } }, { approvalGranted: true });
console.log('direct execute #1:', JSON.stringify({ ok: result1.ok, error: result1.error, obs: result1.observation?.summary }));
const result2 = await computer.execute({ type: 'get_active_window' }, { approvalGranted: true });
console.log('direct execute #2:', JSON.stringify({ ok: result2.ok, error: result2.error, obs: result2.observation?.summary }));
console.log('inputSimulation:', computer.inputSimulation, 'state:', computerState.snapshot().state);
computer.stop();
console.log('DONE');
