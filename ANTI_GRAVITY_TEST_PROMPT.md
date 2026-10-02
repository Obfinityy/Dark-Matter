# Dark-Matter Infinity AI Control Mode — Full E2E Test Prompt

Copy everything below the line and paste it into Anti Gravity.
─────────────────────────────────────────────

You are testing **Dark-Matter**, an AI agent app. Your job is to test the
**Infinity AI → Control mode** (computer control) end-to-end on THIS machine,
like a real user would, and produce a detailed bug report at the end.

## Context

- Dark-Matter repo is cloned at: [USER: paste your local path, e.g. C:\Users\you\Dark-Matter]
- Backend runs on http://localhost:4000 (start with `npm start` in backend/)
- Frontend runs on http://localhost:5173 (start with `npm run dev` in frontend/)
- The app has 2 tabs: **Hunt** (bug bounty) and **Infinity AI** (with 4 modes: Chat, Plan, Build, Control)
- **Control mode** lets the user type natural-language instructions and the AI
  controls the real desktop: opens apps, clicks, types, navigates the browser.
- The AI brain is a vision model (Qwen2.5-VL) connected via Kaggle Gradio link,
  configured in the Models page. Grounding (finding buttons on screen) uses a
  local UI-TARS model downloaded from Models → Plugins.

## Prerequisites (do these first)

1. `git pull` the latest main branch.
2. Start backend: `cd backend && npm start` — wait until it says listening on 4000.
3. Start frontend: `cd frontend && npm run dev` — wait until it says listening on 5173.
4. Open http://localhost:5173 in the browser. Sign up or log in.
5. Go to **Models** page. Check:
   - Does the model library list load? How many models?
   - Is "UI-TARS 1.5 7B (Grounding)" visible? What does its Download button do?
   - Is "Qwen2.5-VL 7B" visible under vision models?
6. Go to **Settings** → check the brain/Kaggle link status. Is a vision brain connected?
   If not, note it — Control tests need the brain.

## Test 1: Simple — Open Edge and go to LeetCode

1. Go to **Infinity AI → Control** tab.
2. Type: `open Microsoft Edge and go to leetcode.com`
3. Press send. Now OBSERVE for up to 3 minutes:
   - Does the status change (thinking → acting)?
   - Does Microsoft Edge actually open on the desktop?
   - Does it navigate to leetcode.com?
   - Does the activity feed show what the AI is thinking/doing?
4. Record: PASS/FAIL + exactly what happened at each step.

## Test 2: App control — Open Notepad and type

1. In Control mode, type: `open Notepad and type "Hello from Dark Matter"`
2. Observe up to 2 minutes:
   - Does Notepad open?
   - Is the text typed correctly?
3. Record: PASS/FAIL + details.

## Test 3: Multi-step — Search YouTube

1. Type: `open Edge, go to youtube.com, and search for "lofi music"`
2. Observe up to 3 minutes:
   - Does it complete ALL three steps?
   - If it gets stuck, where exactly?
3. Record: PASS/FAIL + details.

## Test 4: Stop button

1. Start any task (e.g. Test 1 again).
2. While it's running, press the **Stop** button.
3. Does the agent actually stop? Does the UI reflect the stopped state?
4. Record: PASS/FAIL.

## Test 5: Brain thinking visibility

1. During any task, check the activity/thinking feed.
2. Can you see WHAT the AI is thinking (not just "working...")?
3. Does it show screenshots or descriptions of what it sees?
4. Record what the feed shows.

## What NOT to test

- Do NOT test Hunt mode (separate feature).
- Do NOT test Chat/Plan/Build modes (separate).
- Do NOT click anything outside the browser + the target apps.

## Final report format

At the end, produce this EXACT structure:

```
# Control Mode Test Report
Date: <today>
Machine: <OS + RAM + GPU>

## Prerequisites
- Backend started: YES/NO (any errors?)
- Frontend started: YES/NO
- Logged in: YES/NO
- UI-TARS grounding downloaded: YES/NO
- Vision brain connected: YES/NO (which model?)

## Test 1: Edge + LeetCode — PASS/FAIL
<step-by-step what happened>

## Test 2: Notepad — PASS/FAIL
<step-by-step what happened>

## Test 3: YouTube search — PASS/FAIL
<step-by-step what happened>

## Test 4: Stop button — PASS/FAIL
<what happened>

## Test 5: Thinking feed — PASS/FAIL
<what the feed showed>

## Bugs found (numbered list)
1. <bug description + how to reproduce>
2. ...

## Console errors (if any)
<paste any browser console errors>

## Verdict
<one paragraph: does Control mode actually work?>
```

Be honest. If something fails, say exactly where and why. Do not mark PASS
unless you SAW it work on the real desktop.
