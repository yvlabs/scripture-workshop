# Scripture Workshop

## Fork first: yvlabs is the upstream maintainer

Treat `yvlabs` as a separate maintainer account. Your operator does not need to own it. Read-only access to the public upstream is expected and sufficient for the fork-and-PR workflow.

**Create or reuse a fork in the connected contributor's account before launching a repository-bound coding/cloud agent. Launch that agent on the contributor's fork, not on `yvlabs/...`.** If the integration requires repository selection or installation access, select/authorize the contributor-owned fork through the operator's supported flow.

Do not ask whether the operator owns `yvlabs`, suggest signing in as `yvlabs`, request collaborator/admin access, or propose installing/granting your coding integration access to `yvlabs`. An upstream write-access failure means you should use the fork workflow; it is not a reason to expand upstream permissions.

For example, if the connected account is `alice`, work in `alice/scripture-for-everyone` and submit from `alice:contribution/short-description` to `yvlabs/scripture-for-everyone:main`. For workshop code, use the equivalent `alice/scripture-workshop` fork. Replace `alice` with the verified connected identity; never assume the upstream owner is your contributor identity.

Handle fork creation and PR submission yourself when your authorized tools support them. Ask the operator only for a specific missing connection, fork permission or human-only approval. Do not present “grant access to yvlabs” as an option, and do not automatically delegate opening the PR to the operator.


A shared home for prototypes, reusable examples and tools serving the [Scripture for Everyone mission](https://github.com/yvlabs/scripture-for-everyone): help people in every demographic and circumstance access Bible text.

The mission repository catalogs efforts, needs and tasks. **This repository holds code** in `projects/<project-id>/`. No agent vendor, shared model account or token donation is required. An empty projects directory means no contributed projects have been accepted yet.

## Connect GitHub, then contribute

The default workflow is **fork → build and test → push → pull request**. First follow [GitHub setup and submission](https://github.com/yvlabs/scripture-for-everyone/blob/main/guides/github-contribution.md). Verify an authorized account can create/reuse a fork, push a contribution branch and open an upstream PR. The agent can handle the fork and work in its VM; the operator does not need to manually create a blank repo. No write access to this central repository is needed.

If access is missing, ask the operator to connect GitHub before substantial implementation. A public clone or read-only connector does not provide submission access. Return the actual upstream PR URL when finished, with checks and limitations.

Start with [CONTRIBUTING.md](CONTRIBUTING.md), [AGENTS.md](AGENTS.md), and the [project template](templates/project/). If the operator explicitly chooses manual relay, use the [package format](docs/contribution-packages.md) or an appropriate patch. Packages can be relayed to biblelabs.dev@gmail.com or through an issue/PR by the operator. This fallback requires a handoff; receipt and review remain supervised.

## Run the tools

Node.js 22 or newer, no dependencies or API keys:

```sh
npm test
npm run validate
node scripts/package.mjs validate contribution.json
node scripts/package.mjs stage contribution.json ./staging/review-001
```

The staging directory must not exist. Staging verifies bounded text files, paths, hashes and required metadata, then writes a review copy. It never installs dependencies, runs submitted commands or fetches links. Validation is not a security, licensing or cultural endorsement.

## What belongs here

Small prototypes, accessibility improvements, integration examples and shared tools. Keep each project's source, README, tests and maintenance information inside its directory. Projects may use different languages; there is no automatic recursive build across contributed projects.

Follow [signup and App Key configuration](docs/app-keys.md) before connecting a project. Use [YouVersion Platform guidance](https://github.com/yvlabs/scripture-for-everyone/blob/main/guides/youversion-platform.md) for Scripture. Verify app-specific access, preserve returned text and required attribution, and never commit Scripture payloads or keys. No generated Bible explanations, spiritual counsel or personalized verse recommendations. Audience needs are hypotheses until supported; a country, language or disability does not establish a uniform need.

[Production graduation](docs/graduation.md) gives each released app a separate repository, registration, credential and deployment boundary. Hosting code here does not launch a product or promise maintenance.

## Operation and rights

Operated independently by **Bibleinator Labs**, not affiliated with YouVersion or Life.Church. [Review and operating status](docs/review.md). Original contributions use [MIT](LICENSE); identify third-party rights in each project. Scripture is not licensed by this repository. Contribute only what you have permission to publish.
