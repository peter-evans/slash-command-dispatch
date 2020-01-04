# Advanced configuration

## What is advanced configuration?

Due to the limitations of yaml based action inputs, basic configuration is not adequate enough to support unique configuration *per command*.

For example, the following basic configuration means that all commands must have the same `admin` permission.

```yml
      - name: Slash Command Dispatch
        uses: peter-evans/slash-command-dispatch@v1
        with:
          token: ${{ secrets.REPO_ACCESS_TOKEN }}
          commands: rebase, integration-test, create-ticket
          permission: admin
```

To solve this issue, advanced JSON configuration allows each command to be configured individually.

## Dispatching commands

There are two ways to specify JSON configuration for command dispatch. Directly in the workflow via the `config` input, OR, specifing a JSON config file via the `config-from-file` input.

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
        uses: peter-evans/slash-command-dispatch@v1
        with:
          token: ${{ secrets.REPO_ACCESS_TOKEN }}
          reaction-token: ${{ secrets.GITHUB_TOKEN }}
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
                "named_args": true
              },
              {
                "command": "create-ticket",
                "permission": "write",
                "issue_type": "issue",
                "allow_edits": true,
                "event_type_suffix": "-cmd"
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
      - uses: actions/checkout@v2
      - name: Slash Command Dispatch
        uses: peter-evans/slash-command-dispatch@v1
        with:
          token: ${{ secrets.REPO_ACCESS_TOKEN }}
          config-from-file: .github/slash-command-dispatch.json
```

## Advanced action inputs

Advanced configuration requires a combination of yaml based inputs and JSON configuration.

| Input | JSON Property | Description | Default |
| --- | --- | --- | --- |
| `token` | | (**required**) A `repo` scoped [PAT](https://help.github.com/en/github/authenticating-to-github/creating-a-personal-access-token-for-the-command-line). | |
| `reaction-token` | | `GITHUB_TOKEN` or a `repo` scoped [PAT](https://help.github.com/en/github/authenticating-to-github/creating-a-personal-access-token-for-the-command-line). | |
| `reactions` | | Add reactions. :eyes: = seen, :rocket: = dispatched | `true` |
| | `command` | (**required**) The slash command. | |
| | `permission` | The repository permission level required by the user to dispatch commands. (`none`, `read`, `write`, `admin`) | `write` |
| | `issue_type` | The issue type required for commands. (`issue`, `pull-request`, `both`) | `both` |
| | `allow_edits` | Allow edited comments to trigger command dispatches. | `false` |
| | `repository` | The full name of the repository to send the dispatch events. | Current repository |
| | `event_type_suffix` | The repository dispatch event type suffix for the commands. | `-command` |
| | `named_args` | Parse named arguments and add them to the command payload. | `false` |
| `config` | | JSON configuration for commands. See [Advanced configuration](#advanced-configuration) | |
| `config-from-file` | | JSON configuration from a file for commands. See [Advanced configuration](#advanced-configuration) | |
