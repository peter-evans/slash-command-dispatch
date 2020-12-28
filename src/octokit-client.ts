import {Octokit as Core} from '@octokit/core'
import {paginateRest} from '@octokit/plugin-paginate-rest'
import {
  restEndpointMethods,
  RestEndpointMethodTypes
} from '@octokit/plugin-rest-endpoint-methods'

export {OctokitOptions} from '@octokit/core/dist-types/types'
export const Octokit = Core.plugin(paginateRest, restEndpointMethods)

export type PullsGetResponseData = RestEndpointMethodTypes['pulls']['get']['response']['data']

export {graphql} from '@octokit/graphql'
export {graphql as Graphql} from '@octokit/graphql/dist-types/types'
