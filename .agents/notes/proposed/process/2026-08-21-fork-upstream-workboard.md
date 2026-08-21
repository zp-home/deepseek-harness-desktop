# Fork upstream workboard

Status: active

This is the decision ledger for `zp-home/deepseek-harness-desktop`. It tracks
the open work reported against `anywhere-labs/deepseek-harness-desktop` without
granting blanket approval to upstream Issues or pull requests.

Snapshot: 2026-08-21, official `master` at `7ff6c98bc561d424fa8d2b65f8c3ba840f37f566`.
The snapshot contains 99 open Issues and 39 open pull requests. Fork `master`
is 28 commits ahead and 9 commits behind because the official branch moved to
DeepSeek Harness `0.1.1-rc.1` after the fork's rc8 synchronization.

## Decision policy

- Prefer release blockers, sandbox/security boundaries, startup, packaging,
  cross-platform stability, update integrity, and frequent user failures.
- Adapt useful upstream work at the Desktop/platform boundary instead of
  copying a pull request blindly.
- Changes to model requests, prompts, provider protocols, message semantics,
  or the Agent core are deferred by default because they increase rc8 upgrade
  cost and create long-lived behavior forks.
- Sandbox work must fail closed, preserve explicit user consent, own cleanup,
  include tests, and retain a documented removal or upgrade path. Never switch
  to `danger-full-access` automatically.
- New catalogs, plugin sources, binaries, and network destinations require a
  supply-chain and maintenance review before inclusion.
- Every accepted change uses a fork branch, a pull request targeting fork
  `master`, CI, a merge commit, and local `master` synchronization.

## Upstream version gate

The fork intentionally remains on the requested rc8 runtime at submodule commit
`141eb6fef83422698aef7a981029e843e8161534`. The latest official Desktop
`master` now pins `0.1.1-rc.1` at submodule commit
`528c682e061696f5a160f363f236ecbf53cbd006`. Merging it is therefore a runtime
upgrade, not an ordinary Desktop synchronization.

The nine new official commits have been split and audited:

- `5af5b8503b` and `70fc0a3cff` are the core/runtime and dependency upgrade;
  they are held behind an explicit version decision.
- `d17c7d2f81` is already covered by fork PR #10.
- `7686b524c2` contains launcher module preservation and macOS reveal behavior;
  it is a candidate for an rc8-compatible, conflict-aware adaptation.
- `73e5fa9910` adds safe Web-profile creation; its required app-boot functions
  exist in rc8, but the product behavior still needs a separate acceptance
  decision and focused tests.
- `ba59b93e38` adds persisted Market provider selection; retain it as a future
  Desktop boundary candidate until catalog ownership and UI integration are
  reviewed together.

Do not merge the official branch and then silently downgrade its dependency
files. That would claim upstream ancestry while running an unreviewed runtime
combination.

## Todo

### Completed

- Synced the latest official Desktop `master`; fork is 20 commits ahead and 0
  behind the official commit in this snapshot.
- Migrated the pinned DeepSeek Harness checkout to rc8 commit
  `141eb6fef83422698aef7a981029e843e8161534`.
- Adapted rc8 trajectory/thinking localization in fork PR #5.
- Synchronized official Desktop changes in fork PR #6.
- Re-fetched and audited official `master` after it advanced to
  `0.1.1-rc.1`; recorded the version boundary instead of silently upgrading.
- Added lifecycle-safe external sandbox integration guidance in fork PR #7,
  correcting the upstream proposal's multi-service ownership problem.
- Adapted official PR #121 in fork PR #8 with exact declared/delivered update
  byte validation, broader header coverage, and partial-file cleanup tests.
- Adapted official PR #122 in fork PR #10 so orderly restart disposal completes
  profile selection without weakening retained-reference lifecycle guards.
- Disabled pushes to the official repository through the `upstream` remote.

### In progress

- Keep this ledger synchronized as items are audited or implemented.

### Next

- Adapt only the profile recovery portion of PR #209; do not inherit unrelated
  SIGTERM behavior.
- Decide the next runtime target before merging official `master` beyond its
  last rc8-compatible commit.
- Audit `7686b524c2` as the next rc8-compatible Desktop-only backport candidate.
- Evaluate PR #266 for the Windows restricted sandbox only after measuring its
  packaged-size cost and running a real Windows shell probe matrix.
- Consolidate duplicate plugin-install and Linux-packaging reports before
  selecting one implementation path.

### Deferred or unnecessary now

- Do not adopt AI request, prompt, provider-protocol, message-semantic, or Agent
  core changes without an rc8 compatibility case and an exit strategy.
- Do not auto-fallback from the restricted Windows sandbox to unrestricted
  execution. PowerShell 5.1 and `cmd.exe` show the same restricted-token fault.
- Do not adopt PR #266 as-is: its bundled Node approach may fix the execution
  chain but adds roughly 87 MB and lacks the required packaged probe evidence.
- Do not merge the official `0.1.1-rc.1` dependency bump into an rc8-targeted
  release or rewrite its manifests afterward to create an unsupported hybrid.
- Do not add an unreviewed plugin catalog or external webview surface.
- Do not spend the short-term release budget on branding-only or system-resident
  decorative features.

## Explicit Issue decisions

| Issue | Status | Decision |
| ---: | --- | --- |
| 401 | completed | rc8 is pinned in the fork. |
| 441 | completed | Covered by fork PR #5. |
| 427 | completed | Covered by the corrected fork PR #7. |
| 439, 305 | future-validation | Restricted Windows sandbox needs the binary-size and shell probe gate above. |
| 442 | deferred-core | Output verbosity affects prompts/model behavior; wait for an upstream rc8-compatible surface. |
| 21, 157, 168, 353, 390, 400, 414, 416, 417 | deferred-core | Model/provider/request-chain behavior needs upstream-compatible diagnosis first. |
| 72 | rejected | A general external webview surface materially expands the security boundary. |
| 402 | deferred-supply-chain | Optional catalog needs ownership, trust, and update-policy review. |
| 419, 436 | unnecessary-now | No release, security, compatibility, or stability benefit. |

All other open Issues remain `pending-review`:

`443, 435, 434, 431, 425, 415, 408, 407, 405, 393, 387, 373, 372, 369,
367, 363, 357, 351, 348, 347, 346, 341, 340, 339, 338, 335, 334, 328, 327,
326, 325, 321, 318, 317, 314, 311, 310, 308, 299, 297, 289, 286, 285, 253,
247, 245, 242, 230, 221, 200, 198, 195, 186, 176, 175, 173, 170, 169, 160,
151, 146, 138, 137, 136, 133, 131, 125, 119, 110, 109, 108, 103, 99, 95,
94, 91, 86, 46, 45, 20`.

## Explicit pull-request decisions

| PR | Status | Decision |
| ---: | --- | --- |
| 428 | already-covered | Fork PR #7 implements the valid lifecycle-safe subset. |
| 121 | completed | Adapted with exact declared/delivered byte matching in fork PR #8. |
| 122 | completed | Adapted with initial and retry disposal-path tests in fork PR #10. |
| 209 | future-adapt | Take only selectable-profile recovery, excluding unrelated SIGTERM work. |
| 266 | future-validation | Potential sandbox fix; size and real packaged behavior are not accepted yet. |
| 155 | deferred-core | Provider request/health/usage customization creates long-term protocol coupling. |
| 115, 111 | deferred-core | Model/image capability changes cross the AI request and message boundary. |
| 345 | deferred-supply-chain | New catalog source requires separate trust and maintenance review. |
| 85 | unnecessary-now | The fork already has maintained multi-platform CI; do not add a competing workflow. |
| 220, 264, 265, 304 | consolidate | Competing Linux packaging implementations need one audited design. |

All other open pull requests remain `pending-review`:

`446, 445, 440, 426, 422, 358, 355, 350, 349, 342, 281, 278, 277, 270, 251, 224,
211, 196, 192, 184, 130, 126, 124, 114, 87`.

## Status vocabulary

- `completed`: implemented and merged in the fork.
- `in-progress`: currently being adapted on a fork branch.
- `next-audit`: next bounded candidate for detailed review.
- `future-adapt`: useful scope identified, implementation intentionally queued.
- `future-validation`: blocked on evidence, not on coding effort.
- `deferred-core`: avoided because it creates long-term rc8/core coupling.
- `deferred-supply-chain`: needs explicit trust and ownership review.
- `consolidate`: overlaps competing reports or implementations.
- `rejected`: conflicts with security or product boundary policy.
- `unnecessary-now`: real request, but not worth current release capacity.
- `pending-review`: inventoried but not yet decided.
