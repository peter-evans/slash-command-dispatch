## Updating from `v3` to `v4`

### Breaking changes

- If using self-hosted runners or GitHub Enterprise Server, there are minimum requirements for `v4` to run. See "What's new" below for details.

### What's new

- Updated runtime to Node.js 20
  - The action now requires a minimum version of [v2.308.0](https://github.com/actions/runner/releases/tag/v2.308.0) for the Actions runner. Update self-hosted runners to v2.308.0 or later to ensure compatibility.

## Updating from `v2` to `v3`

### Breaking changes

- If using self-hosted runners or GitHub Enterprise Server, there are minimum requirements for `v3` to run. See "What's new" below for details.

### What's new

- Updated runtime to Node.js 16
  - The action now requires a minimum version of v2.285.0 for the [Actions Runner](https://github.com/actions/runner/releases/tag/v2.285.0).
  - If using GitHub Enterprise Server, the action requires [GHES 3.4](https://docs.github.com/en/enterprise-server@3.4/admin/release-notes) or later.

## Updating from `v1` to `v2`

### Breaking changes

- The format of the `slash_command` context has been changed to prevent an issue where named arguments can overwrite other properties of the payload.

  The following diff shows how the `slash_command` context has changed for the example command `/deploy branch=main smoke-test dry-run reason="new feature"`.

  ```diff
    "slash_command": {
        "command": "deploy",
  -     "args": "branch=main smoke-test dry-run reason=\"new feature\"",
  -     "unnamed_args": "smoke-test dry-run",
  -     "arg1": "smoke-test",
  -     "arg2": "dry-run"
  -     "branch": "main",
  -     "reason": "new feature"
  +     "args": {
  +         "all": "branch=main smoke-test dry-run reason=\"new feature\"",
  +         "unnamed": {
  +             "all": "smoke-test dry-run",
  +             "arg1": "smoke-test",
  +             "arg2": "dry-run"
  +         },
  +         "named": {
  +             "branch": "main",
  +             "reason": "new feature"
  +         },
  +     }
    }
  ```

- The `named-args` input (standard configuration) and `named_args` JSON property (advanced configuration) have been removed. Named arguments will now always be parsed and added to the `slash_command` context.

- The `client_payload.github.payload.issue.body` and `client_payload.pull_request.body` context properties will now be truncated if they exceed 1000 characters.

### New features

- Commands can now be dispatched via the new [workflow_dispatch](https://docs.github.com/en/actions/reference/events-that-trigger-workflows#workflow_dispatch) event. For standard configuration, set the new `dispatch-type` input to `workflow`. For advanced configuration, set the `dispatch_type` JSON property of a command to `workflow`.
  There are significant differences in the action's behaviour when using `workflow` dispatch. See [workflow dispatch](workflow-dispatch.md) for usage details.

- Added a new input `static-args` (standard configuration), and a new JSON property `static_args` (advanced configuration). This is a list of arguments that will always be dispatched with commands.

  Standard configuration:
  ```yml
          static-args: |
            production
            region=us-east-1
  ```
  Advanced configuration:
  ```json
          "static_args": [
            "production",
            "region=us-east-1"
          ]
  ```

- Slash command arguments can now be double-quoted to allow for argument values containing spaces.

  e.g.
  ```
  /deploy branch=main dry-run reason="new feature"
  ```
  ```
  /send "hello world!"
  ```

- The `commands` input can now be newline separated, or comma-separated.

  e.g.
  ```yml
          commands: |
            deploy
            integration-test
            build-docs
  ```
