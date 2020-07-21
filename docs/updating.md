## Updating from `v1` to `v2`

### Breaking changes

- The format of the `slash_command` context has been changed to prevent an issue where named arguments can overwrite other properties of the payload.

  The following is an example of the new `slash_command` context. The slash command `/deploy branch=master env=prod some other args` will be converted to a JSON payload as follows.

  ```json
      "slash_command": {
          "command": "deploy",
          "args": {
              "all": "branch=master env=prod some other args",
              "unnamed": {
                  "all": "some other args",
                  "arg1": "some",
                  "arg2": "other",
                  "arg3": "args"
              },
              "named": {
                  "branch": "master",
                  "env": "prod"
              },
          }
      }
  ```

- The `named-args` input (standard configuration) and `named_args` JSON property (advanced configuration) have been removed. Named arguments will now always be parsed and added to the `slash_command` context.

- The `client_payload.github.payload.issue.body` and `client_payload.pull_request.body` context properties will now be truncated if they exceed 1000 characters.

### New features

- The `commands` input can now be newline separated, or comma separated.

  e.g.
  ```yml
          commands: |
            deploy
            integration-test
            build-docs
  ```

- Added a new input `static-args` (standard configuration), and a new JSON property `static_args` (advanced configuration). This is a list of arguments that will always be dispatched with commands.

  Standard configuration:
  ```yml
          static-args: |
            production
            region=us-east-1
  ```
  Advanced configuration:
  ```yml
          "static_args": [
            "production",
            "region=us-east-1"
          ]
  ```
