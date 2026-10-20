// Test for Job 6 stage 7 — the ACI tool-output envelope.
// Run: node backend/scripts/test-tool-output.mjs
//
// Proves: (1) empty / whitespace-only output becomes the explicit
// NO-SIGNAL marker (never a blank the model can misread as success),
// (2) short output passes through untouched, (3) long output is
// bounded head+tail with the elision note carrying true line/byte
// counts, (4) head and tail content survive verbatim.
import { summarizeToolOutput, EMPTY_OUTPUT_MARKER } from '../src/toolOutput.js';

let failures = 0;
function check(name, cond) {
  console.log(`${cond ? 'PASS' : 'FAIL'}  ${name}`);
  if (!cond) failures++;
}

const empty = summarizeToolOutput('');
check('empty string -> explicit marker', empty.text === EMPTY_OUTPUT_MARKER && empty.empty === true);
const blank = summarizeToolOutput('   \n  \n');
check('whitespace-only -> explicit marker', blank.text === EMPTY_OUTPUT_MARKER && blank.empty === true);
const nul = summarizeToolOutput(null);
check('null -> explicit marker', nul.text === EMPTY_OUTPUT_MARKER);

const short = summarizeToolOutput('hello world');
check('short output passes through untouched', short.text === 'hello world' && short.truncated === false && short.empty === false);

const longText = 'HEAD-LINE\n' + 'x'.repeat(10000) + '\nTAIL-LINE';
const long = summarizeToolOutput(longText);
check('long output is marked truncated', long.truncated === true);
check('elision note carries true counts', long.text.includes(`${long.lines} lines`) && long.text.includes(`${long.bytes} bytes`));
check('head survives verbatim', long.text.startsWith('HEAD-LINE'));
check('tail survives verbatim', long.text.endsWith('TAIL-LINE'));
check('envelope is bounded', long.text.length < 4000);

const custom = summarizeToolOutput(longText, { maxChars: 500, headChars: 100, tailChars: 50 });
check('custom budget honoured', custom.truncated === true && custom.text.length < 500);

console.log(failures === 0 ? '\nALL PASS' : `\n${failures} FAILURE(S)`);
process.exit(failures === 0 ? 0 : 1);
