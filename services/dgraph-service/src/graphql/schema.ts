import { gql } from 'apollo-server-express';

export const typeDefs = gql`
  type User {
    id: ID!
    suiAddress: String!
    linkedZKPs: [ZKLink!]!
    createdAt: String!
    updatedAt: String!
  }

  type ZKLink {
    provider: ZKProvider!
    proof: String!
    linkedAt: String!
  }

  enum ZKProvider {
    GITHUB
    GMAIL
    FACEBOOK
  }

  type SUITextObject {
    id: ID!
    owner: String!
    content: String!
    metadata: String
    createdAt: String!
    updatedAt: String!
  }

  type SUIdApp {
    id: ID!
    name: String!
    description: String!
    owner: String!
    version: String!
    manifest: DAppManifest!
    blobIds: [String!]!
    tags: [String!]!
    createdAt: String!
    updatedAt: String!
  }

  type DAppManifest {
    entryPoint: String!
    assets: [String!]!
    dependencies: [String!]!
    permissions: [DAppPermission!]!
    metadata: DAppMetadata!
  }

  type DAppMetadata {
    title: String!
    description: String!
    author: String!
    version: String!
    license: String
    thumbnail: String
  }

  enum DAppPermission {
    WALLET_READ
    WALLET_SIGN
    STORAGE_READ
    STORAGE_WRITE
    PRESENCE_READ
    PRESENCE_WRITE
    NETWORK_FETCH
    CAMERA
    MICROPHONE
    GEOLOCATION
  }

  type DApp {
    id: ID!
    name: String!
    description: String!
    owner: String!
    version: String!
    manifest: DAppManifest!
    blobIds: [String!]!
    tags: [String!]!
    category: DAppCategory!
    rating: Float!
    downloadCount: Int!
    createdAt: String!
    updatedAt: String!
  }

  enum DAppCategory {
    SOCIAL
    GAMING
    PRODUCTIVITY
    FINANCE
    EDUCATION
    ENTERTAINMENT
    UTILITY
    OTHER
  }

  type Query {
    # User queries
    user(suiAddress: String!): User
    users(limit: Int, offset: Int): [User!]!

    # Text object queries
    textObject(id: ID!): SUITextObject
    textObjects(owner: String, limit: Int, offset: Int): [SUITextObject!]!
    searchTextObjects(query: String!, limit: Int, offset: Int): [SUITextObject!]!

    # dApp queries
    dapp(id: ID!): SUIdApp
    dapps(owner: String, tags: [String!], limit: Int, offset: Int): [SUIdApp!]!
    searchDApps(query: String, category: DAppCategory, tags: [String!], limit: Int, offset: Int): DAppSearchResult!

    # Search and discovery
    trendingDApps(limit: Int): [DApp!]!
    featuredDApps(limit: Int): [DApp!]!
  }

  type DAppSearchResult {
    dapps: [DApp!]!
    total: Int!
    hasMore: Boolean!
  }

  type Mutation {
    # User mutations
    createUser(suiAddress: String!): User!
    updateUser(suiAddress: String!, linkedZKPs: [ZKLinkInput!]): User!

    # Text object mutations
    createTextObject(owner: String!, content: String!, metadata: String): SUITextObject!
    updateTextObject(id: ID!, content: String, metadata: String): SUITextObject

    # dApp mutations
    createDApp(
      name: String!
      description: String!
      owner: String!
      version: String
      manifest: DAppManifestInput!
      blobIds: [String!]!
      tags: [String!]
    ): SUIdApp!
    updateDApp(
      id: ID!
      name: String
      description: String
      version: String
      manifest: DAppManifestInput
      blobIds: [String!]
      tags: [String!]
    ): SUIdApp

    # Rating and stats
    rateDApp(dappId: ID!, rating: Float!): DApp!
    incrementDownloadCount(dappId: ID!): DApp!
  }

  input ZKLinkInput {
    provider: ZKProvider!
    proof: String!
  }

  input DAppManifestInput {
    entryPoint: String!
    assets: [String!]!
    dependencies: [String!]!
    permissions: [DAppPermission!]!
    metadata: DAppMetadataInput!
  }

  input DAppMetadataInput {
    title: String!
    description: String!
    author: String!
    version: String!
    license: String
    thumbnail: String
  }
`;