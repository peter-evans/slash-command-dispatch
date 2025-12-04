import * as core from '@actions/core'
import {Octokit, PullsGetResponseData} from './octokit-client'
import {Command, SlashCommandPayload} from './command-helper'
import {inspect} from 'util'
import * as utils from './utils'

type ReposCreateDispatchEventParamsClientPayload = {
  [key: string]: ReposCreateDispatchEventParamsClientPayloadKeyString
}
// eslint-disable-next-line
type ReposCreateDispatchEventParamsClientPayloadKeyString = {}

export interface ClientPayload extends ReposCreateDispatchEventParamsClientPayload {
  // eslint-disable-next-line
  github: any
  // eslint-disable-next-line
  pull_request?: any
  // eslint-disable-next-line
  slash_command?: SlashCommandPayload | any
}

interface Repository {
  owner: string
  repo: string
}

export class GitHubHelper {
  private octokit: InstanceType<typeof Octokit>

  constructor(token: string) {
    this.octokit = new Octokit({
      auth: token,
      baseUrl: process.env['GITHUB_API_URL'] || 'https://api.github.com'
    })
  }

  private parseRepository(repository: string): Repository {
    const [owner, repo] = repository.split('/')
    return {
      owner: owner,
      repo: repo
    }
  }

  async getActorPermission(
    repo: Repository,
    actor: string
  ): Promise<utils.RepoPermission> {
    // Use the REST API approach which can detect both direct and team-based permissions
    // This is more reliable than the GraphQL approach for team permissions and works better with default GITHUB_TOKEN
    try {
      const {data: collaboratorPermission} =
        await this.octokit.rest.repos.getCollaboratorPermissionLevel({
          ...repo,
          username: actor
        })

      const permissions = collaboratorPermission.user?.permissions
      core.debug(`REST API collaborator permission: ${inspect(permissions)}`)

      // Use the detailed permissions object to get the highest permission level
      if (permissions) {
        // Check permissions in order of highest to lowest
        if (permissions.admin) {
          return 'admin'
        } else if (permissions.maintain) {
          return 'maintain'
        } else if (permissions.push) {
          return 'write'
        } else if (permissions.triage) {
          core.debug(`User ${actor} has triage permission via REST API`)
          return 'triage'
        } else if (permissions.pull) {
          core.debug(`User ${actor} has read permission via REST API`)
          return 'read'
        }
      }

      return 'none'
    } catch (error) {
      core.debug(
        `REST API permission check failed: ${utils.getErrorMessage(error)}`
      )
      return 'none'
    }
  }

  async tryAddReaction(
    repo: Repository,
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
      await this.octokit.rest.reactions.createForIssueComment({
        ...repo,
        comment_id: commentId,
        content: reaction
      })
    } catch (error) {
      core.debug(utils.getErrorMessage(error))
      core.warning(`Failed to set reaction on comment ID ${commentId}.`)
    }
  }

  async getPull(
    repo: Repository,
    pullNumber: number
  ): Promise<PullsGetResponseData> {
    const {data: pullRequest} = await this.octokit.rest.pulls.get({
      ...repo,
      pull_number: pullNumber
    })
    return pullRequest
  }

  async createDispatch(
    cmd: Command,
    clientPayload: ClientPayload
  ): Promise<void> {
    if (cmd.dispatch_type == 'repository') {
      await this.createRepositoryDispatch(cmd, clientPayload)
    } else {
      await this.createWorkflowDispatch(cmd, clientPayload)
    }
  }

  private async createRepositoryDispatch(
    cmd: Command,
    clientPayload: ClientPayload
  ): Promise<void> {
    const eventType = `${cmd.command}${cmd.event_type_suffix}`
    await this.octokit.rest.repos.createDispatchEvent({
      ...this.parseRepository(cmd.repository),
      event_type: `${cmd.command}${cmd.event_type_suffix}`,
      client_payload: clientPayload
    })
    core.info(
      `Command '${cmd.command}' dispatched to '${cmd.repository}' ` +
        `with event type '${eventType}'.`
    )
  }

  async createWorkflowDispatch(
    cmd: Command,
    clientPayload: ClientPayload
  ): Promise<void> {
    const workflowName = `${cmd.command}${cmd.event_type_suffix}`
    const workflow = await this.getWorkflow(cmd.repository, workflowName)
    const slashCommand: SlashCommandPayload = clientPayload.slash_command
    const ref = slashCommand.args.named.ref
      ? slashCommand.args.named.ref
      : await this.getDefaultBranch(cmd.repository)

    // Take max 10 named arguments, excluding 'ref'.
    const inputs = {}
    let count = 0
    for (const key in slashCommand.args.named) {
      if (key != 'ref') {
        inputs[key] = slashCommand.args.named[key]
        count++
      }
      if (count == 10) break
    }

    await this.octokit.request(
      'POST /repos/{owner}/{repo}/actions/workflows/{workflow_id}/dispatches',
      {
        ...this.parseRepository(cmd.repository),
        workflow_id: workflow,
        ref: ref,
        inputs: inputs
      }
    )
    core.info(
      `Command '${cmd.command}' dispatched to workflow '${workflow}' in '${cmd.repository}'`
    )
  }

  private async getWorkflow(
    repository: string,
    workflowName: string
  ): Promise<string> {
    core.debug(`Getting workflow ${workflowName} for repository ${repository}`)
    const {data: workflows} = await this.octokit.rest.actions.listRepoWorkflows(
      {
        ...this.parseRepository(repository)
      }
    )
    for (const workflow of workflows.workflows) {
      core.debug(`Found workflow: ${workflow.path}`)
      if (
        workflow.path.endsWith(`${workflowName}.yml`) ||
        workflow.path.endsWith(`${workflowName}.yaml`)
      ) {
        core.debug(`Selecting workflow file ${workflow.path}`)
        return workflow.path
      }
    }
    throw new Error(`Workflow ${workflowName} not found`)
  }

  private async getDefaultBranch(repository: string): Promise<string> {
    const {data: repo} = await this.octokit.rest.repos.get({
      ...this.parseRepository(repository)
    })
    return repo.default_branch
  }
}
