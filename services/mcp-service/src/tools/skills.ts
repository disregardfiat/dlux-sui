import axios from 'axios';
import { logger } from '../utils/logger.js';

const SUI_SERVICE_URL = process.env.SUI_SERVICE_URL || 'http://localhost:3001';
const WALRUS_SERVICE_URL = process.env.WALRUS_SERVICE_URL || 'http://localhost:3002';

/**
 * Skill marketplace MCP tools.
 *
 * Skills are dApps with tag "skill" or contentType "skill".
 * list_skills  = GET /dapps/search?tags=skill
 * get_skill    = GET /dapps/:id  + optional blob fetch from Walrus
 */
export const skillTools = {
  /**
   * List skills from the marketplace.
   * Skills are dApps tagged with "skill". Uses the existing dapps search API.
   */
  async listSkills(args: { query?: string; limit?: number; offset?: number }) {
    const { query, limit = 20, offset = 0 } = args;

    try {
      let response;

      if (query) {
        // Full-text search filtered to skills
        response = await axios.get(`${SUI_SERVICE_URL}/dapps/search`, {
          params: { q: query, tags: 'skill' },
        });
      } else {
        // List all skills (dApps tagged "skill")
        response = await axios.get(`${SUI_SERVICE_URL}/dapps/search`, {
          params: { tags: 'skill' },
        });
      }

      const dapps = response.data.dapps || [];
      const page = dapps.slice(offset, offset + limit);

      const skills = page.map((dapp: any) => ({
        id: dapp.id,
        name: dapp.name,
        description: dapp.description,
        owner: dapp.owner,
        permlink: dapp.permlink,
        blobIds: dapp.blobIds || [],
        tags: dapp.tags || [],
        category: dapp.category,
        createdAt: dapp.createdAt,
        // Skill-specific: first blobId is typically the skill.md blob
        skillBlobId: dapp.blobIds?.[0] || null,
        marketplaceUrl: `https://dlux.io/dapps/${dapp.id}`,
      }));

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                skills,
                total: dapps.length,
                offset,
                limit,
                query: query || null,
                hint: 'Use get_skill with a skill id to fetch full content from Walrus.',
              },
              null,
              2,
            ),
          },
        ],
      };
    } catch (error) {
      logger.error('Failed to list skills', { query, error });
      throw new Error('Failed to list skills from marketplace');
    }
  },

  /**
   * Get a single skill's metadata and optionally its content from Walrus.
   * Returns the dApp metadata plus the raw skill blob content (if available).
   */
  async getSkill(args: { id: string; includeContent?: boolean }) {
    const { id, includeContent = true } = args;

    try {
      // Fetch dApp metadata from SUI service
      const metaResponse = await axios.get(`${SUI_SERVICE_URL}/dapps/${id}`);
      const dapp = metaResponse.data;

      const skill: Record<string, unknown> = {
        id: dapp.id,
        name: dapp.name,
        description: dapp.description,
        owner: dapp.owner,
        permlink: dapp.permlink,
        blobIds: dapp.blobIds || [],
        tags: dapp.tags || [],
        category: dapp.category,
        manifest: dapp.manifest,
        createdAt: dapp.createdAt,
        updatedAt: dapp.updatedAt,
        marketplaceUrl: `https://dlux.io/dapps/${dapp.id}`,
        installHint:
          'To install: fetch the skillBlobId from Walrus and save to .cursor/skills/ or .openclaw/skills/',
      };

      // Optionally fetch content from Walrus
      if (includeContent && dapp.blobIds?.length > 0) {
        const blobId = dapp.blobIds[0];
        try {
          const blobResponse = await axios.get(
            `${WALRUS_SERVICE_URL}/blobs/${blobId}`,
            { timeout: 10000, responseType: 'text' },
          );
          skill.content = blobResponse.data;
          skill.contentSource = 'walrus';
          skill.contentBlobId = blobId;
        } catch (blobError) {
          skill.content = null;
          skill.contentError =
            'Could not fetch skill blob from Walrus (blob may not be stored or service unavailable)';
          skill.walrusBlobUrl = `${WALRUS_SERVICE_URL}/blobs/${blobId}`;
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(skill, null, 2),
          },
        ],
      };
    } catch (error) {
      logger.error('Failed to get skill', { id, error });
      throw new Error(`Failed to get skill ${id}`);
    }
  },
};
