# Advanced configuration

## What is advanced configuration?

Due to the limitations of YAML based action inputs, basic configuration is not adequate to support unique configuration *per command*.

For example, the following basic configuration means that all commands must have the same `admin` permission.

```yml
      - name: Slash Command Dispatch
        uses: peter-evans/slash-command-dispatch@v4
        with:
          token: ${{ secrets.PAT }}
          commands: |
            deploy
            integration-test
            build-docs
          permission: admin
```

To solve this issue, advanced JSON configuration allows each command to be configured individually.

## Dispatching commands

There are two ways to specify JSON configuration for command dispatch. Directly in the workflow via the `config` input, OR, specifying a JSON config file via the `config-from-file` input.

**Note**: It is recommended to write the JSON configuration directly in the workflow rather than use a file. Using the `config-from-file` input will be slightly slower due to requiring the repository to be checked out with `actions/checkout` so the file can be accessed.

Here is a reference example workflow. Take care to use the correct [JSON property names](#advanced-action-inputs).

```yml
name: Slash Command Dispatch
on:
  issue_comment:
    types: [created]
jobs:
  slashCommandDispatch:
    runs-on: ubuntu-latest
    steps:
      - name: Slash Command Dispatch
        uses: peter-evans/slash-command-dispatch@v4
        with:
          token: ${{ secrets.PAT }}
          config: >
            [
              {
                "command": "rebase",
                "permission": "admin",
                "issue_type": "pull-request",
                "repository": "peter-evans/slash-command-dispatch-processor"
              },
              {
                "command": "integration-test",
                "permission": "write",
                "issue_type": "both",
                "repository": "peter-evans/slash-command-dispatch-processor",
                "static_args": [
                  "production",
                  "region=us-east-1"
                ]
              },
              {
                "command": "create-ticket",
                "permission": "write",
                "issue_type": "issue",
                "allow_edits": true,
                "event_type_suffix": "-cmd",
                "dispatch_type": "workflow"
              }
            ]
```

The following workflow is an example using the `config-from-file` input to set JSON configuration.
Note that `actions/checkout` is required to access the file.

```yml
name: Slash Command Dispatch
on:
  issue_comment:
    types: [created]
jobs:
  slashCommandDispatch:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Slash Command Dispatch
        uses: peter-evans/slash-command-dispatch@v4
        with:
          token: ${{ secrets.PAT }}
          config-from-file: .github/slash-command-dispatch.json
```

## Advanced action inputs

Advanced configuration requires a combination of YAML based inputs and JSON configuration.

| Input | JSON Property | Description | Default |
| --- | --- | --- | --- |
| `token` | | (**required**) A `repo` scoped [Personal Access Token (PAT)](https://docs.github.com/en/github/authenticating-to-github/creating-a-personal-access-token). Note: `GITHUB_TOKEN` *does not* work here. See [token](https://github.com/peter-evans/slash-command-dispatch#token) for further details. | |
| `reaction-token` | | `GITHUB_TOKEN` or a `repo` scoped [Personal Access Token (PAT)](https://docs.github.com/en/github/authenticating-to-github/creating-a-personal-access-token). See [reaction-token](https://github.com/peter-evans/slash-command-dispatch#reaction-token) for further details. | `GITHUB_TOKEN` |
| `reactions` | | Add reactions. :eyes: = seen, :rocket: = dispatched | `true` |
| | `command` | (**required**) The slash command. | |
| | `permission` | The repository permission level required by the user to dispatch the command. (`none`, `read`, `triage`, `write`, `maintain`, `admin`) | `write` |
| | `issue_type` | The issue type required for the command. (`issue`, `pull-request`, `both`) | `both` |
| | `allow_edits` | Allow edited comments to trigger command dispatches. | `false` |
| | `repository` | The full name of the repository to send the dispatch events. | Current repository |
| | `event_type_suffix` | The repository dispatch event type suffix for the command. | `-command` |
| | `static_args` | A string array of arguments that will be dispatched with the command. | `[]` |
| | `dispatch_type` | The dispatch type; `repository` or `workflow`. | `repository` |
| `config` | | JSON configuration for commands. | |
| `config-from-file` | | JSON configuration from a file for commands. | |
