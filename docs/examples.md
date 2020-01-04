# Examples

- [Use case: Execute command using a specific repository branch](#execute-command-using-a-specific-repository-branch)
  - [pytest](#pytest)
- [Use case: Execute command to modify a pull request branch](#execute-command-to-modify-a-pull-request-branch)
  - [black](#black)

## Use case: Execute command using a specific repository branch

This is pattern for a slash command where a named argument specifies the branch to checkout. If the named argument is missing it defaults to `master`. For example, the following command will cause the command workflow to checkout the `develop` branch of the repository where the command was dispatched from. After the branch has been checked out in the command workflow, scripts, tools or actions may be executed against it.

```
/do-something branch=develop
```

In the dispatch configuration for this command pattern, `named-args` should be set to `true`.

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
          branch=${{ github.event.client_payload.slash_command.branch }}
          if [[ -z "$branch" ]]; then branch="master"; fi
          echo ::set-output name=branch::$branch

      # Checkout the branch to test
      - uses: actions/checkout@v2
        with:
          token: ${{ secrets.REPO_ACCESS_TOKEN }}
          repository: ${{ github.event.client_payload.github.payload.repository.full_name }}
          ref: ${{ steps.vars.outputs.branch }}

      # Execute scripts, tools or actions
      - name: Do something
        run: |
          # Execute a script, tool or action here
          #
          echo "Do something"

      # Add reaction to the comment
      - name: Add reaction
        uses: peter-evans/create-or-update-comment@v1
        with:
          token: ${{ secrets.REPO_ACCESS_TOKEN }}
          repository: ${{ github.event.client_payload.github.payload.repository.full_name }}
          comment-id: ${{ github.event.client_payload.github.payload.comment.id }}
          reaction-type: hooray
```

### pytest

This is a real example that uses this pattern to execute the Python test tool [pytest](https://github.com/pytest-dev/pytest/) against a specific branch. 

```
/pytest branch=develop -v -s
```

In the following command workflow, note how the remaining `unnamed_args` are passed to the `pytest` tool.

```yml
name: pytest
on:
  repository_dispatch:
    types: [pytest-command]
jobs:
  pytest:
    runs-on: ubuntu-latest
    steps:
      # Get the branch name
      - name: Get the target branch name
        id: vars
        run: |
          branch=${{ github.event.client_payload.slash_command.branch }}
          if [[ -z "$branch" ]]; then branch="master"; fi
          echo ::set-output name=branch::$branch

      # Checkout the branch to test
      - uses: actions/checkout@v2
        with:
          token: ${{ secrets.REPO_ACCESS_TOKEN }}
          repository: ${{ github.event.client_payload.github.payload.repository.full_name }}
          ref: ${{ steps.vars.outputs.branch }}

      # Setup Python environment
      - uses: actions/setup-python@v1

      # Install pytest
      - name: Install pytest
        run: |
          pip install -U pytest
          pytest --version

      # Install requirements
      - name: Install requirements
        run: pip install -r requirements.txt

      # Execute pytest
      - name: Execute pytest
        run: pytest ${{ github.event.client_payload.slash_command.unnamed_args }}

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

This is pattern for a slash command used in pull request comments. It checks out the pull request branch and allows further scripts, tools and action steps to modify it.

```
/fix-pr
```

In the dispatch configuration for this command pattern, `issue-type` should be set to `pull-request`. This will prevent it from being dispatched from regular issue comments where it will fail. 

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

### black

This is a real example that uses this pattern to format Python code using [Black](https://github.com/psf/black).

```
/black
```

In the following command workflow, note how a step `if` condition checks to see if anything should be committed.

```yml
name: black-command
on:
  repository_dispatch:
    types: [black-command]
jobs:
  black:
    runs-on: ubuntu-latest
    steps:
      # Checkout the pull request branch
      - uses: actions/checkout@v2
        with:
          token: ${{ secrets.REPO_ACCESS_TOKEN }}
          repository: ${{ github.event.client_payload.pull_request.head.repo.full_name }}
          ref: ${{ github.event.client_payload.pull_request.head.ref }}

      # Setup Python environment
      - uses: actions/setup-python@v1

      # Install black
      - name: Install black
        run: pip install black

      # Execute black in check mode
      - name: Black
        id: black
        run: echo ::set-output name=format::$(black --check --quiet . || echo "true")

      # Execute black and commit the change to the PR branch
      - name: Commit to the PR branch
        if: steps.black.outputs.format == 'true'
        run: |
          black .
          git config --global user.name 'actions-bot'
          git config --global user.email '58130806+actions-bot@users.noreply.github.com'
          git commit -am "[black-command] fixes"
          git push

      - name: Add reaction
        uses: peter-evans/create-or-update-comment@v1
        with:
          token: ${{ secrets.REPO_ACCESS_TOKEN }}
          repository: ${{ github.event.client_payload.github.payload.repository.full_name }}
          comment-id: ${{ github.event.client_payload.github.payload.comment.id }}
          reaction-type: hooray
```
