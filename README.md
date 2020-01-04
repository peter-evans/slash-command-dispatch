# Slash Command Dispatch
[![GitHub Marketplace](https://img.shields.io/badge/Marketplace-Slash%20Command%20Dispatch-blue.svg?colorA=24292e&colorB=0366d6&style=flat&longCache=true&logo=data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA4AAAAOCAYAAAAfSC3RAAAABHNCSVQICAgIfAhkiAAAAAlwSFlzAAAM6wAADOsB5dZE0gAAABl0RVh0U29mdHdhcmUAd3d3Lmlua3NjYXBlLm9yZ5vuPBoAAAERSURBVCiRhZG/SsMxFEZPfsVJ61jbxaF0cRQRcRJ9hlYn30IHN/+9iquDCOIsblIrOjqKgy5aKoJQj4O3EEtbPwhJbr6Te28CmdSKeqzeqr0YbfVIrTBKakvtOl5dtTkK+v4HfA9PEyBFCY9AGVgCBLaBp1jPAyfAJ/AAdIEG0dNAiyP7+K1qIfMdonZic6+WJoBJvQlvuwDqcXadUuqPA1NKAlexbRTAIMvMOCjTbMwl1LtI/6KWJ5Q6rT6Ht1MA58AX8Apcqqt5r2qhrgAXQC3CZ6i1+KMd9TRu3MvA3aH/fFPnBodb6oe6HM8+lYHrGdRXW8M9bMZtPXUji69lmf5Cmamq7quNLFZXD9Rq7v0Bpc1o/tp0fisAAAAASUVORK5CYII=)](https://github.com/marketplace/actions/slash-command-dispatch)

A GitHub action that facilitates ["ChatOps"](https://www.pagerduty.com/blog/what-is-chatops/) by creating repository dispatch events for slash commands.

### How does it work?

The action runs in `issue_comment` event workflows and checks comments for slash commands.
When a valid command is found it creates a repository dispatch event that includes a payload containing full details of the command and its context.

### Why repository dispatch?

"ChatOps" with slash commands can work in a basic way by parsing the commands during `issue_comment` events and immediately processing the command.
In repositories with a lot of activity, the workflow queue will get backed up very quickly if it is trying to handle new comments for commands *and* process the commands themselves.

Dispatching commands to be processed elsewhere keeps the workflow queue moving quickly. It essentially enables parallel processing of workflows.

### Demo and examples

The best way to understand how this works is to try it out for yourself.
Check out the following demos.

- [ChatOps Demo in Issues](https://github.com/peter-evans/slash-command-dispatch/issues/3)
- [ChatOps Demo in Pull Requests](https://github.com/peter-evans/slash-command-dispatch/pull/8)
- [Slash command code formatting - Python](https://github.com/peter-evans/slash-command-dispatch/pull/11)

See [examples](docs/examples.md) for command patterns and example workflows.

## Dispatching commands

### Configuration

The following workflow should be configured in the repository where commands will be dispatched from. This example will respond to comments containing the slash commands `/rebase`, `/integration-test` and `/create-ticket`.

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
          commands: rebase, integration-test, create-ticket
```

This action also features [advanced configuration](docs/advanced-configuration.md) that allows each command to be configured individually if necessary. Use the standard configuration shown above unless you require advanced features.

### Action inputs

| Input | Description | Default |
| --- | --- | --- |
| `token` | (**required**) A `repo` scoped [PAT](https://help.github.com/en/github/authenticating-to-github/creating-a-personal-access-token-for-the-command-line). | |
| `reaction-token` | `GITHUB_TOKEN` or a `repo` scoped [PAT](https://help.github.com/en/github/authenticating-to-github/creating-a-personal-access-token-for-the-command-line). | |
| `reactions` | Add reactions. :eyes: = seen, :rocket: = dispatched | `true` |
| `commands` | (**required**) A comma separated list of commands. | |
| `permission` | The repository permission level required by the user to dispatch commands. (`none`, `read`, `write`, `admin`) | `write` |
| `issue-type` | The issue type required for commands. (`issue`, `pull-request`, `both`) | `both` |
| `allow-edits` | Allow edited comments to trigger command dispatches. | `false` |
| `repository` | The full name of the repository to send the dispatch events. | Current repository |
| `event-type-suffix` | The repository dispatch event type suffix for the commands. | `-command` |
| `named-args` | Parse named arguments and add them to the command payload. | `false` |
| `config` | | JSON configuration for commands. See [Advanced configuration](docs/advanced-configuration.md) | |
| `config-from-file` | | JSON configuration from a file for commands. See [Advanced configuration](docs/advanced-configuration.md) | |

### What is the reaction-token?

If you don't specify a token for `reaction-token` it will use the [PAT](https://help.github.com/en/github/authenticating-to-github/creating-a-personal-access-token-for-the-command-line) supplied via `token`.
This means that reactions to comments will appear to be made by the user account associated with the PAT. If you prefer to have the @github-actions bot user react to comments you can set `reaction-token` to `GITHUB_TOKEN`.

```yml
      - name: Slash Command Dispatch
        uses: peter-evans/slash-command-dispatch@v1
        with:
          token: ${{ secrets.REPO_ACCESS_TOKEN }}
          reaction-token: ${{ secrets.GITHUB_TOKEN }}
          commands: rebase, integration-test, create-ticket
```

## Handling dispatched commands

### Event types

Repository dispatch events have a `type` to distinguish between events. The `type` set by the action is a combination of the slash command and `event-type-suffix`. The `event-type-suffix` input defaults to `-command`.

For example, if your slash command is `integration-test`, the event type will be `integration-test-command`.

```yml
on:
  repository_dispatch:
    types: [integration-test-command]
```

### Accessing contexts

Commands are dispatched with a payload containing a number of contexts.

#### `slash_command` context

The slash command context can be accessed as follows.
`args` is a space separated string of all the supplied arguments.
Each argument is also supplied in a numbered property, i.e. `arg1`, `arg2`, `arg3`, etc. 

```yml
      - name: Output command and arguments
        run: |
          echo ${{ github.event.client_payload.slash_command.command }}
          echo ${{ github.event.client_payload.slash_command.args }}
          echo ${{ github.event.client_payload.slash_command.arg1 }}
          echo ${{ github.event.client_payload.slash_command.arg2 }}
          echo ${{ github.event.client_payload.slash_command.arg3 }}
          # etc.
```

If the `named-args` input is set to `true`, any arguments that are prefixed in the format `name=argument` will be parsed and added to the payload.

For example, the slash command `/deploy branch=master env=prod some other args` will be set in the JSON payload as follows.

```json
    "slash_command": {
        "command": "deploy",
        "args": "branch=master env=prod some other args",
        "unnamed_args": "some other args",
        "branch": "master",
        "env": "prod",
        "arg1": "some",
        "arg2": "other",
        "arg3": "args"
    }
```

These named arguments can be accessed in a workflow as follows.

```yml
      - name: Output command and named arguments
        run: |
          echo ${{ github.event.client_payload.slash_command.command }}
          echo ${{ github.event.client_payload.slash_command.branch }}
          echo ${{ github.event.client_payload.slash_command.env }}
          echo ${{ github.event.client_payload.slash_command.unnamed_args }}
```

#### `github` and `pull_request` contexts

The payload contains the complete `github` context of the `issue_comment` event at path `github.event.client_payload.github`.
Additionally, if the comment was made in a pull request, the action calls the [GitHub API to fetch the pull request detail](https://developer.github.com/v3/pulls/#get-a-single-pull-request) and attach it to the payload at path `github.event.client_payload.pull_request`.

You can inspect the payload with the following step.
```yml
      - name: Dump the client payload context
        env:
          PAYLOAD_CONTEXT: ${{ toJson(github.event.client_payload) }}
        run: echo "$PAYLOAD_CONTEXT"
```

### Responding to the comment on command completion

Using [create-or-update-comment](https://github.com/peter-evans/create-or-update-comment) action there are a number of ways you can respond to the comment once the command has completed.

The simplest response is to add a :tada: reaction to the comment.

```yml
      - name: Add reaction
        uses: peter-evans/create-or-update-comment@v1
        with:
          token: ${{ secrets.REPO_ACCESS_TOKEN }}
          repository: ${{ github.event.client_payload.github.payload.repository.full_name }}
          comment-id: ${{ github.event.client_payload.github.payload.comment.id }}
          reaction-type: hooray
```

## License

[MIT](LICENSE)
