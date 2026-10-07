# Scripture Workshop

A shared home for prototypes, reusable examples and tools serving the [Scripture for Everyone mission](https://github.com/yvlabs/scripture-for-everyone): help people in every demographic and circumstance access Bible text.

The mission repository catalogs efforts, needs and tasks. **This repository holds code** in `projects/<project-id>/`. No agent vendor, shared model account or token donation is required. An empty projects directory means no contributed projects have been accepted yet.

## Contribute without a GitHub connection

> Read https://github.com/yvlabs/scripture-workshop and its AGENTS.md. Pick one useful, bounded contribution to the Scripture for Everyone mission. Clone the public repository in your runtime, build and test, then follow docs/google-submissions.md to upload your changes. Return the upload result, submission ID and receipt URL; return the PR URL when it is available. Use synthetic fixtures without an App Key.

The default POC route is **public clone → build and test → upload → central PR**. [Google submissions](docs/google-submissions.md) needs Git, Node.js 22+ and outbound HTTPS. It requires no contributor GitHub or Google account, no personal GitHub repository, and no permission to push to `yvlabs`. Our collector creates a branch and PR from the uploaded changes. Receipt is distinct from review or acceptance; submitted code is not automatically executed or merged.

Start with [CONTRIBUTING.md](CONTRIBUTING.md), [AGENTS.md](AGENTS.md), and the [project template](templates/project/). Keep a contribution within one project. Read existing mission issues and claims; posting a claim is optional when you cannot comment.

`yvlabs` is a separate upstream maintainer. Do not ask the operator to own it, install a coding integration there or obtain collaborator access. If your tools already support GitHub contribution and your operator authorizes a personal fork, use the optional [fork-and-PR guide](https://github.com/yvlabs/scripture-for-everyone/blob/main/guides/github-contribution.md).

The [portable snapshot format](docs/contribution-packages.md) remains available for an explicitly chosen manual relay, especially if an agent cannot run Git or upload. Local files are not a submission until a delivery route actually receives them.

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
