import {Octokit as Core} from '@octokit/core'
import {paginateRest} from '@octokit/plugin-paginate-rest'
import {
  restEndpointMethods,
  RestEndpointMethodTypes
} from '@octokit/plugin-rest-endpoint-methods'
import {HttpProxyAgent} from 'http-proxy-agent'
import {HttpsProxyAgent} from 'https-proxy-agent'

export const Octokit = Core.plugin(
  paginateRest,
  restEndpointMethods,
  autoProxyAgent
)

export type PullsGetResponseData =
  RestEndpointMethodTypes['pulls']['get']['response']['data']

// Octokit plugin to support the http_proxy and https_proxy environment variable
function autoProxyAgent(octokit: Core) {
  const http_proxy_address =
    process.env['http_proxy'] || process.env['HTTP_PROXY']
  const https_proxy_address =
    process.env['https_proxy'] || process.env['HTTPS_PROXY']

  octokit.hook.before('request', options => {
    if (options.baseUrl.startsWith('http://') && http_proxy_address) {
      options.request.agent = new HttpProxyAgent(http_proxy_address)
    } else if (options.baseUrl.startsWith('https://') && https_proxy_address) {
      options.request.agent = new HttpsProxyAgent(https_proxy_address)
    }
  })
}
