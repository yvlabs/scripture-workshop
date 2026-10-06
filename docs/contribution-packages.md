# Portable contribution packages, version 1

The default workflow now requires GitHub fork-and-PR access checked before building. This guide remains available when the operator explicitly chooses manual relay. A generated package is not proof that the contribution reached the maintainer.

A package is one UTF-8 JSON file containing one complete project snapshot. It can be produced by any agent, attached as a file, or returned as a JSON code block for an operator to save. No GitHub account, repository integration or command runner is required to produce it. A shared repository does not give an agent network or GitHub permissions.

## Build a package

Copy [submission-metadata.json](../examples/submission-metadata.json), set the project ID and your public contributor credit/contact, record permission to publish, and report actual tests. `baseRevision` is null for a new project, or the full 40-character workshop main commit SHA for an update. Get that SHA from your operator if you cannot read GitHub. Unknown base revisions cannot be safely integrated as updates.

A complete package has exactly those metadata fields plus `files`, an array of objects with exactly `path`, `sha256` (lowercase SHA-256 of the UTF-8 content) and `content` (the complete text). Paths are relative to the project, such as `src/main.js`; never include `projects/your-id/` in package paths. JSON-escape newlines inside content strings. If your environment cannot compute hashes, return files plus metadata to your operator; they can run the packer. Do not invent hashes or claim validation passed.

```sh
node scripts/package.mjs pack templates/project examples/submission-metadata.json /tmp/demo.submission.json
node scripts/package.mjs validate /tmp/demo.submission.json
node scripts/package.mjs stage /tmp/demo.submission.json /tmp/workshop-review-001
```

Each output path must be new. Run against a clean source folder: dependency directories, binaries, credentials and archives do not belong in it. Node 22+ is sufficient; no installation is needed. `project.json`, `README.md` and `LICENSE` are required. The [template](../templates/project/) is executable but synthetic and is not an accepted project.

## Limits and semantics

Maximum 4 MiB JSON, 200 files, 64 KiB per file, 2 MiB combined content, 8 path segments, 240 path characters. UTF-8 text only; no symlinks, special files, null bytes, absolute paths, traversal, dot directories, node_modules, vendor directories or case-colliding paths. `.gitignore` is the only allowed leading-dot name. Executable permission bits are not carried; a maintainer can review them separately. For larger/binary projects, discuss a normal PR and source/rights review rather than circumventing limits.

The snapshot is not a patch and is never applied automatically over an existing project. A maintainer compares it with `projects/<project-id>/` at baseRevision, inspects additions/changes/deletions, checks for changes since that base and integrates into a branch. A missing file in an update proposes deletion and must be reviewed. Packages cannot modify root tooling, workflows or other projects; propose infrastructure changes separately through a maintainer.

SHA-256 detects content mismatches; it does not prove authorship, safety or rights. The credential detector catches only obvious patterns. Contributors and maintainers must inspect for other secrets, private data and licensing problems. Metadata and test commands are descriptions, never instructions to the importer.

## Relay and attribution

Return the package to your operator with a short purpose and any mission task/effort link. They may send it to biblelabs.dev@gmail.com or open a GitHub issue linking/attaching it. Chat-only agents may return individual files and metadata for an operator to package. Review and email receipt are supervised; there is no automated inbox importer or guaranteed cadence.

The maintainer records public contributor credit, the package SHA-256, source/relay context (without private conversation text), declared test results and independently verified results in the PR. Unknown identity stays unknown. No fabricated co-author email. Revisions use a new package and renewed exact-commit review. Rejected submissions receive a concrete reason when a reply route is available.
