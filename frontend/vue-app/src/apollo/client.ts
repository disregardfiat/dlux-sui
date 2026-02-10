import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client/core'
import { setContext } from '@apollo/client/link/context'
import { getDgraphServiceUrl } from '@/config/links'

// HTTP connection to the API
const httpLink = createHttpLink({
  uri: (() => {
    const graphql = import.meta.env.VITE_GRAPHQL_URL;
    if (graphql) return String(graphql);
    return `${getDgraphServiceUrl()}/graphql`;
  })(),
})

// Auth link for adding JWT token
const authLink = setContext((_, { headers }) => {
  // Get the authentication token from local storage if it exists
  const token = localStorage.getItem('auth_token')
  // Return the headers to the context so httpLink can read them
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : '',
    }
  }
})

// Cache implementation
const cache = new InMemoryCache()

// Create the apollo client
export const apolloClient = new ApolloClient({
  link: authLink.concat(httpLink),
  cache,
})