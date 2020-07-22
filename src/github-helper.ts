import * as core from '@actions/core'
import {Octokit, OctokitOptions, PullsGetResponseData} from './octokit-client'
import {Command, SlashCommandPayload} from './command-helper'

type ReposCreateDispatchEventParamsClientPayload = {
  [key: string]: ReposCreateDispatchEventParamsClientPayloadKeyString
}
type ReposCreateDispatchEventParamsClientPayloadKeyString = {}

export interface ClientPayload
  extends ReposCreateDispatchEventParamsClientPayload {
  github: any
  pull_request?: any
  slash_command?: SlashCommandPayload | any
}

interface Repository {
  owner: string
  repo: string
}

export class GitHubHelper {
  private octokit: InstanceType<typeof Octokit>

  constructor(token: string) {
    const options: OctokitOptions = {}
    if (token) {
      options.auth = `${token}`
    }
    this.octokit = new Octokit(options)
  }

  private parseRepository(repository: string): Repository {
    const [owner, repo] = repository.split('/')
    return {
      owner: owner,
      repo: repo
    }
  }

  async getActorPermission(repo: Repository, actor: string): Promise<string> {
    const {
      data: {permission}
    } = await this.octokit.repos.getCollaboratorPermissionLevel({
      ...repo,
      username: actor
    })
    return permission
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
      await this.octokit.reactions.createForIssueComment({
        ...repo,
        comment_id: commentId,
        content: reaction
      })
    } catch (error) {
      core.debug(error)
      core.warning(`Failed to set reaction on comment ID ${commentId}.`)
    }
  }

  async getPull(
    repo: Repository,
    pullNumber: number
  ): Promise<PullsGetResponseData> {
    const {data: pullRequest} = await this.octokit.pulls.get({
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
    await this.octokit.repos.createDispatchEvent({
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
    const workflow = `${cmd.command}${cmd.event_type_suffix}.yml`
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

  private async getDefaultBranch(repository: string): Promise<string> {
    const {data: repo} = await this.octokit.repos.get({
      ...this.parseRepository(repository)
    })
    return repo.default_branch
  }

  // private async createOrUpdate(
  //   inputs: Inputs,
  //   baseRepository: string,
  //   headBranch: string
  // ): Promise<number> {
  //   // Try to create the pull request
  //   try {
  //     const {data: pull} = await this.octokit.pulls.create({
  //       ...this.parseRepository(baseRepository),
  //       title: inputs.title,
  //       head: headBranch,
  //       base: inputs.base,
  //       body: inputs.body,
  //       draft: inputs.draft
  //     })
  //     core.info(
  //       `Created pull request #${pull.number} (${headBranch} => ${inputs.base})`
  //     )
  //     return pull.number
  //   } catch (e) {
  //     if (
  //       !e.message ||
  //       !e.message.includes(`A pull request already exists for ${headBranch}`)
  //     ) {
  //       throw e
  //     }
  //   }

  //   // Update the pull request that exists for this branch and base
  //   const {data: pulls} = await this.octokit.pulls.list({
  //     ...this.parseRepository(baseRepository),
  //     state: 'open',
  //     head: headBranch,
  //     base: inputs.base
  //   })
  //   const {data: pull} = await this.octokit.pulls.update({
  //     ...this.parseRepository(baseRepository),
  //     pull_number: pulls[0].number,
  //     title: inputs.title,
  //     body: inputs.body,
  //     draft: inputs.draft
  //   })
  //   core.info(
  //     `Updated pull request #${pull.number} (${headBranch} => ${inputs.base})`
  //   )
  //   return pull.number
  // }

  // async getRepositoryParent(headRepository: string): Promise<string> {
  //   const {data: headRepo} = await this.octokit.repos.get({
  //     ...this.parseRepository(headRepository)
  //   })
  //   if (!headRepo.parent) {
  //     throw new Error(
  //       `Repository '${headRepository}' is not a fork. Unable to continue.`
  //     )
  //   }
  //   return headRepo.parent.full_name
  // }

  // async createOrUpdatePullRequest(
  //   inputs: Inputs,
  //   baseRepository: string,
  //   headRepository: string
  // ): Promise<void> {
  //   const [headOwner] = headRepository.split('/')
  //   const headBranch = `${headOwner}:${inputs.branch}`

  //   // Create or update the pull request
  //   const pullNumber = await this.createOrUpdate(
  //     inputs,
  //     baseRepository,
  //     headBranch
  //   )

  //   // Set outputs
  //   core.startGroup('Setting outputs')
  //   core.setOutput('pull-request-number', pullNumber)
  //   core.exportVariable('PULL_REQUEST_NUMBER', pullNumber)
  //   core.endGroup()

  //   // Set milestone, labels and assignees
  //   const updateIssueParams = {}
  //   if (inputs.milestone) {
  //     updateIssueParams['milestone'] = inputs.milestone
  //     core.info(`Applying milestone '${inputs.milestone}'`)
  //   }
  //   if (inputs.labels.length > 0) {
  //     updateIssueParams['labels'] = inputs.labels
  //     core.info(`Applying labels '${inputs.labels}'`)
  //   }
  //   if (inputs.assignees.length > 0) {
  //     updateIssueParams['assignees'] = inputs.assignees
  //     core.info(`Applying assignees '${inputs.assignees}'`)
  //   }
  //   if (Object.keys(updateIssueParams).length > 0) {
  //     await this.octokit.issues.update({
  //       ...this.parseRepository(baseRepository),
  //       issue_number: pullNumber,
  //       ...updateIssueParams
  //     })
  //   }

  //   // Request reviewers and team reviewers
  //   const requestReviewersParams = {}
  //   if (inputs.reviewers.length > 0) {
  //     requestReviewersParams['reviewers'] = inputs.reviewers
  //     core.info(`Requesting reviewers '${inputs.reviewers}'`)
  //   }
  //   if (inputs.teamReviewers.length > 0) {
  //     requestReviewersParams['team_reviewers'] = inputs.teamReviewers
  //     core.info(`Requesting team reviewers '${inputs.teamReviewers}'`)
  //   }
  //   if (Object.keys(requestReviewersParams).length > 0) {
  //     try {
  //       await this.octokit.pulls.requestReviewers({
  //         ...this.parseRepository(baseRepository),
  //         pull_number: pullNumber,
  //         ...requestReviewersParams
  //       })
  //     } catch (e) {
  //       if (e.message && e.message.includes(ERROR_PR_REVIEW_FROM_AUTHOR)) {
  //         core.warning(ERROR_PR_REVIEW_FROM_AUTHOR)
  //       } else {
  //         throw e
  //       }
  //     }
  //   }
  // }
}
