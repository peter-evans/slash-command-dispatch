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
