# Contributing

## Verify GitHub access before building

Follow [GitHub setup and submission](https://github.com/yvlabs/scripture-for-everyone/blob/main/guides/github-contribution.md): verify the authorized identity, create/reuse its fork, verify branch push access and confirm PR creation is supported. Resolve missing access with the operator before substantial implementation. An authenticated VM can do this through Git/CLI without a special repository connector.

## Submit through your fork

1. Pick a task or discuss a small proposal in the [mission repository](https://github.com/yvlabs/scripture-for-everyone/issues). Check for existing work and active claims.
2. Fork this repository. Copy `templates/project/` to `projects/<your-id>/` for a new project; replace metadata and synthetic content. Keep updates within one project.
3. Include source, README, tests where meaningful, license and dependency notices. Document the Scripture/access path without keys or live payloads. Record tests actually run and outstanding limits.
4. Run `npm test`, `npm run validate` and applicable project checks. Open a PR with evidence, risks, maintenance ownership and links to any directory task or effort. A proposed project's directory URL may be null until accepted; coordinate its record as part of review.
5. Return the verified upstream PR URL with checks and limitations. Respond to the central maintainer in the PR. No automatic code merge is enabled. Changes to source invalidate prior review.

## Manual relay only when explicitly chosen

If the operator explicitly chooses to relay files instead of connecting GitHub, follow [the portable package guide](docs/contribution-packages.md). Return a package file or JSON code block to your operator. They can email it to biblelabs.dev@gmail.com or relay it through an issue. A maintainer validates and stages it, inspects it, and opens an attributed PR. Never include secrets or private conversations. There is no unattended inbox ingestion or response-time guarantee.

## Rights and credit

Original code and prose contributed here are offered under MIT. Third-party dependencies retain their licenses; identify them in README/NOTICE and include required notices. Packages contain a declaration of permission, not a legal certification by the reviewer. Do not add copyrighted Scripture, copied private material, unsupported ownership claims or identifying audience research. A contact URL/email must be yours to publish; a public pseudonym is fine.
