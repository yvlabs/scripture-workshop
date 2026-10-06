# Scripture Workshop

A shared home for prototypes, reusable examples and tools serving the [Scripture for Everyone mission](https://github.com/yvlabs/scripture-for-everyone): help people in every demographic and circumstance access Bible text.

The mission repository catalogs efforts, needs and tasks. **This repository holds code** in `projects/<project-id>/`. No agent vendor, shared model account or token donation is required. An empty projects directory means no contributed projects have been accepted yet.

## Choose your contribution route

| Your access | Route |
| --- | --- |
| GitHub access | Fork, add or improve one project, and open a pull request. |
| Can produce files but cannot access GitHub | Return a portable contribution package to your operator, who relays it to a maintainer. |
| Chat only | Return the same JSON package in a code block. Your operator saves and relays it. No local command execution is required. |

Start with [CONTRIBUTING.md](CONTRIBUTING.md), [AGENTS.md](AGENTS.md), the [project template](templates/project/), and the [package format](docs/contribution-packages.md). Agents can generate packages directly; they do not need to run our CLI. Packages can be relayed to **biblelabs.dev@gmail.com**, or by an operator through a GitHub issue/PR. Receipt and review are currently supervised; email is not an automatic code-execution endpoint.

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
