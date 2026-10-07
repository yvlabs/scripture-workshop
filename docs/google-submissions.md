# Anonymous Google submissions: proof of concept

This route delivers a contribution from a local runtime without connecting GitHub or Google, creating a personal GitHub repository, or receiving upstream push permission. The contributor reads the public repository and uploads a JSON git-diff package to a Google Cloud Storage bucket. Our collector creates a maintainer-owned branch and PR. Storage is infrastructure for the independent Scripture for Everyone initiative; it does not make the project a Google, YouVersion or Life.Church project.

This is a POC, not a production launch or an unattended content-review service. It accepts bounded text changes; it does not execute submitted code, run submitted test commands or merge a contribution automatically.

## 1. Build in a public local clone

You need Git, Node.js 22+ and outbound HTTPS. There is no Google SDK installation, API key or contributor login.

```sh
git clone https://github.com/yvlabs/scripture-workshop.git
cd scripture-workshop
git switch -c contribution/short-description
BASE_REVISION=$(git rev-parse origin/main)
printf '%s\n' "$BASE_REVISION"
```

Keep `BASE_REVISION` and its printed full 40-character main revision: that is your `baseRevision`. Use the same value in metadata and the diff even if you later fetch upstream. The collector accepts an available base commit that is an ancestor of trusted main, then creates the proposed branch from that base. It does not silently rebase your patch; later main changes or merge conflicts need review. Read README.md, AGENTS.md and CONTRIBUTING.md, check existing tasks and claims, and make one useful bounded change. No remote fork or push is needed. If your product has no general runtime and insists on launching only against a connected repository, this route cannot add that capability to the product.

Shared project code belongs under `projects/<project-id>/`. For a new project, copy `templates/project/`, replace synthetic metadata, and include source, README, license and meaningful checks. Run `npm test`, `npm run validate` and the project's documented checks. Mission records belong in [Scripture for Everyone](https://github.com/yvlabs/scripture-for-everyone).

Run the checks appropriate to your change and record what actually happened. No Platform App Key is needed for synthetic tests. Do not invent a passing result or bundle live Scripture, credentials or private source material.

## 2. Package the actual changes

Stage only intended files so new files appear in the diff. The diff below includes staged and unstaged tracked changes relative to the recorded base; check it for unintended edits. Keep the generated patch and metadata outside the repository.

```sh
git add PATH_TO_INTENDED_FILE OTHER_INTENDED_FILE
git diff --no-ext-diff "$BASE_REVISION" -- . > /tmp/scripture-contribution.diff
```

Write `/tmp/scripture-contribution-metadata.json` using this shape. Replace the base placeholder with the revision printed in step 1; supply your public credit/contact and a concrete title/summary. Link any selected task or previous PR in the summary. Replace the example test entry with actual results, including `not-run` where applicable.

```json
{
  "targetRepository": "yvlabs/scripture-workshop",
  "baseRevision": "REPLACE_WITH_40_HEX_CHARACTERS_FROM_ORIGIN_MAIN",
  "title": "Describe the specific contribution",
  "summary": "Explain the change, evidence, task link and important limitations.",
  "contributor": {
    "name": "Your public name or pseudonym",
    "contact": "https://example.com/your-public-profile"
  },
  "rights": "I have permission to publish these files under their stated licenses and offer my original contributions under this repository's contribution licenses.",
  "testResults": [
    {
      "command": "Describe the check",
      "result": "not-run",
      "notes": "Explain what remains untested."
    }
  ]
}
```

Only publish a contact you are entitled to share. An HTTPS profile or email address is acceptable. Identity and test-result fields are contributor declarations, not verified identity or independently run tests. Results are `passed`, `failed` or `not-run`.

```sh
node scripts/submit.mjs pack \
  /tmp/scripture-contribution-metadata.json \
  /tmp/scripture-contribution.diff \
  /tmp/scripture-contribution.json
```

The packer adds a fresh submission UUID and format version, validates the envelope and rejects unsupported patch content. Packing is not uploading. Inspect the source files and metadata before delivery.

## 3. Upload and retrieve the result

```sh
node scripts/submit.mjs upload /tmp/scripture-contribution.json
```

The uploader reads the public bucket settings from `submission-config.json` in the repository root; this file contains endpoint names, not credentials. Run the command from that root.

A successful upload reports `received`, the submission ID, exact uploaded JSON SHA-256 and public receipt URL. Preserve those values. The upload has reached the queue; it does not yet mean a branch, PR, review or acceptance exists. Do not report delivery when the command fails.

The object name is `incoming/scripture-workshop/<submission-id>.json`. Each ID is new and the uploader uses a create-only condition; it does not overwrite an earlier submission. The contributor does not need permission to list or read the incoming queue.

The receipt URL is:

```text
https://storage.googleapis.com/creativetech-scripture-receipts-poc-20261007/receipts/scripture-workshop/<submission-id>.json
```

Use the ID returned by the uploader:

```sh
node scripts/submit.mjs status SUBMISSION_UUID
```

A missing receipt (HTTP 404) means pending collection, not a failed upload. When processed, `imported` identifies the created PR and head revision; `rejected` supplies a reason. For an imported receipt, match its submission hash to the upload hash. Return the actual PR URL only after the receipt or GitHub shows it, and inspect that PR for the intended files. A receipt and passing mechanical checks do not imply approval.

## Limits and review

The POC permits only UTF-8 regular text files: at most 200 changes, 64 KiB per file, a 2 MiB patch and a 4 MiB JSON envelope. Paths are bounded to 240 characters and eight segments. No binary files, symlinks, `.git/`, `.github/`, `node_modules/`, `vendor/` or `staging/`. Do not split oversized work to bypass limits; discuss an appropriate delivery route instead.

The collector validates metadata, size, paths and patch application using trusted code. Public credit, declared checks and the exact submission hash travel into the PR. It does not trust metadata as shell instructions, execute candidate code or merge it. Content, Scripture handling, rights and maintenance need separate maintainer review. Automated filtering is not proof that a submission is safe or correctly licensed.

POC revisions use a new package, new submission ID and new PR. Link the earlier PR in the new summary; this version does not update an existing PR in place or provide an authenticated conversation endpoint. Read public PR feedback when next active. If you lack comment access, describe your response in the revision summary. Do not claim ongoing monitoring unless actually configured.

## Operating status

Verified October 7, 2026: an anonymous upload from a fresh local clone produced a [synthetic test PR](https://github.com/yvlabs/scripture-workshop/pull/1) in a [hosted collector run](https://github.com/yvlabs/scripture-workshop/actions/runs/37632206941). The uploaded JSON hash matched the public receipt, and the PR contained only the intended synthetic file. A [repeat run](https://github.com/yvlabs/scripture-workshop/actions/runs/37632487806) processed zero submissions and created no duplicate PR. Hosted repository checks passed 45 tests. An invalid submission also received a rejection receipt in the mission repository. No external contribution or reader outcome is claimed.

Polling is configured every 15 minutes at minutes 7, 22, 37 and 52 UTC. Manual hosted execution is verified; the first scheduled execution has not yet been observed. Scheduled Actions can be delayed, so a processing receipt and PR are asynchronous. Content review remains supervised; candidate code is not executed or merged by intake.

Incoming uploads expire under a seven-day storage lifecycle; processed receipts expire after 30 days. Lifecycle deletion is asynchronous. The POC uses the operator-authorized `creativetech` Google Cloud project and its existing billing. Usage charges are possible; actual charges have not been measured. There is no contributor charge or account setup.

If upload is unavailable, preserve work and state the exact missing capability. A GitHub fork and PR remain optional for an already connected, authorized contributor. An explicitly chosen manual relay is also available; neither local files nor a package handed back in chat prove the maintainer received it.
