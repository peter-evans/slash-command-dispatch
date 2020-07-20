import * as core from '@actions/core'
import * as fs from 'fs'
import {inspect} from 'util'
import {Octokit} from './octokit-client'

const NAMED_ARG_PATTERN = /^(?<name>[a-zA-Z0-9_]+)=(?<value>[^\s]+)$/

export const MAX_ARGS = 50

export interface Inputs {
  token: string
  reactionToken: string
  reactions: boolean
  commands: string
  permission: string
  issueType: string
  allowEdits: boolean
  repository: string
  eventTypeSuffix: string
  namedArgs: boolean
  config: string
  configFromFile: string
}

export interface Command {
  command: string
  permission: string
  issue_type: string
  allow_edits: boolean
  repository: string
  event_type_suffix: string
  named_args: boolean
}

interface Repo {
  owner: string
  repo: string
}

export interface SlashCommandPayload {
  command: string
  args: string
  [k: string]: string
}

export const commandDefaults = Object.freeze({
  permission: 'write',
  issue_type: 'both',
  allow_edits: false,
  repository: process.env.GITHUB_REPOSITORY || '',
  event_type_suffix: '-command',
  named_args: false
})

export function toBool(input: string, defaultVal: boolean): boolean {
  if (typeof input === 'boolean') {
    return input
  } else if (typeof input === 'undefined' || input.length == 0) {
    return defaultVal
  } else {
    return input === 'true'
  }
}

export function getInputs(): Inputs {
  // Defaults set in action.yml
  return {
    token: core.getInput('token'),
    reactionToken: core.getInput('reaction-token'),
    reactions: core.getInput('reactions') === 'true',
    commands: core.getInput('commands'),
    permission: core.getInput('permission'),
    issueType: core.getInput('issue-type'),
    allowEdits: core.getInput('allow-edits') === 'true',
    repository: core.getInput('repository'),
    eventTypeSuffix: core.getInput('event-type-suffix'),
    namedArgs: core.getInput('named-args') === 'true',
    config: core.getInput('config'),
    configFromFile: core.getInput('config-from-file')
  }
}

export function getCommandsConfig(inputs: Inputs): Command[] {
  if (inputs.configFromFile) {
    core.info(`Using JSON configuration from file '${inputs.configFromFile}'.`)
    const json = fs.readFileSync(inputs.configFromFile, {
      encoding: 'utf8'
    })
    return getCommandsConfigFromJson(json)
  } else if (inputs.config) {
    core.info(`Using JSON configuration from 'config' input.`)
    return getCommandsConfigFromJson(inputs.config)
  } else {
    core.info(`Using configuration from yaml inputs.`)
    return getCommandsConfigFromInputs(inputs)
  }
}

export function getCommandsConfigFromInputs(inputs: Inputs): Command[] {
  // Get commands
  const commands = inputs.commands.replace(/\s+/g, '').split(',')
  core.debug(`Commands: ${inspect(commands)}`)

  // Build config
  const config: Command[] = []
  for (const c of commands) {
    const cmd: Command = {
      command: c,
      permission: inputs.permission,
      issue_type: inputs.issueType,
      allow_edits: inputs.allowEdits,
      repository: inputs.repository,
      event_type_suffix: inputs.eventTypeSuffix,
      named_args: inputs.namedArgs
    }
    config.push(cmd)
  }
  return config
}

export function getCommandsConfigFromJson(json: string): Command[] {
  const jsonConfig = JSON.parse(json)
  core.debug(`JSON config: ${inspect(jsonConfig)}`)

  const config: Command[] = []
  for (const jc of jsonConfig) {
    const cmd: Command = {
      command: jc.command,
      permission: jc.permission ? jc.permission : commandDefaults.permission,
      issue_type: jc.issue_type ? jc.issue_type : commandDefaults.issue_type,
      allow_edits: toBool(jc.allow_edits, commandDefaults.allow_edits),
      repository: jc.repository ? jc.repository : commandDefaults.repository,
      event_type_suffix: jc.event_type_suffix
        ? jc.event_type_suffix
        : commandDefaults.event_type_suffix,
      named_args: toBool(jc.named_args, commandDefaults.named_args)
    }
    config.push(cmd)
  }
  return config
}

export function configIsValid(config: Command[]): boolean {
  for (const command of config) {
    if (!['none', 'read', 'write', 'admin'].includes(command.permission)) {
      core.setFailed(`'${command.permission}' is not a valid 'permission'.`)
      return false
    }
    if (!['issue', 'pull-request', 'both'].includes(command.issue_type)) {
      core.setFailed(`'${command.issue_type}' is not a valid 'issue-type'.`)
      return false
    }
  }
  return true
}

export function actorHasPermission(
  actorPermission: string,
  commandPermission: string
): boolean {
  const permissionLevels = Object.freeze({
    none: 1,
    read: 2,
    write: 3,
    admin: 4
  })
  core.debug(`Actor permission level: ${permissionLevels[actorPermission]}`)
  core.debug(`Command permission level: ${permissionLevels[commandPermission]}`)
  return (
    permissionLevels[actorPermission] >= permissionLevels[commandPermission]
  )
}

export async function getActorPermission(
  octokit: InstanceType<typeof Octokit>,
  repo: Repo,
  actor: string
): Promise<string> {
  const {
    data: {permission}
  } = await octokit.repos.getCollaboratorPermissionLevel({
    ...repo,
    username: actor
  })
  return permission
}

export async function addReaction(
  octokit: InstanceType<typeof Octokit>,
  repo: Repo,
  commentId: number,
  reaction:
    | '+1'
    | '-1'
    | 'laugh'
    | 'confused'
    | 'heart'
    | 'hooray'
    | 'rocket'
    | 'eyes'
): Promise<void> {
  try {
    await octokit.reactions.createForIssueComment({
      ...repo,
      comment_id: commentId,
      content: reaction
    })
  } catch (error) {
    core.debug(inspect(error))
    core.warning(`Failed to set reaction on comment ID ${commentId}.`)
  }
}

export function getSlashCommandPayload(
  commandWords: string[],
  namedArgs: boolean
): SlashCommandPayload {
  const payload: SlashCommandPayload = {
    command: commandWords[0],
    args: ''
  }
  if (commandWords.length > 1) {
    const argWords = commandWords.slice(1, MAX_ARGS + 1)
    payload.args = argWords.join(' ')
    // Parse named and unnamed args
    let unnamedCount = 1
    const unnamedArgs: string[] = []
    for (const argWord of argWords) {
      if (namedArgs && NAMED_ARG_PATTERN.test(argWord)) {
        const result = NAMED_ARG_PATTERN.exec(argWord)
        if (result && result.groups) {
          payload[`${result.groups['name']}`] = result.groups['value']
        }
      } else {
        unnamedArgs.push(argWord)
        payload[`arg${unnamedCount}`] = argWord
        unnamedCount += 1
      }
    }
    // Add a string of only the unnamed args
    if (namedArgs && unnamedArgs.length > 0) {
      payload['unnamed_args'] = unnamedArgs.join(' ')
    }
  }
  return payload
}
