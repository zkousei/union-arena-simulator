# AGENTS.md

This file defines the default development rules for Codex in this repository.

## Primary Goal

Keep the UNION ARENA simulator reliable as both a solo-play sandbox and a P2P
application. Most behavior changes should be protected by automated tests and
completed with a passing production build. Manual verification should remain
focused on browser layout, drag/drop feel, and real WebRTC timing.

## Default Development Style

- Prefer TDD by default.
- For a bug fix, add a test that reproduces the bug before changing production
  code whenever practical.
- For a new feature, specify the intended behavior in the narrowest relevant
  test first.
- Do not change production behavior without adding or updating its owning test,
  unless the user explicitly requests investigation only.
- Favor small changes and keep behavior changes separate from broad refactors.
- Use the `red -> green -> refactor` loop when practical.
- Do not weaken assertions merely to make a failing test pass.

## TDD Exceptions

Starting without a failing test is acceptable for:

- Investigation-only work
- Documentation, comments, and copy-only changes
- Test harness or fixture repair with no production behavior change
- Browser-specific layout or drag/drop problems that must first be reproduced
  visually
- Generated card-data refreshes where validation and parity checks are the more
  appropriate safety net

When behavior becomes clear, add the narrowest useful automated regression test.

## Architecture and State Rules

### Game state

- `src/domain/reducer.ts` is the single source of truth for game-state
  transitions.
- Define new game operations in `src/types/actions.ts` and implement them in the
  reducer. UI components should dispatch actions instead of mutating game state.
- Reducer actions must preserve card conservation unless the rule explicitly
  creates or removes a card.
- Invalid actions should be safe no-ops; they must not partially remove or
  overwrite cards.
- Put reusable rule calculations in `src/domain/` rather than page or component
  files.
- Keep UI-only state, such as an open menu or an attack-selection overlay, out
  of `GameState` unless it must synchronize between peers.

### Authoritative P2P synchronization

P2P is host-authoritative. This is a repository invariant.

- A connected guest sends `ACTION_REQUEST`; it does not run the game reducer
  optimistically.
- The host evaluates every action exactly once, including all random behavior,
  and sends a committed `STATE_COMMIT` snapshot.
- Guests apply committed snapshots and never recompute shuffle, mulligan,
  random discard, dice, or other random results.
- Snapshot revisions are monotonically increasing. Duplicate or older snapshots
  must be ignored.
- Undo requests from a guest are resolved against the host's history and then
  committed like any other authoritative state change.
- Initial or reconnect synchronization uses the host's current state and
  revision.
- Do not reintroduce peer-local execution of synchronized actions.
- When adding a random action, cover its authoritative behavior in
  `src/domain/__tests__/peerSync.test.ts` or a narrower equivalent.
- Keep callbacks used by PeerJS safe from stale React closures. Values needed by
  long-lived connection handlers should be read from synchronized refs or from
  a deliberately stable abstraction.

Full-state commits currently prioritize correctness over bandwidth. If this is
replaced with patches or resolved events, preserve the same host-authoritative,
ordered, deterministic contract and add migration tests first.

### Hidden information

- The current P2P model trusts connected clients and synchronizes the complete
  game state, matching the approach used by `shadowverse-evolve-app`.
- Hide hands, face-down life, and unrevealed deck contents in the normal UI even
  though their data exists on both peers.
- Do not add accidental UI paths that reveal an opponent's private cards. An
  explicit reveal or inspection mode must be clearly labeled and intentional.
- Do not describe this model as secure against developer tools or a modified
  client. If adversarial secrecy becomes a requirement, introduce a dedicated
  per-recipient public/private state design and tests before changing transport.

## UNION ARENA Rule Changes

- Keep official rule enforcement separate from free-form sandbox convenience.
- If a rule is intentionally not enforced, make that clear in UI text rather
  than describing the operation as fully automatic.
- Rule changes should include reducer tests for valid behavior, invalid/no-op
  behavior, and relevant edge cases.
- Preserve the setup sequence: first-player decision, initial hand, mulligan or
  keep, life placement, readiness, then game start.
- When changing phase, AP, freeze, raid, life, trigger, or combat behavior,
  verify all alternate entry points so one path cannot bypass the rule.

## Deck and Card Data Rules

- Deck validation belongs in `src/domain/deckValidation.ts`.
- Keep normal and parallel versions grouped by base card code for copy limits.
- Preserve the 50-card, title-code, trigger-limit, and unrevealed-card checks
  unless an official rule change explicitly requires otherwise.
- Validate imported JSON before allowing it into component rendering or saved
  storage.
- `src/data/officialCards.json` is synchronized card data. Prefer updating it
  through `npm run sync-cards` and its supporting scripts instead of manual bulk
  edits.
- Parser changes belong in `src/services/officialCardService.ts` and require
  fixture-based tests that do not depend on live network availability.
- Do not make normal tests depend on the official website, CORS proxies, or
  PeerJS cloud availability.

## Test Ownership

Choose the lowest-level test that fully expresses the behavior.

- Reducer actions, zone movement, turn/phase rules, raid, life, and no-op guards:
  - `src/domain/__tests__/reducer.test.ts`
- Deck construction rules and card flattening:
  - `src/domain/__tests__/deckValidation.test.ts`
- Host-authoritative transitions, revisions, random-result synchronization, and
  snapshot ordering:
  - `src/domain/__tests__/peerSync.test.ts`
- Official card HTML parsing and deck-list parsing:
  - `src/services/__tests__/officialCardService.test.ts`
- Storage/import validation:
  - Add focused tests beside `src/utils/deckStorage.ts`
- Hook orchestration or PeerJS lifecycle behavior that cannot be expressed as a
  pure contract:
  - Add a focused hook test beside `src/hooks/useGame.ts` or `src/hooks/usePeer.ts`
- Component wiring, accessibility, and dialog behavior:
  - Add colocated `*.test.tsx` files under `src/components/`
- Page composition and complete user flows:
  - Add page tests under `src/pages/`
- Real browser layout, drag/drop, two-tab P2P, and responsive flows:
  - Add Playwright E2E coverage when an E2E harness is introduced

Every production behavior change should have one clearly identified primary
test owner. Mention that file in the completion summary.

## Test-First Execution Loop

1. State the behavior being protected in one sentence.
2. Select the narrowest owning test layer.
3. Add the failing test and confirm it fails for the intended reason.
4. Make the smallest production change that turns it green.
5. Run the targeted test while iterating.
6. Run the full completion checks before handoff.

## UI and Responsive Verification

- Preserve keyboard access and accessible names for icon-only controls.
- Do not rely on color alone to communicate state.
- For layout changes, check at least a desktop viewport and a 390px-wide mobile
  viewport.
- The deck builder must provide usable access to both the card library and the
  current deck on narrow screens; fixed side panes must not consume the whole
  viewport.
- Verify modal reachability, scrolling, and close controls at narrow heights.
- Prefer automated DOM assertions; use browser verification for geometry,
  overflow, visual hierarchy, and drag/drop behavior.

## Branch Workflow

This repository uses a lightweight, `main`-based workflow. Feature branches are
short-lived and should contain one coherent change. Do not introduce a permanent
`develop` branch unless the repository maintainers explicitly adopt one.

### When to Create a Branch

- For feature development, bug fixes, refactors, test additions, dependency
  updates, and other production-code changes, normally create or reuse a
  dedicated branch before editing.
- Read-only investigation, review, and diagnosis do not require a branch.
- Small documentation-only or repository-instruction changes may be made on the
  current branch unless the user asks for an isolated branch.
- If the user names a branch or explicitly asks to stay on the current branch,
  follow that instruction.
- If already on a branch whose purpose matches the requested change, continue
  on it instead of creating another branch.
- Do not mix unrelated tasks into the same branch. Start a separate branch after
  the current work is completed or safely set aside.

### Branch Naming

Codex-created branches use the `codex/` prefix by default, followed by a category
and a short kebab-case description:

- `codex/feature-<description>` for user-facing functionality
- `codex/fix-<description>` for defects and regressions
- `codex/refactor-<description>` for behavior-preserving restructuring
- `codex/test-<description>` for test-only work
- `codex/docs-<description>` for substantial documentation work
- `codex/chore-<description>` for tooling, dependencies, and maintenance

Examples: `codex/fix-p2p-random-sync`,
`codex/feature-mobile-deck-builder`, and `codex/test-deck-import`.

Use the exact branch name requested by the user even when it does not follow
these defaults. Keep names concise and do not include issue text, secrets, or
personal data.

### Starting Work Safely

Before creating or switching branches:

1. Run `git status --short --branch` and identify the current branch, staged
   changes, unstaged changes, and untracked files.
2. Determine whether existing changes belong to the requested task. Treat
   unknown changes as user-owned.
3. Never discard, overwrite, stash, commit, or move unrelated user changes
   without explicit approval.
4. If existing changes do not block the task, preserve them and work around
   them. Ask the user only when safe branch creation or implementation is
   genuinely blocked.
5. Create a branch from the repository's intended base, normally an up-to-date
   `main`. Do not pull, reset, or rewrite the base merely to make it appear
   current; verify the remote state first when network access and authorization
   are available.

When uncommitted task changes already exist on `main`, do not create a branch in
a way that risks losing them. If safe, create the new branch at the current
commit so the working tree changes carry over unchanged. Otherwise report the
condition and request direction.

### Working on the Branch

- Keep the branch focused on one feature, fix, or refactor.
- Follow the test-first workflow and keep the owning tests in the same branch as
  the production change.
- Regularly inspect `git diff` and `git status` so generated files, secrets, and
  unrelated edits are not included accidentally.
- Do not merge `main` into the branch solely to hide conflicts. Rebase or merge
  only when needed, and never rewrite commits already used by others without
  explicit approval.
- Do not commit, amend, rebase, force-push, push, create a pull request, merge, or
  delete a branch unless the user has requested that action or it is an explicit
  part of the requested workflow.
- Never use a force push by default. If one is explicitly required, prefer
  `--force-with-lease` and explain the risk before proceeding.

### Commit and Pull Request Expectations

When the user requests commits or a pull request:

- Make commits small enough to review but complete enough to keep tests and the
  build meaningful.
- Use imperative, behavior-focused commit subjects, for example
  `Fix guest-side random action replay`.
- Keep formatting-only refactors separate from behavior changes when practical.
- Before proposing merge, run the Completion Checklist and review the final diff
  against `main` for scope, tests, debug code, secrets, and generated output.
- Summarize the user-visible behavior, test ownership, verification commands,
  manual-check-only risks, and any follow-up work in the pull request.
- Do not claim that a branch is mergeable while required checks are failing.

### Recommended Workflow

1. Inspect the current branch and working tree.
2. Create or reuse one suitable short-lived branch.
3. Add or update the narrowest owning test before production code when feasible.
4. Implement and run targeted checks while iterating.
5. Run the broader Completion Checklist.
6. Review the complete diff and report remaining risks.
7. Commit, push, and create or update a pull request only when requested.
8. After merge, synchronize and clean up local branches only when requested.

## Post-Merge Local Sync

When the user asks to synchronize after a branch has been merged:

1. Check the branch and working tree before changing anything.
2. Do not discard or stash uncommitted changes without explicit approval.
3. Switch to `main` and pull its latest remote state using a fast-forward-only
   update where possible.
4. Verify that the merged change is present and report the resulting branch and
   working-tree state.
5. Delete local or remote branches only when the user explicitly asks. Confirm
   the branch is merged before deletion; never delete an unmerged branch merely
   because the pull request was closed.

## Safe Change Rules

- Prefer characterization tests before refactoring `Board.tsx`, `SideZonesArea.tsx`,
  `App.tsx`, or `reducer.ts`; these files currently coordinate many behaviors.
- Keep refactors and rule changes in separate commits when possible.
- Preserve existing public action payloads unless the migration is deliberate
  and all callers are updated together.
- Do not edit generated build output in `dist/`.
- Do not commit secrets, room IDs, browser storage, or machine-specific paths.
- Do not add live-network requirements to unit tests.

## Manual Verification Policy

Manual verification is most appropriate for:

- Real two-browser or two-device WebRTC timing
- Drag/drop feel and hit targets
- Responsive board and deck-builder layout
- Audio behavior
- Visual card rendering and image fallbacks

If a manual check exposes a stable rule or synchronization bug, add an automated
test for its underlying contract.

## Completion Checklist

Unless the user requests a narrower scope, finish production changes with:

- The narrowest relevant test during iteration
- `npm run lint`
- `npm test`
- `npm run build`
- Browser verification when layout, interaction, routing, or P2P UI changed
- `git diff --check`

There is currently no repository E2E script. Do not claim that E2E checks ran.
If one is added later, update this checklist and `package.json` together.

For card-data synchronization, also report whether `npm run sync-cards` was run
and whether it required live network access.

## Communication Expectations

- State the behavior being changed before implementation.
- Identify the primary owning test file.
- Report the exact verification commands that passed.
- Call out remaining manual-only risks, especially real P2P timing and mobile
  layout.
- Distinguish rule automation from sandbox/manual operations in summaries.
