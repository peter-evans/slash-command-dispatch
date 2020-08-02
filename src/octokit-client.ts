import {Octokit as Core} from '@octokit/core'
import {paginateRest} from '@octokit/plugin-paginate-rest'
import {restEndpointMethods} from '@octokit/plugin-rest-endpoint-methods'

export {RestEndpointMethodTypes} from '@octokit/plugin-rest-endpoint-methods'
export {OctokitOptions} from '@octokit/core/dist-types/types'
export const Octokit = Core.plugin(paginateRest, restEndpointMethods)
export {PullsGetResponseData} from '@octokit/types'

export {graphql} from '@octokit/graphql'
export {graphql as Graphql} from '@octokit/graphql/dist-types/types'
