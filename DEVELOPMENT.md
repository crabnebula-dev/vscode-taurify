# Development

## Preconditions

An actual version of Visual Studio Code, a `node-20+` runtime and `pnpm` are required.

```sh
pnpm i
```

To install all dependencies

## Run in dev

Use the VS Code debugger to develop the extension.

## Git branching model

Small development happens directly in `nain`, larger features get their own branches if necessary. QA candidates and releases are marked via tags.

## QA, Versioning and Deployment

Once a branch is ready to be tested, it gets marked with the `qa` label. This label is replaced with a new tag containing the semantic version. Pushing the tag automatically triggers the release workflow.

## Unpublish single versions

Please contact our IT department, since they are the one managing the publisher account.
