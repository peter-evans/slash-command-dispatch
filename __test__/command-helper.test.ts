import {
  Inputs,
  Command,
  SlashCommandPayload,
  commandDefaults,
  getCommandsConfigFromInputs,
  getCommandsConfigFromJson,
  actorHasPermission,
  configIsValid,
  getSlashCommandPayload
} from '../lib/command-helper'

describe('command-helper tests', () => {
  test('building config with required inputs only', async () => {
    const commands = ['list', 'of', 'slash', 'commands']
    const inputs: Inputs = {
      token: '',
      reactionToken: '',
      reactions: true,
      commands: commands,
      permission: 'write',
      issueType: 'both',
      allowEdits: false,
      // Should be the value of github.repository, but '' for tests
      repository: '',
      eventTypeSuffix: '-command',
      staticArgs: [],
      config: '',
      configFromFile: ''
    }
    const config = getCommandsConfigFromInputs(inputs)
    expect(config.length).toEqual(4)
    for (var i = 0; i < config.length; i++) {
      expect(config[i].command).toEqual(commands[i])
      expect(config[i].permission).toEqual(commandDefaults.permission)
      expect(config[i].issue_type).toEqual(commandDefaults.issue_type)
      expect(config[i].allow_edits).toEqual(commandDefaults.allow_edits)
      expect(config[i].repository).toEqual(commandDefaults.repository)
      expect(config[i].event_type_suffix).toEqual(
        commandDefaults.event_type_suffix
      )
      expect(config[i].static_args).toEqual(commandDefaults.static_args)
    }
  })

  test('building config with optional inputs', async () => {
    const commands = ['list', 'of', 'slash', 'commands']
    const inputs: Inputs = {
      token: '',
      reactionToken: '',
      reactions: true,
      commands: commands,
      permission: 'admin',
      issueType: 'pull-request',
      allowEdits: true,
      repository: 'owner/repo',
      eventTypeSuffix: '-cmd',
      staticArgs: ['production', 'region=us-east-1'],
      config: '',
      configFromFile: ''
    }
    const config = getCommandsConfigFromInputs(inputs)
    expect(config.length).toEqual(4)
    for (var i = 0; i < config.length; i++) {
      expect(config[i].command).toEqual(commands[i])
      expect(config[i].permission).toEqual(inputs.permission)
      expect(config[i].issue_type).toEqual(inputs.issueType)
      expect(config[i].allow_edits).toEqual(inputs.allowEdits)
      expect(config[i].repository).toEqual(inputs.repository)
      expect(config[i].event_type_suffix).toEqual(inputs.eventTypeSuffix)
      expect(config[i].static_args).toEqual(inputs.staticArgs)
    }
  })

  test('building config with required JSON only', async () => {
    const json = `[
      {
        "command": "do-stuff"
      },
      {
        "command": "test-all-the-things"
      }
    ]`
    const commands = ['do-stuff', 'test-all-the-things']
    const config = getCommandsConfigFromJson(json)
    expect(config.length).toEqual(2)
    for (var i = 0; i < config.length; i++) {
      expect(config[i].command).toEqual(commands[i])
      expect(config[i].permission).toEqual(commandDefaults.permission)
      expect(config[i].issue_type).toEqual(commandDefaults.issue_type)
      expect(config[i].allow_edits).toEqual(commandDefaults.allow_edits)
      expect(config[i].repository).toEqual(commandDefaults.repository)
      expect(config[i].event_type_suffix).toEqual(
        commandDefaults.event_type_suffix
      )
      expect(config[i].static_args).toEqual(commandDefaults.static_args)
    }
  })

  test('building config with optional JSON properties', async () => {
    const json = `[
      {
        "command": "do-stuff",
        "permission": "admin",
        "issue_type": "pull-request",
        "allow_edits": true,
        "repository": "owner/repo",
        "event_type_suffix": "-cmd"
      },
      {
        "command": "test-all-the-things",
        "permission": "read",
        "static_args": [
          "production",
          "region=us-east-1"
        ]
      }
    ]`
    const commands = ['do-stuff', 'test-all-the-things']
    const config = getCommandsConfigFromJson(json)
    expect(config.length).toEqual(2)
    expect(config[0].command).toEqual(commands[0])
    expect(config[0].permission).toEqual('admin')
    expect(config[0].issue_type).toEqual('pull-request')
    expect(config[0].allow_edits).toBeTruthy()
    expect(config[0].repository).toEqual('owner/repo')
    expect(config[0].event_type_suffix).toEqual('-cmd')
    expect(config[1].command).toEqual(commands[1])
    expect(config[1].permission).toEqual('read')
    expect(config[1].issue_type).toEqual(commandDefaults.issue_type)
    expect(config[1].static_args).toEqual(['production', 'region=us-east-1'])
  })

  test('valid config', async () => {
    const config: Command[] = [
      {
        command: 'test',
        permission: 'write',
        issue_type: 'both',
        allow_edits: false,
        repository: 'peter-evans/slash-command-dispatch',
        event_type_suffix: '-command',
        static_args: []
      }
    ]
    expect(configIsValid(config)).toBeTruthy()
  })

  test('invalid permission level in config', async () => {
    const config: Command[] = [
      {
        command: 'test',
        permission: 'test-case-invalid-permission',
        issue_type: 'both',
        allow_edits: false,
        repository: 'peter-evans/slash-command-dispatch',
        event_type_suffix: '-command',
        static_args: []
      }
    ]
    expect(configIsValid(config)).toBeFalsy()
  })

  test('invalid issue type in config', async () => {
    const config: Command[] = [
      {
        command: 'test',
        permission: 'write',
        issue_type: 'test-case-invalid-issue-type',
        allow_edits: false,
        repository: 'peter-evans/slash-command-dispatch',
        event_type_suffix: '-command',
        static_args: []
      }
    ]
    expect(configIsValid(config)).toBeFalsy()
  })

  test('actor does not have permission', async () => {
    expect(actorHasPermission('none', 'read')).toBeFalsy()
    expect(actorHasPermission('read', 'write')).toBeFalsy()
    expect(actorHasPermission('write', 'admin')).toBeFalsy()
  })

  test('actor has permission', async () => {
    expect(actorHasPermission('read', 'none')).toBeTruthy()
    expect(actorHasPermission('write', 'read')).toBeTruthy()
    expect(actorHasPermission('admin', 'write')).toBeTruthy()
    expect(actorHasPermission('write', 'write')).toBeTruthy()
  })

  test('slash command payload', async () => {
    const commandWords = ['test', 'arg1', 'arg2', 'arg3']
    const staticArgs = []
    const payload: SlashCommandPayload = {
      command: 'test',
      args: {
        all: 'arg1 arg2 arg3',
        unnamed: {
          all: 'arg1 arg2 arg3',
          arg1: 'arg1',
          arg2: 'arg2',
          arg3: 'arg3'
        },
        named: {}
      }
    }
    expect(getSlashCommandPayload(commandWords, staticArgs)).toEqual(payload)
  })

  test('slash command payload with named args', async () => {
    const commandWords = ['test', 'branch=master', 'arg1', 'env=prod', 'arg2']
    const staticArgs = []
    const payload: SlashCommandPayload = {
      command: 'test',
      args: {
        all: 'branch=master arg1 env=prod arg2',
        unnamed: {
          all: 'arg1 arg2',
          arg1: 'arg1',
          arg2: 'arg2'
        },
        named: {
          branch: 'master',
          env: 'prod'
        }
      }
    }
    expect(getSlashCommandPayload(commandWords, staticArgs)).toEqual(payload)
  })

  test('slash command payload with named args and static args', async () => {
    const commandWords = ['test', 'branch=master', 'arg1', 'arg2']
    const staticArgs = ['production', 'region=us-east-1']
    const payload: SlashCommandPayload = {
      command: 'test',
      args: {
        all: 'production region=us-east-1 branch=master arg1 arg2',
        unnamed: {
          all: 'production arg1 arg2',
          arg1: 'production',
          arg2: 'arg1',
          arg3: 'arg2'
        },
        named: {
          region: 'us-east-1',
          branch: 'master'
        }
      }
    }
    expect(getSlashCommandPayload(commandWords, staticArgs)).toEqual(payload)
  })

  test('slash command payload with malformed named args', async () => {
    const commandWords = ['test', 'branch=', 'arg1', 'e-nv=prod', 'arg2']
    const staticArgs = []
    const payload: SlashCommandPayload = {
      command: 'test',
      args: {
        all: 'branch= arg1 e-nv=prod arg2',
        unnamed: {
          all: 'branch= arg1 e-nv=prod arg2',
          arg1: 'branch=',
          arg2: 'arg1',
          arg3: 'e-nv=prod',
          arg4: 'arg2'
        },
        named: {}
      }
    }
    expect(getSlashCommandPayload(commandWords, staticArgs)).toEqual(payload)
  })
})