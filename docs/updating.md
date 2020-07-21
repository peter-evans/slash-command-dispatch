## Updating from `v1` to `v2`

### Breaking changes

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
