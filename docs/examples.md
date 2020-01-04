# Examples

This document details command patterns and examples.

- [Use case: Execute command using a specific repository branch](#execute-command-using-a-specific-repository-branch)
- [Use case: Execute command to modify a pull request branch](#execute-command-to-modify-a-pull-request-branch)

## Use case: Execute command using a specific repository branch

This is pattern for a slash command where the first argument is the branch to checkout. If no argument is given it defaults to `master`. For example, the following command will cause the command workflow to checkout the `develop` branch of the repository where the command was dispatched from. After the branch has been checked out in the command workflow, scripts or actions may be executed against it.

```
/do-something develop
```

In the following command workflow, `REPO_ACCESS_TOKEN` is a `repo` scoped [Personal Access Token](https://help.github.com/en/github/authenticating-to-github/creating-a-personal-access-token-for-the-command-line).

```yml
name: do-something-command
on:
  repository_dispatch:
    types: [do-something-command]
jobs:
  doSomething:
    runs-on: ubuntu-latest
    steps:
      # Get the branch name
      - name: Get the target branch name
        id: vars
        run: |
          branch=${{ github.event.client_payload.slash_command.arg1 }}
          if [[ -z "$branch" ]]; then branch="master"; fi
          echo ::set-output name=branch::$branch

      # Checkout the branch to test
      - uses: actions/checkout@v2
        with:
          token: ${{ secrets.REPO_ACCESS_TOKEN }}
          repository: ${{ github.event.client_payload.github.payload.repository.full_name }}
          ref: ${{ steps.vars.outputs.branch }}

      # Execute scripts or actions
      - name: Do something
        run: echo "Do something"

      # Add reaction to the comment
      - name: Add reaction
        uses: peter-evans/create-or-update-comment@v1
        with:
          token: ${{ secrets.REPO_ACCESS_TOKEN }}
          repository: ${{ github.event.client_payload.github.payload.repository.full_name }}
          comment-id: ${{ github.event.client_payload.github.payload.comment.id }}
          reaction-type: hooray
```

## Use case: Execute command to modify a pull request branch

This is pattern for a slash command used in pull request comments. It checks out the pull request branch and allows further script and action steps to modify it.

```
/fix-pr
```

In the following command workflow, `REPO_ACCESS_TOKEN` is a `repo` scoped [Personal Access Token](https://help.github.com/en/github/authenticating-to-github/creating-a-personal-access-token-for-the-command-line).

```yml
name: fix-pr-command
on:
  repository_dispatch:
    types: [fix-pr-command]
jobs:
  fixPr:
    runs-on: ubuntu-latest
    steps:
      # Checkout the pull request branch
      - uses: actions/checkout@v2
        with:
          token: ${{ secrets.REPO_ACCESS_TOKEN }}
          repository: ${{ github.event.client_payload.pull_request.head.repo.full_name }}
          ref: ${{ github.event.client_payload.pull_request.head.ref }}

      # Commit changes to the PR branch
      - name: Commit changes to the PR branch
        run: |
          # Make changes to commit here
          #
          git config --global user.name 'actions-bot'
          git config --global user.email '58130806+actions-bot@users.noreply.github.com'
          git commit -am "[fix-pr-command] fixes"
          git push

      - name: Add reaction
        uses: peter-evans/create-or-update-comment@v1
        with:
          token: ${{ secrets.REPO_ACCESS_TOKEN }}
          repository: ${{ github.event.client_payload.github.payload.repository.full_name }}
          comment-id: ${{ github.event.client_payload.github.payload.comment.id }}
          reaction-type: hooray
```
