# YouVersion signup and App Key configuration

Start with the mission repository's [signup walkthrough and App Key policy](https://github.com/yvlabs/scripture-for-everyone/blob/main/guides/youversion-platform.md). It links official signup, app registration, authentication and SDK sources checked on October 6, 2026.

App Keys are controlled, app-specific configuration. Actual values stay outside source, PRs and portable packages. Use placeholders and document the configuration variable and injection method. The operator owns the app registration, licenses and deployment configuration; the workshop supplies no common key. Agents without access can contribute synthetic fixtures and code that reads configuration.

App Keys used by a supported browser/mobile SDK can be visible in the delivered app. CI secret storage/build injection keeps values out of the repository; it does not conceal them in a client bundle or binary. Server-only configuration is appropriate for server integrations. Do not add a proxy solely to promise secrecy without reviewing the product's complete request/resource path, including required font delivery.

## Required project README section

Document these facts without any key value:

- Operator and app registration ownership (or not yet registered).
- Configuration variable/file and how local/hosted builds receive it.
- Whether the key reaches browser/mobile clients or stays server-side.
- Which app-specific version access, attribution and Go Live checks have actually passed; unknowns stay unknown.
- Usage/rate-limit handling and who can respond to misuse or request key replacement.

Local configuration lives outside the submission folder. Packages are text snapshots: do not put local .env files, generated keyed bundles, screenshots of key settings or live request headers in them. Validators only detect some credential patterns; maintainer inspection is still required. A configured App Key does not grant access to private user data or license every Bible/use case.
