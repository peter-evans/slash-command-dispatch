import {
  Inputs,
  Command,
  SlashCommandPayload,
  commandDefaults,
  getCommandsConfigFromInputs,
  getCommandsConfigFromJson,
  actorHasPermission,
  configIsValid,
  tokeniseCommand,
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
      repository: 'peter-evans/slash-command-dispatch',
      eventTypeSuffix: '-command',
      staticArgs: [],
      dispatchType: 'repository',
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
      expect(config[i].dispatch_type).toEqual(commandDefaults.dispatch_type)
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
      dispatchType: 'workflow',
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
      expect(config[i].dispatch_type).toEqual(inputs.dispatchType)
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
      expect(config[i].static_args).toEqual(commandDefaults.static_args),
        expect(config[i].dispatch_type).toEqual(commandDefaults.dispatch_type)
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
        ],
        "dispatch_type": "workflow"
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
    expect(config[0].static_args).toEqual([])
    expect(config[0].dispatch_type).toEqual('repository')
    expect(config[1].command).toEqual(commands[1])
    expect(config[1].permission).toEqual('read')
    expect(config[1].issue_type).toEqual(commandDefaults.issue_type)
    expect(config[1].static_args).toEqual(['production', 'region=us-east-1'])
    expect(config[1].dispatch_type).toEqual('workflow')
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
        static_args: [],
        dispatch_type: 'repository'
      }
    ]
    expect(configIsValid(config)).toEqual(null)
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
        static_args: [],
        dispatch_type: 'repository'
      }
    ]
    expect(configIsValid(config)).toEqual(
      `'test-case-invalid-permission' is not a valid 'permission'.`
    )
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
        static_args: [],
        dispatch_type: 'repository'
      }
    ]
    expect(configIsValid(config)).toEqual(
      `'test-case-invalid-issue-type' is not a valid 'issue-type'.`
    )
  })

  test('invalid dispatch type in config', async () => {
    const config: Command[] = [
      {
        command: 'test',
        permission: 'write',
        issue_type: 'both',
        allow_edits: false,
        repository: 'peter-evans/slash-command-dispatch',
        event_type_suffix: '-command',
        static_args: [],
        dispatch_type: 'test-case-invalid-dispatch-type'
      }
    ]
    expect(configIsValid(config)).toEqual(
      `'test-case-invalid-dispatch-type' is not a valid 'dispatch-type'.`
    )
  })

  test('actor does not have permission', async () => {
    expect(actorHasPermission('none', 'read')).toBeFalsy()
    expect(actorHasPermission('read', 'triage')).toBeFalsy()
    expect(actorHasPermission('triage', 'write')).toBeFalsy()
    expect(actorHasPermission('write', 'maintain')).toBeFalsy()
    expect(actorHasPermission('maintain', 'admin')).toBeFalsy()
  })

  test('actor has permission', async () => {
    expect(actorHasPermission('read', 'none')).toBeTruthy()
    expect(actorHasPermission('triage', 'read')).toBeTruthy()
    expect(actorHasPermission('write', 'triage')).toBeTruthy()
    expect(actorHasPermission('admin', 'write')).toBeTruthy()
    expect(actorHasPermission('write', 'write')).toBeTruthy()
  })

  test('command arguments are correctly tokenised', async () => {
    const command = `a b=c "d e" f-g="h i" "j \\"k\\"" l="m \\"n\\" o"`
    const commandTokens = [
      `a`,
      `b=c`,
      `"d e"`,
      `f-g="h i"`,
      `"j \\"k\\""`,
      `l="m \\"n\\" o"`
    ]
    expect(tokeniseCommand(command)).toEqual(commandTokens)
  })

  test('tokenisation of malformed command arguments', async () => {
    const command = `test arg named= quoted arg" named-arg="with \\"quoted value`
    const commandTokens = [
      'test',
      'arg',
      'named=',
      'quoted',
      `arg"`,
      `named-arg="with`,
      '\\"quoted',
      'value'
    ]
    expect(tokeniseCommand(command)).toEqual(commandTokens)
  })

  test('slash command payload with unnamed args', async () => {
    const commandTokens = ['test', 'arg1', 'arg2', 'arg3']
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
    expect(getSlashCommandPayload(commandTokens, staticArgs)).toEqual(payload)
  })

  test('slash command payload with named args', async () => {
    const commandTokens = [
      'test',
      'branch_name=main',
      'arg1',
      'test-id=123',
      'arg2'
    ]
    const staticArgs = []
    const payload: SlashCommandPayload = {
      command: 'test',
      args: {
        all: 'branch_name=main arg1 test-id=123 arg2',
        unnamed: {
          all: 'arg1 arg2',
          arg1: 'arg1',
          arg2: 'arg2'
        },
        named: {
          branch_name: 'main',
          'test-id': '123'
        }
      }
    }
    expect(getSlashCommandPayload(commandTokens, staticArgs)).toEqual(payload)
  })

  test('slash command payload with named args and static args', async () => {
    const commandTokens = ['test', 'branch=main', 'arg1', 'dry-run']
    const staticArgs = ['production', 'region=us-east-1']
    const payload: SlashCommandPayload = {
      command: 'test',
      args: {
        all: 'production region=us-east-1 branch=main arg1 dry-run',
        unnamed: {
          all: 'production arg1 dry-run',
          arg1: 'production',
          arg2: 'arg1',
          arg3: 'dry-run'
        },
        named: {
          region: 'us-east-1',
          branch: 'main'
        }
      }
    }
    expect(getSlashCommandPayload(commandTokens, staticArgs)).toEqual(payload)
  })

  test('slash command payload with quoted args', async () => {
    const commandTokens = [
      `test`,
      `a`,
      `b=c`,
      `"d e"`,
      `f-g="h i"`,
      `"j \\"k\\""`,
      `l="m \\"n\\" o"`
    ]
    const staticArgs = [`msg="x y z"`]
    const payload: SlashCommandPayload = {
      command: `test`,
      args: {
        all: `msg="x y z" a b=c "d e" f-g="h i" "j \\"k\\"" l="m \\"n\\" o"`,
        unnamed: {
          all: `a "d e" "j \\"k\\""`,
          arg1: `a`,
          arg2: `d e`,
          arg3: `j \\"k\\"`
        },
        named: {
          msg: `x y z`,
          b: `c`,
          'f-g': `h i`,
          l: `m \\"n\\" o`
        }
      }
    }
    expect(getSlashCommandPayload(commandTokens, staticArgs)).toEqual(payload)
  })

  test('slash command payload with malformed named args', async () => {
    const commandTokens = ['test', 'branch=', 'arg1', 'e.nv=prod', 'arg2']
    const staticArgs = []
    const payload: SlashCommandPayload = {
      command: 'test',
      args: {
        all: 'branch= arg1 e.nv=prod arg2',
        unnamed: {
          all: 'branch= arg1 e.nv=prod arg2',
          arg1: 'branch=',
          arg2: 'arg1',
          arg3: 'e.nv=prod',
          arg4: 'arg2'
        },
        named: {}
      }
    }
    expect(getSlashCommandPayload(commandTokens, staticArgs)).toEqual(payload)
  })

  test('slash command payload with malformed quoted args', async () => {
    const commandTokens = [
      'test',
      'arg',
      'named=',
      'quoted',
      `arg"`,
      `named-arg="with`,
      `\\"quoted`,
      'value'
    ]
    const staticArgs = []
    const payload: SlashCommandPayload = {
      command: 'test',
      args: {
        all: `arg named= quoted arg" named-arg="with \\"quoted value`,
        unnamed: {
          all: `arg named= quoted arg" \\"quoted value`,
          arg1: 'arg',
          arg2: 'named=',
          arg3: 'quoted',
          arg4: `arg"`,
          arg5: `\\"quoted`,
          arg6: 'value'
        },
        named: {
          'named-arg': `"with`
        }
      }
    }
    expect(getSlashCommandPayload(commandTokens, staticArgs)).toEqual(payload)
  })
})
