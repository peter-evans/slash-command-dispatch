import {GitHubHelper} from '../lib/github-helper'

const token: string = process.env['REPO_SCOPED_PAT'] || 'not set'

describe('github-helper tests', () => {
  it('tests getActorPermission returns "none" for non-existent collaborators', async () => {
    const githubHelper = new GitHubHelper(token)
    const actorPermission = await githubHelper.getActorPermission(
      {owner: 'peter-evans', repo: 'slash-command-dispatch'},
      'collaborator-does-not-exist'
    )
    expect(actorPermission).toEqual('none')
  })

  it('tests getActorPermission returns "admin"', async () => {
    const githubHelper = new GitHubHelper(token)
    const actorPermission = await githubHelper.getActorPermission(
      {owner: 'peter-evans', repo: 'slash-command-dispatch'},
      'peter-evans'
    )
    expect(actorPermission).toEqual('admin')
  })

  it('tests getActorPermission returns "write"', async () => {
    const githubHelper = new GitHubHelper(token)
    const actorPermission = await githubHelper.getActorPermission(
      {owner: 'peter-evans', repo: 'slash-command-dispatch'},
      'actions-bot'
    )
    expect(actorPermission).toEqual('write')
  })

  it('tests getActorPermission returns "triage" for an org repository collaborator', async () => {
    const githubHelper = new GitHubHelper(token)
    const actorPermission = await githubHelper.getActorPermission(
      {owner: 'slash-command-dispatch', repo: 'integration-test-fixture'},
      'test-case-machine-user'
    )
    expect(actorPermission).toEqual('triage')
  })
})
