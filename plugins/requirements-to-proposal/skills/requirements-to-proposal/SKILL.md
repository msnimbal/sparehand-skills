---
name: requirements-to-proposal
description: "Turn raw client requirements — meeting notes, chat threads, voice recordings, emails, documents — into a scope document, a PDF, and matching client records. Use when scoping a new engagement, writing a proposal or statement of work, processing a discovery or requirements call, or revising a scope that has already been sent."
---

# Requirements to scope, proposal and client records

Takes whatever the client gave us and produces three things that stay in sync: a scope document published as an Artifact, a PDF, and records in `~~CRM`.

## Order of operations — do not reorder

1. Gather and understand the requirements
2. Assess, and ask the questions that change the build
3. Write `scope.json` — the single source of truth
4. Generate the documents from it
5. Write the client records
6. Revise by editing `scope.json` and regenerating

**Scope before opportunities.** Do not create deal or opportunity records until the workstreams are settled. Creating them early means deleting and renaming records when the scope shifts — which it always does.

**Findings about a client, a platform or a vendor belong in that client's records, never in this skill.** This file holds method only. Anything dated, priced or product-specific goes stale and misleads the next engagement.

## Step 1 — Gather requirements

Sources arrive as notes, pasted text, chat exports, documents, emails or audio. Bound the input explicitly: name the folder, the files, or the search. Never accept "everything related to this client" as a scope of input — it is the fastest route to a confidently wrong summary.

Extract a fixed set: legal entity names, addresses, contacts and their roles, systems currently in use, stated requirements, and the client's own open questions. Keep the client's words for the requirements; paraphrase only the framing.

### Audio recordings

Try a hosted transcription connector first. If its upload host or model host is refused by network policy, fall back to transcribing locally — test rather than assume, since what is reachable differs between the cloud workspace and a connected computer, and changes over time.

For the local fallback, use a speech-to-text package installed from the package index and a model already present on the machine. Convert to 16 kHz mono first.

Three failure modes worth knowing before starting:

- **Background jobs do not survive.** A shell opened on a connected computer is torn down when the call returns, so `nohup ... &` dies immediately.
- **Process checks lie.** `pgrep -f script.py` matches the calling shell's own command string and will report a dead job as running. Verify progress by output file only.
- **Per-call timeouts are short.** Transcribe synchronously in chunks sized to fit, measuring one short chunk first to get the real speed ratio, appending to one file with a time offset per chunk.

Avoid naming any helper script after a standard-library module — `chunk.py` in particular breaks audio libraries that import `wave`.

Flag low-confidence items rather than asserting them: names, phone numbers, money, dates, and anything spoken in a second language. Note where a recording starts mid-sentence or the model repeats itself.

## Step 2 — Assess

Write the assessment before the scope. State what the client actually asked for — not what our existing products happen to do. A word that names one of our offerings may mean something quite different in the client's mouth; check before assuming the ask matches the asset.

**Verify platform feasibility before anything enters scope.** For every third-party system a workstream depends on, search its current documentation and confirm: that an API exists at all, what it is permitted to do, what rate or messaging limits constrain it, and what review or verification gates delivery. Platform rules change, so verify per engagement rather than trusting memory.

Never scope what a platform forbids, and never offer automation of a platform's user interface through a browser as a deliverable — say plainly that it isn't one, and offer the compliant route instead. Where the compliant route is the platform's own built-in tooling, that is configuration work rather than a build: describe and price it as such.

Record each finding, with its source, against the workstream it constrains.

Use AskUserQuestion for the forks that change the build. Ask what moves the price most — typically build-versus-configure on the largest workstream — and ask for volumes, which drive effort.

## Step 3 — `scope.json`

One file in the client's working folder holding: client entities, recipient, date, context, assumptions, workstreams (each with title, owning entity, narrative, tasks, exclusion note), open items, out-of-scope, and prices once they exist.

Everything downstream is generated from this. When the scope changes — and it will, several times — edit this file and regenerate. Hand-editing the document and then separately hand-editing the client record is how the two drift apart.

## Step 4 — Documents

**Reuse the house template** rather than designing fresh, so every proposal looks like the last one. If a previous scope was published as an Artifact, read its `index.html` back (`action: "read_file"`) and reuse its structure, type pairing and layout. Otherwise load the artifact design guidance and build one template worth keeping.

A published Artifact carries a document wrapper added at publish time — strip everything before `<body>` and after `</body>` before republishing, or the page breaks.

**Grid overflow.** Long task text in a grid `1fr` track pushes the page wider than the viewport. Use `minmax(0, 1fr)` on every grid column and `min-width: 0` on grid children.

**Verify before publishing.** Render at desktop and phone widths with a headless browser and assert `scrollWidth <= clientWidth`. Then read the screenshot. A missing item number, a full-bleed table, or content at the wrong indent means unbalanced markup — usually a section destroyed by an over-greedy edit.

**When deleting a block by string slicing, match on a unique anchor.** Searching for a short common string silently swallows everything up to a later match.

**PDF:** print the same HTML from the headless browser at A4 with backgrounds on and sensible margins, deliver it to the user, and save it where the organisation keeps deliverables.

**Document voice.** State constraints plainly in the workstream where they bite, not buried in a footnote — anything unstated becomes a promise. Say what is excluded and why. Mark unpriced work as unpriced, and never imply a proposal exists when only a scope does.

## Step 5 — Client records

Search before creating, every time. Near-duplicate client names are the failure mode, and a duplicate account is far more expensive to unpick later than a search is now.

In `~~CRM`, create or update: the account, the contacts with their roles, and one opportunity per workstream. Set the stage to reflect reality — a discovery stage when nothing is priced, a proposal stage only once a priced scope exists.

Attach the source material and the assessment to the account. Attach approach decisions — including the platform findings from step 2 — to the opportunity they belong to, not to the account, so they stay with the work they constrain.

**Check whether the connector can accept file uploads before promising one.** Many CRM connectors expose record creation but not file storage. When uploads are unavailable, put the content in a note and link the published document; then say plainly that the attachment links rather than holding the file.

## Step 6 — Revisions

Edit `scope.json`, regenerate, republish to the **same** Artifact URL, regenerate the PDF, overwrite the saved copy, and update the client record. Tell the user what changed — not the whole document again.

When a revision changes the shape of the work, the opportunity records must follow:

- **A workstream splits** → rename the existing record to the surviving half and create one for the new half. Do not delete and recreate both; the original carries its history.
- **Workstreams merge** → keep the record with the longer history, fold the name, delete the other.
- **A workstream is dropped** → delete its record, and say so.
- **Prices arrive** → set the amount on each and move every record to the proposal stage together, so the pipeline never shows a half-priced engagement.

Confirm structural changes with the user before writing them: renames are cheap, deletions are not.

## Working folder

Keep one folder per client holding the source material, the transcript, `scope.json` and the generated documents. Name it for the client, not for the product or the engagement — engagements change names, clients rarely do.

On a connected computer, a shell often cannot delete files or move them across mounts. To move a file, copy it, verify with a checksum, and only then request deletion of the original. Renaming inside a single mounted folder works normally.
