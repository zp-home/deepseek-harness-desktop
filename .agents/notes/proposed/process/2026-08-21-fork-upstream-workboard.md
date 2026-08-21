# Fork upstream workboard

Status: active

This is the decision ledger for `zp-home/deepseek-harness-desktop`. It tracks
the open work reported against `anywhere-labs/deepseek-harness-desktop` without
granting blanket approval to upstream Issues or pull requests.

Snapshot: 2026-08-21, official `master` at `7ff6c98bc561d424fa8d2b65f8c3ba840f37f566`.
The snapshot contains 102 open Issues and 40 open pull requests. Fork `master`
is 38 commits ahead and 0 behind after the latest-core revalidation PR #16 was
merged.

## Decision policy

- Prefer release blockers, sandbox/security boundaries, startup, packaging,
  cross-platform stability, update integrity, and frequent user failures.
- Adapt useful upstream work at the Desktop/platform boundary instead of
  copying a pull request blindly.
- Changes to model requests, prompts, provider protocols, message semantics,
  or the Agent core are deferred by default because they increase future upgrade
  cost and create long-lived behavior forks.
- Sandbox work must fail closed, preserve explicit user consent, own cleanup,
  include tests, and retain a documented removal or upgrade path. Never switch
  to `danger-full-access` automatically.
- New catalogs, plugin sources, binaries, and network destinations require a
  supply-chain and maintenance review before inclusion.
- Every accepted change uses a fork branch, a pull request targeting fork
  `master`, CI, a merge commit, and local `master` synchronization.

## Upstream version decision

The user approved moving the fork from rc8 to the latest published DSH runtime
on 2026-08-21. Fork `master` pins `0.1.1-rc.1` at submodule commit
`528c682e061696f5a160f363f236ecbf53cbd006` and upgrades the complete published
package family together; it does not claim upstream ancestry while silently
downgrading manifests into an unsupported hybrid.

The nine new official commits have been split and audited:

- `5af5b8503b` and `70fc0a3cff` are the accepted core/runtime and dependency
  upgrade to the coherent `0.1.1-rc.1` package family.
- `d17c7d2f81` is already covered by fork PR #10.
- `7686b524c2` contains launcher module preservation and macOS reveal behavior;
  fork `master` combines it with the fork's localized native menu.
- `73e5fa9910` adds safe Web-profile creation; its required app-boot functions
  are accepted with focused Profile tests and atomic staging cleanup.
- `ba59b93e38` adds persisted Market provider selection. The Desktop boundary is
  accepted, but it does not authorize new catalogs or network sources.

The upgrade retains the fork's download integrity, Profile lifecycle and
recovery, Windows directory filtering, macOS recovery, prompt history,
response-language, trajectory localization, and node-pty packaging fixes.

The version boundary was revalidated after the merge. The official DSH
`master`, newest Git tag, GitHub prerelease, and npm `next` package family all
still resolve to `0.1.1-rc.1` at `528c682e061696f5a160f363f236ecbf53cbd006`.
There is no newer coherent core release to adapt and no duplicate runtime
upgrade should be created.

Compared with rc8, the accepted DSH release adds the
`DeepSeek-V4-Flash-Vision-Exp` model, closes the Bubblewrap
`/proc/<pid>/root` escape path, fixes composer layout when editing before an
`@` reference, and improves Markdown tables, 99.x% cache-hit precision,
subagent header navigation, and multiline `ask_user_question` answers. These
are upstream runtime behaviors; the fork did not add a separate model-request
or message-semantics customization to obtain them.

## Todo

### Completed

- Synced the latest official Desktop `master`; fork is 36 commits ahead and 0
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
- Adapted only the selectable-Profile recovery part of official PR #209 in fork
  PR #13. Its five CI jobs passed; unrelated SIGTERM behavior was excluded.
- Upgraded DSH, the source submodule, the complete published package family,
  Yarn lockfile, and every retained patch locator to `0.1.1-rc.1` in fork PR
  #14. Safe Web-profile creation, persisted Market selection, launcher-module
  preservation, and macOS reveal were integrated without dropping fork fixes.
- PR #14 passed all five GitHub jobs, including the Windows installer and
  portable archive, macOS smoke artifact, full check, and pinned-core check.
  Locally, immutable install, type checking, 96 focused tests, 701 full-suite
  tests, 183 package tests, and the 201-node runtime closure passed. Six
  symlink tests could not run because this host denies symlink creation.
- Revalidated the source tag, GitHub release, npm `next` dist-tag, package
  family, fork branch, and official Desktop branch after PR #14. The fork is
  already on the newest coherent DSH release, so no duplicate core change is
  required.
- Audited Issue #449 against the fork Market. Plugin cards and details already
  expose normalized summaries/descriptions, source rows expose attribution and
  endpoints, and users can add a trusted standard HTTPS manifest. Additional
  built-in catalogs remain a separate supply-chain decision.
- Resolved Issue #450 at the documented `sidebar.footer.action` style anchor.
  Footer list entries now stack vertically in expanded and collapsed sidebars,
  so another plugin cannot horizontally squeeze or deform the Market launcher.
- Disabled pushes to the official repository through the `upstream` remote.

### In progress

- Keep this ledger synchronized as high-impact Issues and pull requests are
  audited or implemented.

### Next

- Evaluate PR #266 for the Windows restricted sandbox only after measuring its
  packaged-size cost and running a real Windows shell probe matrix.
- Consolidate duplicate plugin-install and Linux-packaging reports before
  selecting one implementation path.

### Deferred or unnecessary now

- Do not adopt fork-specific AI request, prompt, provider-protocol,
  message-semantic, or Agent core changes without a compatibility case and an
  exit strategy.
- Do not auto-fallback from the restricted Windows sandbox to unrestricted
  execution. PowerShell 5.1 and `cmd.exe` show the same restricted-token fault.
- Do not adopt PR #266 as-is: its bundled Node approach may fix the execution
  chain but adds roughly 87 MB and lacks the required packaged probe evidence.
- Do not partially downgrade the accepted `0.1.1-rc.1` package family or ship an
  unsupported mixed rc8/rc.1 runtime.
- Do not add an unreviewed plugin catalog or external webview surface.
- Do not spend the short-term release budget on branding-only or system-resident
  decorative features.

## Explicit Issue decisions

| Issue | Status | Decision |
| ---: | --- | --- |
| 401 | completed | The initial rc8 milestone shipped; Issue #448 now supersedes that runtime target. |
| 448 | completed | The coherent runtime/package family shipped through fork PR #14. Separate core self-update remains a later architecture decision. |
| 449 | completed | The fork already shows plugin/source descriptions and supports user-added standard HTTPS manifests. No unreviewed built-in catalog was added. |
| 450 | completed | The official slot anchor now provides a vertical list container, preventing multiple footer plugins from squeezing each other in either sidebar width. |
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
| 451 | already-covered | Fork PR #5 already localizes these rc.1 trajectory and Thinking labels. Do not duplicate the patch while official CI is failing; reassess replacement only after upstream merges. |
| 121 | completed | Adapted with exact declared/delivered byte matching in fork PR #8. |
| 122 | completed | Adapted with initial and retry disposal-path tests in fork PR #10. |
| 209 | completed | Selectable-profile recovery shipped in fork PR #13; unrelated SIGTERM work was excluded. |
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
- `deferred-core`: avoided because it creates long-term upstream-core coupling.
- `deferred-supply-chain`: needs explicit trust and ownership review.
- `consolidate`: overlaps competing reports or implementations.
- `rejected`: conflicts with security or product boundary policy.
- `unnecessary-now`: real request, but not worth current release capacity.
- `pending-review`: inventoried but not yet decided.
