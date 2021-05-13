import * as core from '@actions/core'
import * as fs from 'fs'
import {inspect} from 'util'
import * as utils from './utils'

// Tokenise command and arguments
// Support escaped quotes within quotes. https://stackoverflow.com/a/5696141/11934042
const TOKENISE_REGEX =
  /\S+="[^"\\]*(?:\\.[^"\\]*)*"|"[^"\\]*(?:\\.[^"\\]*)*"|\S+/g
const NAMED_ARG_REGEX = /^(?<name>[a-zA-Z0-9_-]+)=(?<value>.+)$/

export const MAX_ARGS = 50

export interface Inputs {
  token: string
  reactionToken: string
  reactions: boolean
  commands: string[]
  permission: string
  issueType: string
  allowEdits: boolean
  repository: string
  eventTypeSuffix: string
  staticArgs: string[]
  dispatchType: string
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
  static_args: string[]
  dispatch_type: string
}

export interface SlashCommandPayload {
  command: string
  args: {
    all: string
    unnamed: {
      all: string
      [k: string]: string
    }
    named: {
      [k: string]: string
    }
  }
}

export const commandDefaults = Object.freeze({
  permission: 'write',
  issue_type: 'both',
  allow_edits: false,
  repository: process.env.GITHUB_REPOSITORY || '',
  event_type_suffix: '-command',
  static_args: [],
  dispatch_type: 'repository'
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
    commands: utils.getInputAsArray('commands'),
    permission: core.getInput('permission'),
    issueType: core.getInput('issue-type'),
    allowEdits: core.getInput('allow-edits') === 'true',
    repository: core.getInput('repository'),
    eventTypeSuffix: core.getInput('event-type-suffix'),
    staticArgs: utils.getInputAsArray('static-args'),
    dispatchType: core.getInput('dispatch-type'),
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
  core.debug(`Commands: ${inspect(inputs.commands)}`)

  // Build config
  const config: Command[] = []
  for (const c of inputs.commands) {
    const cmd: Command = {
      command: c,
      permission: inputs.permission,
      issue_type: inputs.issueType,
      allow_edits: inputs.allowEdits,
      repository: inputs.repository,
      event_type_suffix: inputs.eventTypeSuffix,
      static_args: inputs.staticArgs,
      dispatch_type: inputs.dispatchType
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
      static_args: jc.static_args
        ? jc.static_args
        : commandDefaults.static_args,
      dispatch_type: jc.dispatch_type
        ? jc.dispatch_type
        : commandDefaults.dispatch_type
    }
    config.push(cmd)
  }
  return config
}

export function configIsValid(config: Command[]): boolean {
  for (const command of config) {
    if (
      !['none', 'read', 'triage', 'write', 'maintain', 'admin'].includes(
        command.permission
      )
    ) {
      core.setFailed(`'${command.permission}' is not a valid 'permission'.`)
      return false
    }
    if (!['issue', 'pull-request', 'both'].includes(command.issue_type)) {
      core.setFailed(`'${command.issue_type}' is not a valid 'issue-type'.`)
      return false
    }
    if (!['repository', 'workflow'].includes(command.dispatch_type)) {
      core.setFailed(
        `'${command.dispatch_type}' is not a valid 'dispatch-type'.`
      )
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
    triage: 3,
    write: 4,
    maintain: 5,
    admin: 6
  })
  core.debug(`Actor permission level: ${permissionLevels[actorPermission]}`)
  core.debug(`Command permission level: ${permissionLevels[commandPermission]}`)
  return (
    permissionLevels[actorPermission] >= permissionLevels[commandPermission]
  )
}

export function tokeniseCommand(command: string): string[] {
  let matches
  const output: string[] = []
  while ((matches = TOKENISE_REGEX.exec(command))) {
    output.push(matches[0])
  }
  return output
}

function stripQuotes(input: string): string {
  if (input.startsWith(`"`) && input.endsWith(`"`)) {
    return input.slice(1, input.length - 1)
  } else {
    return input
  }
}

export function getSlashCommandPayload(
  commandTokens: string[],
  staticArgs: string[]
): SlashCommandPayload {
  const payload: SlashCommandPayload = {
    command: commandTokens[0],
    args: {
      all: '',
      unnamed: {
        all: ''
      },
      named: {}
    }
  }
  // Get arguments if they exist
  const argWords =
    commandTokens.length > 1 ? commandTokens.slice(1, MAX_ARGS + 1) : []
  // Add static arguments if they exist
  argWords.unshift(...staticArgs)
  if (argWords.length > 0) {
    payload.args.all = argWords.join(' ')
    // Parse named and unnamed args
    let unnamedCount = 1
    const unnamedArgs: string[] = []
    for (const argWord of argWords) {
      if (NAMED_ARG_REGEX.test(argWord)) {
        const result = NAMED_ARG_REGEX.exec(argWord)
        if (result && result.groups) {
          payload.args.named[`${result.groups['name']}`] = stripQuotes(
            result.groups['value']
          )
        }
      } else {
        unnamedArgs.push(argWord)
        payload.args.unnamed[`arg${unnamedCount}`] = stripQuotes(argWord)
        unnamedCount += 1
      }
    }
    // Add a string of only the unnamed args
    if (unnamedArgs.length > 0) {
      payload.args.unnamed.all = unnamedArgs.join(' ')
    }
  }
  return payload
}
