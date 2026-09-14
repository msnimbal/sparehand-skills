---
name: sparehand-client-scope
description: "Turn raw client requirements (notes, text, WhatsApp messages, audio recordings, documents) into a SpareHand AI scope document, a PDF, and matching records in the SpareHand CRM. Use for any new client engagement, scoping session, or proposal."
---

# Client requirements to scope, proposal and CRM

Takes whatever the client gave us and produces three things that stay in sync: a scope document as an Artifact, a PDF, and CRM records.

## Order of operations — do not reorder

1. Gather and understand the requirements
2. Assess, and ask the client-facing questions
3. Write `scope.json` — the single source of truth
4. Generate the documents from it
5. Write the CRM records
6. Revise by editing `scope.json` and regenerating

**Scope before opportunities.** Do not create CRM opportunities until the workstreams are settled. Creating them early means deleting and renaming records when the scope shifts — which it always does.

**Findings about a client, a platform, or a vendor belong in that client's CRM notes, never in this skill.** This file holds method only. Anything dated, priced or product-specific goes stale and misleads the next engagement.

## Step 1 — Gather requirements

Sources arrive as notes, pasted text, WhatsApp exports, documents (.docx, .pdf), or audio. Bound the input explicitly: name the folder, files or search. Never "ingest anything related to this client".

Extract a fixed set: entities and legal names, addresses, contacts and roles, systems currently in use, stated requirements, and the client's own open questions.

### Audio recordings

Try a hosted transcription connector first. If its upload or model host is refused by egress policy, fall back to transcribing locally — test rather than assume, in both the cloud workspace and the device VM, since what is reachable changes.

Local fallback, via `device_bash`:

```
pip3 install --quiet cmake pywhispercpp
ffmpeg -v error -y -i INPUT -ar 16000 -ac 1 $HOME/audio16k.wav
```

Use a ggml Whisper model already on the machine if there is one (request folder access for it); otherwise check what can be downloaded before committing to this route.

**Background jobs die.** Each `device_bash` call is torn down when it returns, so `nohup ... &` never survives — and `pgrep -f script.py` will match the calling shell's own command string, falsely reporting the job as running. Verify progress by output file, never by process check.

Instead, transcribe **synchronously in chunks** sized to fit the per-call timeout (measure one short chunk first to get the real ratio), appending to one file with a time offset per chunk. Do not name the chunk script `chunk.py` — it shadows the stdlib module `wave` imports.

Flag low-confidence items rather than asserting them: names, phone numbers, money, dates, and anything spoken in a second language. Note where the recording starts mid-sentence or the model repeats itself.

## Step 2 — Assess

Write the assessment before the scope. State what the client actually asked for — not what our existing demos happen to do. A word that names one of our products may mean something quite different in the client's mouth; check before assuming the ask matches the asset.

**Verify platform feasibility before anything enters scope.** For every third-party system a workstream depends on, search its current documentation and confirm: that an API exists at all, what it is permitted to do, what rate or messaging windows constrain it, and what review or verification gates delivery. Platform rules change, so verify per engagement rather than trusting memory.

Never scope what a platform forbids, and never scope automation of a platform's UI through a browser as a deliverable — say plainly that it isn't one, and offer the compliant route instead. Where the compliant route is the platform's own built-in tooling, that is configuration work, not a build: price and describe it as such.

Record each finding, with its source, in the client's CRM note against the workstream it constrains.

Use `AskUserQuestion` for the forks that change the build. Ask what moves the price most — typically build-versus-configure on the largest workstream — and get volumes, which drive effort.

## Step 3 — `scope.json`

One file in the client folder, holding: client entities, recipient, date, context, assumptions, workstreams (each with title, owning entity, narrative, tasks, exclusion note), open items, out-of-scope, and prices when they exist.

Everything downstream is generated from this. When the scope changes — and it will, several times — edit this file and regenerate, rather than hand-editing the artifact and then the CRM note separately. Hand-editing both is how they drift.

## Step 4 — Documents

**House template.** Reuse the published SpareHand scope template rather than designing fresh: `Artifact` with `action: "list"`, then `action: "read_file"` with `path: "index.html"` on the most recent scope artifact. Keep the logo SVG, the Fraunces/Public Sans pairing, the numbered scope items, and the task lists.

The published file carries a `<!doctype>` wrapper added at publish time — strip everything before `<body>` and after `</body>` before republishing, or the page breaks.

**Grid overflow.** Task text in a grid `1fr` track will push the page wider than the viewport. Use `minmax(0, 1fr)` on every grid column and `min-width: 0` on grid children.

**Verify before publishing.** Render at 1100px and 400px with Playwright (`executablePath: '/opt/pw-browsers/chromium'`) and assert `scrollWidth <= clientWidth`. Read the screenshot. A missing item number or a full-bleed table means unbalanced markup — usually a section deleted by an over-greedy edit.

**When deleting a block by string slicing, match on a unique anchor.** Searching for a short common string silently swallows later sections.

**PDF:** Playwright `page.pdf` on the same HTML, A4, `printBackground: true`, 14mm/12mm margins. Write to `/mnt/user-data/outputs/`, deliver with `SendUserFile`, then `device_commit_files` into the client folder.

**Document voice.** State constraints plainly in the workstream where they bite, not buried in a footnote — anything unstated becomes a promise. Say what is excluded and why. Mark unpriced work as unpriced; never imply a proposal exists when it doesn't.

## Step 5 — CRM (SpareHand AI connector)

Search before creating, every time — near-duplicate client names are the failure mode.

```
find_many_companies    → create_one_company     (name, domainName, address)
                         create_one_person      (companyId, jobTitle, emails, phones)
                         create_many_opportunities
                         create_one_note + create_one_note_target
```

Stages: `MEETING` after a requirements session with nothing priced; `PROPOSAL` once a scope with prices exists. Amounts in `amountMicros` (dollars × 1,000,000) with `currencyCode`.

Attach two notes to the account: the full transcript or source material, and the assessment. Attach approach decisions — including the platform findings from step 2 — to the opportunity they belong to.

**There is no file-upload tool.** `create_one_attachment` needs a `fileId` only Twenty can issue, and the connector doesn't expose one. Create the attachment record with `fullPath` pointing at the artifact URL, and say plainly that it links rather than holding the PDF. The note carries the content; the attachment is a convenience.

## Step 6 — Revisions

Edit `scope.json`, regenerate, republish to the **same** artifact URL (pass `url`), regenerate the PDF, `device_commit_files` with `force: true` over the previous copy, and update the CRM note. Tell the user what changed — not the whole document again.

When a revision changes the shape of the work, the opportunities must follow:

- **A workstream splits** → rename the existing opportunity to the surviving half and create one for the new half. Do not delete and recreate both; the original carries its history.
- **Workstreams merge** → keep the opportunity with the longer history, fold the name, delete the other.
- **A workstream is dropped** → delete its opportunity, and say so.
- **Prices arrive** → set `amount` on each and move every opportunity to `PROPOSAL` together, so the pipeline never shows a half-priced engagement.

Confirm structural changes with the user before writing them — renames are cheap, deletions are not.

## Client folder

`sidekikai-main/business/Demos/<Client Name>/` holds the source material, transcript, `scope.json` and the PDF. Name it for the client, not the product or the engagement.

`device_bash` cannot delete or move across mounts: copy, verify with `shasum -a 256`, then request delete permission to remove the original. `mv` within one mounted folder works.