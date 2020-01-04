const { inspect } = require("util");
var fs = require("fs");
const core = require("@actions/core");

const MAX_ARGS = 50;
const namedArgPattern = /^(?<name>[a-zA-Z0-9_]+)=(?<value>[^\s]+)$/;

const commandDefaults = Object.freeze({
  permission: "write",
  issue_type: "both",
  allow_edits: false,
  repository: process.env.GITHUB_REPOSITORY,
  event_type_suffix: "-command",
  named_args: false
});

function toBool(input, defaultVal) {
  if (typeof input === 'boolean') {
    return input;
  } else if (typeof input === 'undefined' || input.length == 0) {
    return defaultVal;
  } else {
    return input === "true";
  }
}

function getInputs() {
  return {
    token: core.getInput("token"),
    reactionToken: core.getInput("reaction-token"),
    reactions: toBool(core.getInput("reactions"), true),
    commands: core.getInput("commands"),
    permission: core.getInput("permission"),
    issueType: core.getInput("issue-type"),
    allowEdits: core.getInput("allow-edits"),
    repository: core.getInput("repository"),
    eventTypeSuffix: core.getInput("event-type-suffix"),
    namedArgs: core.getInput("named-args"),
    config: core.getInput("config"),
    configFromFile: core.getInput("config-from-file")
  };
}

function getCommandsConfig(inputs) {
  if (inputs.configFromFile) {
    core.info(`Using JSON configuration from file '${inputs.configFromFile}'.`);
    return getCommandsConfigFromJson(fs.readFileSync(inputs.configFromFile));
  } else if (inputs.config) {
    core.info(`Using JSON configuration from 'config' input.`);
    return getCommandsConfigFromJson(inputs.config);
  } else {
    core.info(`Using configuration from yaml inputs.`);
    return getCommandsConfigFromInputs(inputs);
  }
}

function extend(obj1, obj2) {
  var result = {};
  for (val in obj1) result[val] = obj1[val];
  for (val in obj2) result[val] = obj2[val];
  return result;
}

function getCommandsConfigFromInputs(inputs) {
  // Get commands
  const commands = inputs.commands.replace(/\s+/g, "").split(",");
  core.debug(`Commands: ${inspect(commands)}`);

  // Build config
  var config = [];
  for (const c of commands) {
    var cmd = {};
    cmd.command = c;
    cmd = extend(commandDefaults, cmd);
    cmd.permission = inputs.permission ? inputs.permission : cmd.permission;
    cmd.issue_type = inputs.issueType ? inputs.issueType : cmd.issue_type;
    cmd.allow_edits = toBool(inputs.allowEdits, cmd.allow_edits);
    cmd.repository = inputs.repository ? inputs.repository : cmd.repository;
    cmd.event_type_suffix = inputs.eventTypeSuffix
      ? inputs.eventTypeSuffix
      : cmd.event_type_suffix;
    cmd.named_args = toBool(inputs.namedArgs, cmd.named_args);
    config.push(cmd);
  }
  return config;
}

function getCommandsConfigFromJson(json) {
  const jsonConfig = JSON.parse(json);
  core.debug(`JSON config: ${inspect(jsonConfig)}`);

  var config = [];
  for (const jc of jsonConfig) {
    var cmd = {};
    cmd.command = jc.command;
    cmd = extend(commandDefaults, cmd);
    cmd.permission = jc.permission ? jc.permission : cmd.permission;
    cmd.issue_type = jc.issue_type ? jc.issue_type : cmd.issue_type;
    cmd.allow_edits = toBool(jc.allow_edits, cmd.allow_edits);
    cmd.repository = jc.repository ? jc.repository : cmd.repository;
    cmd.event_type_suffix = jc.event_type_suffix
      ? jc.event_type_suffix
      : cmd.event_type_suffix;
    cmd.named_args = toBool(jc.named_args, cmd.named_args);
    config.push(cmd);
  }
  return config;
}

function configIsValid(config) {
  for (const command of config) {
    if (!["none", "read", "write", "admin"].includes(command.permission)) {
      core.setFailed(`'${command.permission}' is not a valid 'permission'.`);
      return false;
    }
    if (!["issue", "pull-request", "both"].includes(command.issue_type)) {
      core.setFailed(`'${command.issue_type}' is not a valid 'issue-type'.`);
      return false;
    }
  }
  return true;
}

function actorHasPermission(actorPermission, commandPermission) {
  const permissionLevels = Object.freeze({
    none: 1,
    read: 2,
    write: 3,
    admin: 4
  });
  core.debug(`Actor permission level: ${permissionLevels[actorPermission]}`);
  core.debug(
    `Command permission level: ${permissionLevels[commandPermission]}`
  );
  return (
    permissionLevels[actorPermission] >= permissionLevels[commandPermission]
  );
}

async function getActorPermission(octokit, repo, actor) {
  const {
    data: { permission }
  } = await octokit.repos.getCollaboratorPermissionLevel({
    ...repo,
    username: actor
  });
  return permission;
}

async function addReaction(octokit, repo, commentId, reaction) {
  try {
    await octokit.reactions.createForIssueComment({
      ...repo,
      comment_id: commentId,
      content: reaction
    });
  } catch (error) {
    core.debug(inspect(error));
    core.warning(`Failed to set reaction on comment ID ${commentId}.`);
  }
}

function getSlashCommandPayload(commentWords, namedArgs) {
  var payload = {
    command: commentWords[0],
    args: ""
  };
  if (commentWords.length > 1) {
    const argWords = commentWords.slice(1, MAX_ARGS + 1);
    payload.args = argWords.join(" ");
    // Parse named and unnamed args
    var unnamedCount = 1;
    var unnamedArgs = [];
    for (var argWord of argWords) {
      if (namedArgs && namedArgPattern.test(argWord)) {
        const { groups: { name, value } } = namedArgPattern.exec(argWord);
        payload[`${name}`] = value;
      } else {
        unnamedArgs.push(argWord)
        payload[`arg${unnamedCount}`] = argWord;
        unnamedCount += 1;
      }
    }
    // Add a string of only the unnamed args
    if (namedArgs && unnamedArgs.length > 0) {
      payload["unnamed_args"] = unnamedArgs.join(" ");
    }
  }
  return payload;
}

module.exports = {
  MAX_ARGS,
  commandDefaults,
  getInputs,
  getCommandsConfig,
  getCommandsConfigFromInputs,
  getCommandsConfigFromJson,
  configIsValid,
  actorHasPermission,
  getActorPermission,
  addReaction,
  getSlashCommandPayload
};
