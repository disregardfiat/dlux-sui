import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListResourcesRequestSchema,
  ListToolsRequestSchema,
  McpError,
  ReadResourceRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { logger } from './utils/logger.js';
import { accountTools } from './tools/account.js';
import { adTools } from './tools/ads.js';
import { contentTools } from './tools/content.js';
import { analyticsTools } from './tools/analytics.js';
import { skillTools } from './tools/skills.js';

const SUI_SERVICE_URL = process.env.SUI_SERVICE_URL || 'http://localhost:3001';
const DGRAPH_SERVICE_URL = process.env.DGRAPH_SERVICE_URL || 'http://localhost:3003';
const WALRUS_SERVICE_URL = process.env.WALRUS_SERVICE_URL || 'http://localhost:3002';

class DLUXMCPServer {
  private server: Server;

  constructor() {
    // Server constructor only takes name and version - capabilities are handled in initialization
    this.server = new Server({
      name: 'dlux-sui-mcp',
      version: '1.0.0',
    });

    this.setupHandlers();
    this.setupTools();
  }

  private setupHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      return {
        tools: [
          // Account Management
          {
            name: 'get_account_overview',
            description: 'Get complete account overview including balances, dApps, and billing status',
            inputSchema: {
              type: 'object',
              properties: {
                address: { type: 'string', description: 'SUI address to check' },
                includePrivateData: {
                  type: 'boolean',
                  description: 'Include private/sensitive data (default: false)',
                  default: false
                }
              },
              required: ['address']
            }
          },
          {
            name: 'get_transaction_history',
            description: 'Get recent transaction history for an account',
            inputSchema: {
              type: 'object',
              properties: {
                address: { type: 'string', description: 'SUI address' },
                limit: { type: 'number', description: 'Number of transactions', default: 10 }
              },
              required: ['address']
            }
          },
          {
            name: 'get_balance_breakdown',
            description: 'Get detailed balance breakdown including ad share, premium earnings, etc.',
            inputSchema: {
              type: 'object',
              properties: {
                address: { type: 'string', description: 'SUI address' }
              },
              required: ['address']
            }
          },
          {
            name: 'check_suins_status',
            description: 'Check SuiNS name registration status',
            inputSchema: {
              type: 'object',
              properties: {
                identifier: { type: 'string', description: 'SUI address or SuiNS name' }
              },
              required: ['identifier']
            }
          },
          {
            name: 'get_social_stats',
            description: 'Get social statistics for a user',
            inputSchema: {
              type: 'object',
              properties: {
                address: { type: 'string', description: 'SUI address' }
              },
              required: ['address']
            }
          },

          // Ad Management
          {
            name: 'get_ad_performance',
            description: 'Get ad campaign performance metrics',
            inputSchema: {
              type: 'object',
              properties: {
                owner: { type: 'string', description: 'Campaign owner address' },
                timeframe: { type: 'string', description: 'Time period (7d, 30d, 90d)', default: '30d' }
              },
              required: ['owner']
            }
          },
          {
            name: 'get_ad_recommendations',
            description: 'Get AI recommendations for ad optimization',
            inputSchema: {
              type: 'object',
              properties: {
                owner: { type: 'string', description: 'Campaign owner address' },
                currentPerformance: { type: 'object', description: 'Current performance metrics' }
              },
              required: ['owner']
            }
          },

          // Content Management
          {
            name: 'list_user_dapps',
            description: 'List all dApps published by a user',
            inputSchema: {
              type: 'object',
              properties: {
                owner: { type: 'string', description: 'Owner address' }
              },
              required: ['owner']
            }
          },
          {
            name: 'list_premium_content',
            description: 'List premium content for a dApp',
            inputSchema: {
              type: 'object',
              properties: {
                dappId: { type: 'string', description: 'dApp identifier' },
                owner: { type: 'string', description: 'Owner address (for filtering)' }
              },
              required: ['dappId']
            }
          },
          {
            name: 'get_content_performance',
            description: 'Get performance metrics for premium content',
            inputSchema: {
              type: 'object',
              properties: {
                owner: { type: 'string', description: 'Content owner address' },
                timeframe: { type: 'string', description: 'Time period', default: '30d' }
              },
              required: ['owner']
            }
          },

          // Analytics
          {
            name: 'get_platform_stats',
            description: 'Get overall platform statistics',
            inputSchema: {
              type: 'object',
              properties: {
                category: { type: 'string', description: 'Stats category (users, dapps, revenue)', default: 'overview' }
              }
            }
          },
          {
            name: 'get_trending_dapps',
            description: 'Get trending/popular dApps',
            inputSchema: {
              type: 'object',
              properties: {
                limit: { type: 'number', description: 'Number of results', default: 10 },
                category: { type: 'string', description: 'Filter by category' }
              }
            }
          },

          // Skill Marketplace
          {
            name: 'list_skills',
            description: 'List skills from the DLUX marketplace. Skills are dApps tagged "skill". Returns metadata, blob IDs, and marketplace URLs.',
            inputSchema: {
              type: 'object',
              properties: {
                query: { type: 'string', description: 'Optional search query to filter skills' },
                limit: { type: 'number', description: 'Max results to return', default: 20 },
                offset: { type: 'number', description: 'Pagination offset', default: 0 }
              }
            }
          },
          {
            name: 'get_skill',
            description: 'Get a skill by ID. Returns metadata and optionally fetches the skill content from Walrus.',
            inputSchema: {
              type: 'object',
              properties: {
                id: { type: 'string', description: 'Skill (dApp) ID' },
                includeContent: { type: 'boolean', description: 'Fetch skill blob content from Walrus (default: true)', default: true }
              },
              required: ['id']
            }
          }
        ]
      };
    });

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      try {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const toolArgs = args as any;
        switch (name) {
          // Account tools
          case 'get_account_overview':
            return await accountTools.getAccountOverview(toolArgs);
          case 'get_transaction_history':
            return await accountTools.getTransactionHistory(toolArgs);
          case 'get_balance_breakdown':
            return await accountTools.getBalanceBreakdown(toolArgs);
          case 'check_suins_status':
            return await accountTools.checkSuiNSStatus(toolArgs);
          case 'get_social_stats':
            return await accountTools.getSocialStats(toolArgs);

          // Ad tools
          case 'get_ad_performance':
            return await adTools.getAdPerformance(toolArgs);
          case 'get_ad_recommendations':
            return await adTools.getAdRecommendations(toolArgs);

          // Content tools
          case 'list_user_dapps':
            return await contentTools.listUserDApps(toolArgs);
          case 'list_premium_content':
            return await contentTools.listPremiumContent(toolArgs);
          case 'get_content_performance':
            return await contentTools.getContentPerformance(toolArgs);

          // Analytics tools
          case 'get_platform_stats':
            return await analyticsTools.getPlatformStats(toolArgs);
          case 'get_trending_dapps':
            return await analyticsTools.getTrendingDApps(toolArgs);

          // Skill marketplace tools
          case 'list_skills':
            return await skillTools.listSkills(toolArgs);
          case 'get_skill':
            return await skillTools.getSkill(toolArgs);

          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${name}`
            );
        }
      } catch (error) {
        logger.error(`Tool execution failed: ${name}`, error);
        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });
  }

  private setupTools() {
    // Initialize tool modules with service URLs
    const serviceUrls = {
      sui: SUI_SERVICE_URL,
      dgraph: DGRAPH_SERVICE_URL,
      walrus: WALRUS_SERVICE_URL
    };

    // Tools are initialized with service URLs for API calls
    logger.info('MCP tools initialized', { serviceUrls });
  }

  async start() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    logger.info('DLUX MCP server started');
  }
}

// Start the server
const server = new DLUXMCPServer();
server.start().catch(error => {
  logger.error('Failed to start MCP server', error);
  process.exit(1);
});