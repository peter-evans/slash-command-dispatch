import * as core from '@actions/core'
import * as github from '@actions/github'
import {inspect} from 'util'
import {
  getInputs,
  tokeniseCommand,
  getCommandsConfig,
  configIsValid,
  actorHasPermission,
  getSlashCommandPayload
} from './command-helper'
import {GitHubHelper, ClientPayload} from './github-helper'

const decode = (str: string): string =>
  Buffer.from(str, 'base64').toString('binary')

async function run(): Promise<void> {
  try {
    // Check required context properties exist (satisfy type checking)
    if (
      !github.context.payload.action ||
      !github.context.payload.issue ||
      !github.context.payload.comment
    ) {
      throw new Error('Required context properties are missing.')
    }

    // Only handle 'created' and 'edited' event types
    if (!['created', 'edited'].includes(github.context.payload.action)) {
      core.warning(
        `Event type '${github.context.payload.action}' not supported.`
      )
      return
    }

    // Get action inputs
    const inputs = getInputs()
    core.debug(`Inputs: ${inspect(inputs)}`)

    // Check required inputs
    if (!inputs.token) {
      throw new Error(`Missing required input 'token'.`)
    }

    // detect if token is base64 encoded
    if (inputs.token.startsWith('ghp_')) {
      core.info('token was not base64 encoded')
    } else {
      core.info('base64 decoding token')
      inputs.token = decode(inputs.token).trim()
    }

    // Get configuration for registered commands
    const config = getCommandsConfig(inputs)
    core.debug(`Commands config: ${inspect(config)}`)

    // Check the config is valid
    if (!configIsValid(config)) return

    // Get the comment body and id
    const commentBody: string = github.context.payload.comment.body
    const commentId: number = github.context.payload.comment.id
    core.debug(`Comment body: ${commentBody}`)
    core.debug(`Comment id: ${commentId}`)

    // Check if the first line of the comment is a slash command
    const firstLine = commentBody.split(/\r?\n/)[0].trim()
    if (firstLine.length < 2 || firstLine.charAt(0) != '/') {
      console.debug(
        'The first line of the comment is not a valid slash command.'
      )
      return
    }

    // Tokenise the first line (minus the leading slash)
    const commandTokens = tokeniseCommand(firstLine.slice(1))
    core.debug(`Command tokens: ${inspect(commandTokens)}`)

    // Check if the command is registered for dispatch
    let configMatches = config.filter(function (cmd) {
      return cmd.command == commandTokens[0]
    })
    core.debug(`Config matches on 'command': ${inspect(configMatches)}`)
    if (configMatches.length == 0) {
      core.info(`Command '${commandTokens[0]}' is not registered for dispatch.`)
      return
    }

    // Filter matching commands by issue type
    const isPullRequest = 'pull_request' in github.context.payload.issue
    configMatches = configMatches.filter(function (cmd) {
      return (
        cmd.issue_type == 'both' ||
        (cmd.issue_type == 'issue' && !isPullRequest) ||
        (cmd.issue_type == 'pull-request' && isPullRequest)
      )
    })
    core.debug(`Config matches on 'issue_type': ${inspect(configMatches)}`)
    if (configMatches.length == 0) {
      const issueType = isPullRequest ? 'pull request' : 'issue'
      core.info(
        `Command '${commandTokens[0]}' is not configured for the issue type '${issueType}'.`
      )
      return
    }

    // Filter matching commands by whether or not to allow edits
    if (github.context.payload.action == 'edited') {
      configMatches = configMatches.filter(function (cmd) {
        return cmd.allow_edits
      })
      core.debug(`Config matches on 'allow_edits': ${inspect(configMatches)}`)
      if (configMatches.length == 0) {
        core.info(
          `Command '${commandTokens[0]}' is not configured to allow edits.`
        )
        return
      }
    }

    // Create github clients
    const githubHelper = new GitHubHelper(inputs.token)
    const githubHelperReaction = new GitHubHelper(inputs.reactionToken)

    // At this point we know the command is registered
    // Add the "eyes" reaction to the comment
    if (inputs.reactions)
      await githubHelperReaction.tryAddReaction(
        github.context.repo,
        commentId,
        'eyes'
      )

    // Get the actor permission
    const actorPermission = await githubHelper.getActorPermission(
      github.context.repo,
      github.context.actor
    )
    core.debug(`Actor permission: ${actorPermission}`)

    // Filter matching commands by the user's permission level
    configMatches = configMatches.filter(function (cmd) {
      return actorHasPermission(actorPermission, cmd.permission)
    })
    core.debug(`Config matches on 'permission': ${inspect(configMatches)}`)
    if (configMatches.length == 0) {
      core.info(
        `Command '${commandTokens[0]}' is not configured for the user's permission level '${actorPermission}'.`
      )
      return
    }

    // Determined that the command should be dispatched
    core.info(`Command '${commandTokens[0]}' to be dispatched.`)

    // Define payload
    const clientPayload: ClientPayload = {
      github: github.context
    }
    // Truncate the body to keep the size of the payload under the max
    if (
      clientPayload.github.payload.issue &&
      clientPayload.github.payload.issue.body
    ) {
      clientPayload.github.payload.issue.body =
        clientPayload.github.payload.issue.body.slice(0, 1000)
    }

    // Get the pull request context for the dispatch payload
    if (isPullRequest) {
      const pullRequest = await githubHelper.getPull(
        github.context.repo,
        github.context.payload.issue.number
      )
      // Truncate the body to keep the size of the payload under the max
      if (pullRequest.body) {
        pullRequest.body = pullRequest.body.slice(0, 1000)
      }
      clientPayload['pull_request'] = pullRequest
    }

    // Dispatch for each matching configuration
    for (const cmd of configMatches) {
      // Generate slash command payload
      clientPayload.slash_command = getSlashCommandPayload(
        commandTokens,
        cmd.static_args
      )
      core.debug(
        `Slash command payload: ${inspect(clientPayload.slash_command)}`
      )
      // Dispatch the command
      await githubHelper.createDispatch(cmd, clientPayload)
    }

    // Add the "rocket" reaction to the comment
    if (inputs.reactions)
      await githubHelperReaction.tryAddReaction(
        github.context.repo,
        commentId,
        'rocket'
      )
  } catch (error: any) {
    core.debug(inspect(error))
    const message: string = error.message
    // Handle validation errors from workflow dispatch
    if (
      message.startsWith('Unexpected inputs provided') ||
      (message.startsWith('Required input') &&
        message.endsWith('not provided')) ||
      message.startsWith('No ref found for:') ||
      message == `Workflow does not have 'workflow_dispatch' trigger`
    ) {
      core.setOutput('error-message', message)
      core.warning(message)
    } else {
      core.setFailed(error.message)
    }
  }
}

run()
