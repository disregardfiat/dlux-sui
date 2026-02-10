import { User, SUITextObject, SUIdApp, DApp } from '@dlux-sui/types';
import { dgraphClient } from '../dgraph/client';
import { logger } from '../utils/logger';

export const resolvers = {
  Query: {
    // User queries
    user: async (_: any, { suiAddress }: { suiAddress: string }) => {
      try {
        const query = `
          query user($suiAddress: string) {
            user(func: eq(suiAddress, $suiAddress)) {
              id
              suiAddress
              linkedZKPs {
                provider
                proof
                linkedAt
              }
              createdAt
              updatedAt
            }
          }
        `;

        const result = await dgraphClient.query(query, { $suiAddress: suiAddress });
        return result.user?.[0] || null;
      } catch (error) {
        logger.error('Error querying user', { suiAddress, error });
        throw error;
      }
    },

    users: async (_: any, { limit = 50, offset = 0 }: { limit: number, offset: number }) => {
      try {
        const query = `
          query users($limit: int, $offset: int) {
            users(func: has(suiAddress), first: $limit, offset: $offset) {
              id
              suiAddress
              linkedZKPs {
                provider
                proof
                linkedAt
              }
              createdAt
              updatedAt
            }
          }
        `;

        const result = await dgraphClient.query(query, { $limit: limit, $offset: offset });
        return result.users || [];
      } catch (error) {
        logger.error('Error querying users', { limit, offset, error });
        throw error;
      }
    },

    // Text object queries
    textObject: async (_: any, { id }: { id: string }) => {
      try {
        const query = `
          query textObject($id: string) {
            textObject(func: uid($id)) {
              id: uid
              owner
              content
              metadata
              createdAt
              updatedAt
            }
          }
        `;

        const result = await dgraphClient.query(query, { $id: id });
        return result.textObject?.[0] || null;
      } catch (error) {
        logger.error('Error querying text object', { id, error });
        throw error;
      }
    },

    textObjects: async (_: any, { owner, limit = 50, offset = 0 }: { owner?: string, limit: number, offset: number }) => {
      try {
        let query;
        const vars: Record<string, any> = { $limit: limit, $offset: offset };

        if (owner) {
          query = `
            query textObjects($owner: string, $limit: int, $offset: int) {
              textObjects(func: eq(owner, $owner), first: $limit, offset: $offset) {
                id: uid
                owner
                content
                metadata
                createdAt
                updatedAt
              }
            }
          `;
          vars.$owner = owner;
        } else {
          query = `
            query textObjects($limit: int, $offset: int) {
              textObjects(func: has(owner), first: $limit, offset: $offset) {
                id: uid
                owner
                content
                metadata
                createdAt
                updatedAt
              }
            }
          `;
        }

        const result = await dgraphClient.query(query, vars);
        return result.textObjects || [];
      } catch (error) {
        logger.error('Error querying text objects', { owner, limit, offset, error });
        throw error;
      }
    },

    searchTextObjects: async (_: any, { query: searchQuery, limit = 50, offset = 0 }: { query: string, limit: number, offset: number }) => {
      try {
        const query = `
          query searchTextObjects($query: string, $limit: int, $offset: int) {
            textObjects(func: anyoftext(content, $query), first: $limit, offset: $offset) {
              id: uid
              owner
              content
              metadata
              createdAt
              updatedAt
            }
          }
        `;

        const result = await dgraphClient.query(query, {
          $query: searchQuery,
          $limit: limit,
          $offset: offset
        });

        return result.textObjects || [];
      } catch (error) {
        logger.error('Error searching text objects', { query: searchQuery, error });
        throw error;
      }
    },

    // dApp queries (prefer manifestJson when present so pathMap/directory structure is included)
    dapp: async (_: any, { id }: { id: string }) => {
      try {
        const query = `
          query dapp($id: string) {
            dapp(func: eq(id, $id)) @filter(type(DApp)) {
              uid
              id
              name
              description
              owner
              permlink
              version
              manifestJson
              manifest {
                entryPoint
                assets
                dependencies
                permissions
                metadata {
                  title
                  description
                  author
                  version
                  license
                  thumbnail
                }
              }
              blobIds
              tags
              category
              createdAt
              updatedAt
            }
          }
        `;

        const result = await dgraphClient.query(query, { $id: id });
        const row = result.dapp?.[0];
        if (!row) return null;
        if (row.manifestJson) {
          try {
            row.manifest = JSON.parse(row.manifestJson);
            if (row.manifest && typeof row.manifest.pathMap === 'object') {
              row.manifest.pathMap = JSON.stringify(row.manifest.pathMap);
            }
          } catch {
            // keep structured manifest if parse fails
          }
        }
        return row;
      } catch (error) {
        logger.error('Error querying dApp', { id, error });
        throw error;
      }
    },

    dapps: async (_: any, { owner, tags, limit = 50, offset = 0 }: { owner?: string, tags?: string[], limit: number, offset: number }) => {
      try {
        // Build filter conditions
        const filterConditions: string[] = [];
        if (owner) {
          filterConditions.push(`eq(owner, "${owner}")`);
        }
        if (tags && tags.length > 0) {
          // Filter by tags - at least one tag must match
          filterConditions.push(`(anyof(tags, ${tags.map(t => `"${t}"`).join(', ')}))`);
        }

        const filterStr = filterConditions.length > 0 
          ? `@filter(${filterConditions.join(' AND ')})` 
          : '';

        const query = `
          query dapps($limit: int, $offset: int) {
            dapps(func: type(DApp)${filterStr}, first: $limit, offset: $offset) {
              uid
              id
              name
              description
              owner
              permlink
              version
              manifestJson
              manifest {
                entryPoint
                assets
                dependencies
                permissions
                metadata {
                  title
                  description
                  author
                  version
                  license
                  thumbnail
                }
              }
              blobIds
              tags
              category
              createdAt
              updatedAt
            }
          }
        `;

        const result = await dgraphClient.query(query, { $limit: limit, $offset: offset });
        const list = result.dapps || [];
        list.forEach((row: any) => {
          if (row.manifestJson) {
            try {
              row.manifest = JSON.parse(row.manifestJson);
              if (row.manifest && typeof row.manifest.pathMap === 'object') {
                row.manifest.pathMap = JSON.stringify(row.manifest.pathMap);
              }
            } catch {
              // keep structured manifest if parse fails
            }
          }
        });
        return list;
      } catch (error) {
        logger.error('Error querying dApps', { owner, tags, limit, offset, error });
        throw error;
      }
    },

    searchDApps: async (_: any, { query, category, tags, limit = 50, offset = 0 }: {
      query?: string,
      category?: string,
      tags?: string[],
      limit: number,
      offset: number
    }) => {
      try {
        // Build filter conditions using DGraph's native query capabilities
        const filterConditions: string[] = [];
        
        // Fulltext search on name and description (DGraph has fulltext indexes)
        if (query) {
          filterConditions.push(`(alloftext(name, "${query}") OR alloftext(description, "${query}"))`);
        }
        
        // Category filter (indexed with hash)
        if (category) {
          filterConditions.push(`eq(category, "${category}")`);
        }
        
        // Tags filter (indexed with hash)
        if (tags && tags.length > 0) {
          filterConditions.push(`(anyof(tags, ${tags.map(t => `"${t}"`).join(', ')}))`);
        }

        const filterStr = filterConditions.length > 0 
          ? `@filter(${filterConditions.join(' AND ')})` 
          : '';

        const dqlQuery = `
          query searchDApps($limit: int, $offset: int) {
            dapps(func: type(DApp)${filterStr}, first: $limit, offset: $offset) {
              uid
              id
              name
              description
              owner
              permlink
              version
              manifestJson
              manifest {
                entryPoint
                assets
                dependencies
                permissions
                metadata {
                  title
                  description
                  author
                  version
                  license
                  thumbnail
                }
              }
              blobIds
              tags
              category
              createdAt
              updatedAt
            }
            total(func: type(DApp)${filterStr}) {
              count(uid)
            }
          }
        `;

        const result = await dgraphClient.query(dqlQuery, { $limit: limit, $offset: offset });
        const list = result.dapps || [];
        const total = result.total?.[0]?.count || 0;
        
        list.forEach((row: any) => {
          if (row.manifestJson) {
            try {
              row.manifest = JSON.parse(row.manifestJson);
              if (row.manifest && typeof row.manifest.pathMap === 'object') {
                row.manifest.pathMap = JSON.stringify(row.manifest.pathMap);
              }
            } catch {
              // keep structured manifest if parse fails
            }
          }
        });

        return {
          dapps: list,
          total,
          hasMore: (offset + list.length) < total
        };
      } catch (error) {
        logger.error('Error searching dApps', { query, category, tags, error });
        throw error;
      }
    },

    trendingDApps: async (_: any, { limit = 10 }: { limit: number }) => {
      // TODO: Implement trending algorithm based on downloads, ratings, etc.
      return resolvers.Query.dapps(null, { limit, offset: 0 });
    },

    featuredDApps: async (_: any, { limit = 10 }: { limit: number }) => {
      // TODO: Implement featured dApps selection
      return resolvers.Query.dapps(null, { limit, offset: 0 });
    }
  },

  Mutation: {
    // User mutations
    createUser: async (_: any, { suiAddress }: { suiAddress: string }) => {
      try {
        const mutation = {
          set: {
            suiAddress,
            linkedZKPs: [],
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        };

        const result = await dgraphClient.mutate(mutation);
        return {
          id: Object.values(result.uids)[0],
          suiAddress,
          linkedZKPs: [],
          createdAt: mutation.set.createdAt,
          updatedAt: mutation.set.updatedAt
        };
      } catch (error) {
        logger.error('Error creating user', { suiAddress, error });
        throw error;
      }
    },

    // Text object mutations
    createTextObject: async (_: any, { owner, content, metadata }: {
      owner: string,
      content: string,
      metadata?: string
    }) => {
      try {
        const mutation = {
          set: {
            owner,
            content,
            metadata,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
          }
        };

        const result = await dgraphClient.mutate(mutation);
        return {
          id: Object.values(result.uids)[0],
          owner,
          content,
          metadata,
          createdAt: mutation.set.createdAt,
          updatedAt: mutation.set.updatedAt
        };
      } catch (error) {
        logger.error('Error creating text object', { owner, error });
        throw error;
      }
    },

    // dApp mutations
    createDApp: async (_: any, { name, description, owner, version, manifest, blobIds, tags }: {
      name: string,
      description: string,
      owner: string,
      version?: string,
      manifest: any,
      blobIds: string[],
      tags?: string[]
    }) => {
      try {
        // Build a URL-safe permlink from the name
        const permlink = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
        const id = `${owner.toLowerCase()}_${permlink}`;
        const manifestJson = typeof manifest === 'object' ? JSON.stringify(manifest) : (manifest && typeof manifest === 'string' ? manifest : '{}');

        // Check for existing dApp (upsert)
        let uid = `_:dapp_${id}`;
        try {
          const existingQuery = `
            query dappById($id: string) {
              dapp(func: eq(id, $id)) @filter(type(DApp)) {
                uid
              }
            }
          `;
          const qr = await dgraphClient.query(existingQuery, { $id: id });
          if (qr.dapp?.[0]?.uid) {
            uid = qr.dapp[0].uid;
          }
        } catch {
          // Ignore lookup failure, use blank node
        }

        const now = new Date().toISOString();
        const mutation = {
          set: {
            uid,
            dgraph_type: 'DApp',
            id,
            name,
            description,
            owner,
            permlink,
            version: version || '1.0.0',
            manifest,
            manifestJson,
            blobIds,
            tags: tags || [],
            category: '',
            ...(uid.startsWith('_:') ? { rating: 0, downloadCount: 0 } : {}),
            createdAt: now,
            updatedAt: now
          }
        };

        await dgraphClient.mutate(mutation);

        return {
          id,
          name,
          description,
          owner,
          permlink,
          version: version || '1.0.0',
          manifest,
          blobIds,
          tags: tags || [],
          createdAt: now,
          updatedAt: now
        };
      } catch (error) {
        logger.error('Error creating dApp', { name, owner, error });
        throw error;
      }
    },

    // Update an existing dApp
    updateDApp: async (_: any, { id, name, description, version, manifest, blobIds, tags }: {
      id: string,
      name?: string,
      description?: string,
      version?: string,
      manifest?: any,
      blobIds?: string[],
      tags?: string[]
    }) => {
      try {
        // Find existing dApp
        const query = `
          query dapp($id: string) {
            dapp(func: eq(id, $id)) @filter(type(DApp)) {
              uid
              id
              name
              description
              owner
              permlink
              version
              manifestJson
              manifest {
                entryPoint
                assets
                dependencies
                permissions
                metadata {
                  title
                  description
                  author
                  version
                  license
                  thumbnail
                }
              }
              blobIds
              tags
              category
              createdAt
            }
          }
        `;

        const result = await dgraphClient.query(query, { $id: id });
        const existing = result.dapp?.[0];
        if (!existing) {
          throw new Error(`dApp not found: ${id}`);
        }

        const updates: Record<string, any> = {
          uid: existing.uid,
          updatedAt: new Date().toISOString()
        };

        if (name !== undefined) updates.name = name;
        if (description !== undefined) updates.description = description;
        if (version !== undefined) updates.version = version;
        if (blobIds !== undefined) updates.blobIds = blobIds;
        if (tags !== undefined) updates.tags = tags;
        if (manifest !== undefined) {
          updates.manifest = manifest;
          updates.manifestJson = typeof manifest === 'object' ? JSON.stringify(manifest) : manifest;
        }

        await dgraphClient.mutate({ set: updates });

        // Return merged result
        const row = { ...existing, ...updates };
        if (row.manifestJson) {
          try {
            row.manifest = JSON.parse(row.manifestJson);
          } catch { /* keep existing */ }
        }
        return row;
      } catch (error) {
        logger.error('Error updating dApp', { id, error });
        throw error;
      }
    },

    // Rate a dApp
    rateDApp: async (_: any, { dappId, rating }: { dappId: string, rating: number }) => {
      try {
        const query = `
          query dapp($id: string) {
            dapp(func: eq(id, $id)) @filter(type(DApp)) {
              uid
              id
              name
              description
              owner
              version
              rating
              downloadCount
              category
              blobIds
              tags
              createdAt
              updatedAt
            }
          }
        `;
        const result = await dgraphClient.query(query, { $id: dappId });
        const dapp = result.dapp?.[0];
        if (!dapp) throw new Error(`dApp not found: ${dappId}`);

        // Simple average (in production, weight by user reputation)
        const newRating = dapp.rating ? (dapp.rating + rating) / 2 : rating;

        await dgraphClient.mutate({
          set: {
            uid: dapp.uid,
            rating: newRating,
            updatedAt: new Date().toISOString()
          }
        });

        return { ...dapp, rating: newRating };
      } catch (error) {
        logger.error('Error rating dApp', { dappId, error });
        throw error;
      }
    },

    // Increment download count
    incrementDownloadCount: async (_: any, { dappId }: { dappId: string }) => {
      try {
        const query = `
          query dapp($id: string) {
            dapp(func: eq(id, $id)) @filter(type(DApp)) {
              uid
              id
              name
              description
              owner
              version
              rating
              downloadCount
              category
              blobIds
              tags
              createdAt
              updatedAt
            }
          }
        `;
        const result = await dgraphClient.query(query, { $id: dappId });
        const dapp = result.dapp?.[0];
        if (!dapp) throw new Error(`dApp not found: ${dappId}`);

        const newCount = (dapp.downloadCount || 0) + 1;

        await dgraphClient.mutate({
          set: {
            uid: dapp.uid,
            downloadCount: newCount,
            updatedAt: new Date().toISOString()
          }
        });

        return { ...dapp, downloadCount: newCount };
      } catch (error) {
        logger.error('Error incrementing download count', { dappId, error });
        throw error;
      }
    },

    // Update user with ZK proofs
    updateUser: async (_: any, { suiAddress, linkedZKPs }: { suiAddress: string, linkedZKPs?: any[] }) => {
      try {
        const query = `
          query user($suiAddress: string) {
            user(func: eq(suiAddress, $suiAddress)) {
              uid
              suiAddress
              linkedZKPs {
                provider
                proof
                linkedAt
              }
              createdAt
              updatedAt
            }
          }
        `;
        const result = await dgraphClient.query(query, { $suiAddress: suiAddress });
        const user = result.user?.[0];
        if (!user) throw new Error(`User not found: ${suiAddress}`);

        const updates: Record<string, any> = {
          uid: user.uid,
          updatedAt: new Date().toISOString()
        };
        if (linkedZKPs) {
          updates.linkedZKPs = linkedZKPs.map((zkp: any) => ({
            ...zkp,
            linkedAt: zkp.linkedAt || new Date().toISOString()
          }));
        }

        await dgraphClient.mutate({ set: updates });
        return { ...user, ...updates };
      } catch (error) {
        logger.error('Error updating user', { suiAddress, error });
        throw error;
      }
    },

    // Update text object
    updateTextObject: async (_: any, { id, content, metadata }: { id: string, content?: string, metadata?: string }) => {
      try {
        const updates: Record<string, any> = {
          uid: id,
          updatedAt: new Date().toISOString()
        };
        if (content !== undefined) updates.content = content;
        if (metadata !== undefined) updates.metadata = metadata;

        await dgraphClient.mutate({ set: updates });

        // Re-query to return full object
        const query = `
          query textObject($id: string) {
            textObject(func: uid($id)) {
              id: uid
              owner
              content
              metadata
              createdAt
              updatedAt
            }
          }
        `;
        const result = await dgraphClient.query(query, { $id: id });
        return result.textObject?.[0] || null;
      } catch (error) {
        logger.error('Error updating text object', { id, error });
        throw error;
      }
    }
  }
};