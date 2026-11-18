# Thesis desktop project guide

## Scope and source of truth

This directory contains the desktop Thesis prototype. Start at [HANDOFF.md](HANDOFF.md)
and the five chapters in [docs/development](docs/development/).
The first development stage is transferring interface and behavior on demo data;
real integrations follow separately. Technology for the target client is not selected
by this handoff. Product questions that still need confirmation are listed in chapter 5.

Use the documented current implementation as the behavior reference. Do not treat
an unresolved question as an approved requirement or silently change its behavior.
Keep code, applicable tests and documentation consistent when an accepted rule changes.

## Running and data safety

- Run from this directory, bound strictly to `127.0.0.1:4192`.
- First check whether that server is already available. If absent, use `npm run dev`.
- Preserve existing browser data. Use `?preview=1` and separate browser contexts
  for checks; do not clear, move or silently migrate stored values.
- Use the explicit `tests/*.config.ts` listed in chapter 4. Inspect `baseURL`,
  `webServer` and `testMatch` before any additional suite. Default test discovery
  is not the acceptance specification.
- Build with `npm run build`. `npm test` runs `tests/model.test.ts`;
  select other model and browser tests according to the changed behavior.
- Do not reinstall dependencies or change VINi releases without a relevant task.
- Publishing requires an explicit request. Local changes do not automatically update Vercel.

## Product behavior

- There are no work tabs for multiple open records. A record retains Overview,
  Transcript and Assistant materials, an optional record list and properties, and a player.
- Preserve the originating context, filters, search, scroll, selected material,
  conversation position and appropriate focus when navigating and returning.
- A direct link or reload must not invent the originating search collection.
- Keep record source, workspace, folder, audience and Assistant sources independent.
- Moving a record does not duplicate it; changing workspace confirms audience
  consequences and clears the old folder. Deleting a folder preserves its content.
- Drafts are independent. Opening an exit/restart confirmation does not itself
  pause capture; only the selected action changes the draft state.
- Retain available previous/partial materials during processing. Mark stale
  summaries and retry only the appropriate failed phase.
- Assistant turns keep immutable source snapshots. Explicitly empty sources
  never broaden automatically. Stop/retry preserves the same question and snapshots.
- Dialogs and drafts remain independent. Record and global Assistant views refer
  to the same selected dialog object; matching one source does not justify migration.
- Hide answers whose used sources become unavailable. Do not fabricate utterance
  citations, exact timecodes, owners, members, deadlines or real access guarantees.
- Member selection is local demo data, not invitations or ACL administration.

## Implementation boundary

SSO, Thesis API, media capture, upload, conference agent, recognition, LLM,
server authorization and synchronization are simulated or absent. Client guards
and reducer actions are not a backend contract. Local export, clipboard, browser
sharing and printing have real browser effects as described in chapter 3.

<!-- BEGIN:vini-npm -->
For VINi interface work, use `.agents/skills/vini-ds/SKILL.md` and the project-local `vini-ds` MCP server.
<!-- END:vini-npm -->

Preserve the blue main accent, red recording action and independent semantic
status colors. Settings use native VINi Card composition. The blue informational
Alert in the record list is a documented product exception. Use installed public
components, props, slots and tokens; verify the actual client MCP project identity
before interpreting its results as this project's contract.
