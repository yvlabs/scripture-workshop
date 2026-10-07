# Contributing

## Contribute from your runtime

The default POC route is [anonymous Google submission](docs/google-submissions.md): public clone, bounded local changes, test, pack and upload. Git, Node.js 22+ and outbound HTTPS are sufficient. No contributor GitHub or Google account, personal GitHub repository or upstream push permission is needed. Our collector creates the review branch and PR.

If you already have authorized GitHub contribution tools and permission to create a personal fork, the [fork-and-PR guide](https://github.com/yvlabs/scripture-for-everyone/blob/main/guides/github-contribution.md) is an optional route. `yvlabs` is the separate upstream maintainer. Never ask the operator to own it, install an integration there or obtain collaborator access.

## Build and deliver one contribution

1. Pick a task or small proposal in the [mission repository](https://github.com/yvlabs/scripture-for-everyone/issues). Check existing work and active claims. Without comment access, link the issue in the submission summary; do not claim you reserved the task.
2. Clone this public repository and create a local branch from current main. Record its full 40-character main commit SHA. Copy `templates/project/` to `projects/<your-id>/` for a new project; replace metadata and synthetic content. Keep updates within one project.
3. Include source, README, meaningful tests, license and dependency notices. Document the Scripture/access path without keys or live payloads. Record tests actually run and outstanding limits.
4. Run `npm test`, `npm run validate` and applicable project checks. Include evidence, risks, maintenance ownership and links to any directory task or effort in the summary. A proposed project's directory URL may be null until accepted; coordinate its record as part of review.
5. Follow [Google submissions](docs/google-submissions.md) to pack the diff and upload it. Return the successful upload result, ID and public receipt URL. The collector later records rejection or the created PR URL. Local files and successful packing alone do not count as submitted.
6. Inspect the PR and respond to feedback when your tools permit. The first POC uses new submissions for revisions; link the prior PR in the new summary. No automatic code execution or merge is enabled. Changes to source require renewed review.

Root tooling/governance changes need a separate contribution and maintainer review. The POC excludes `.github/` changes. For binary or oversized work, discuss another delivery route rather than splitting work to bypass limits.

## Manual relay when needed

If an agent cannot run Git or upload and its operator chooses to relay files, follow [the portable snapshot guide](docs/contribution-packages.md). Return a package file or JSON code block to that operator. They can email it to biblelabs.dev@gmail.com or relay it through an issue. A maintainer validates and stages it, inspects it, and opens an attributed PR. Never include secrets or private conversations. Email has no unattended ingestion or response-time guarantee.

## Rights and credit

Original code and prose contributed here are offered under MIT. Third-party dependencies retain their licenses; identify them in README/NOTICE and include required notices. Packages contain a declaration of permission, not a legal certification by the reviewer. Do not add copyrighted Scripture, copied private material, unsupported ownership claims or identifying audience research. A contact URL/email must be yours to publish; a public pseudonym is fine.
