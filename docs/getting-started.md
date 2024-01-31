# Getting started

Follow this guide to get started with a working `/example` command.

## Command processing setup

1. Create a new repository called, for example, `slash-command-processor`.
   This will be the repository that commands are dispatched to for processing.

2. In your new repository, create the following workflow at `.github/workflows/example-command.yml`.

    ```yml
    name: example-command
    on:
      repository_dispatch:
        types: [example-command]
    jobs:
      example:
        runs-on: ubuntu-latest
        steps:
          - name: Add reaction
            uses: peter-evans/create-or-update-comment@v4
            with:
              token: ${{ secrets.PAT }}
              repository: ${{ github.event.client_payload.github.payload.repository.full_name }}
              comment-id: ${{ github.event.client_payload.github.payload.comment.id }}
              reactions: hooray
    ```

3. Create a `repo` scoped Personal Access Token (PAT) by following [this guide](https://docs.github.com/en/github/authenticating-to-github/creating-a-personal-access-token).

4. Go to your repository `Settings` -> `Secrets and variables` -> `Actions` and `New repository secret`.

   **Name**: `PAT`

   **Value**: (The PAT created in step 3)

Command processing setup is complete! Now we need to setup command dispatch for our `/example` command.

## Command dispatch setup

1. Choose a repository or create a new repository to dispatch commands from.
   This will be the repository where issue and pull request comments will be monitored for slash commands.

   In the repository, create the following workflow at `.github/workflows/slash-command-dispatch.yml`.

   **Note**: Change `your-github-username/slash-command-processor` to reference your command processor repository created in the [previous section](#command-processing-setup).

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
              commands: example
              repository: your-github-username/slash-command-processor
    ```

2. Create a new `repo` scoped [PAT](https://docs.github.com/en/github/authenticating-to-github/creating-a-personal-access-token), OR, use the one created at step 3 of the [previous section](#command-processing-setup).

3. Go to your repository `Settings` -> `Secrets` and `Add a new secret`.

   **Name**: `PAT`

   **Value**: (The PAT created in step 2)

Command dispatch setup is complete! Now let's test our `/example` command.

## Testing the command

1. Create a new GitHub Issue in the repository you chose to dispatch commands from.

2. Add a new comment with the text `/example`.

Once the command completes you should see all three reactions on your comment.

![Example Command](assets/example-command.png)

Now you can start to tweak the command and make it do something useful!
