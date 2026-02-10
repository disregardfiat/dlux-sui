import axios from 'axios';
import { logger } from '../utils/logger.js';

const SUI_SERVICE_URL = process.env.SUI_SERVICE_URL || 'http://localhost:3001';
const WALRUS_SERVICE_URL = process.env.WALRUS_SERVICE_URL || 'http://localhost:3002';

export const contentTools = {
  async listUserDApps(args: { owner: string }) {
    const { owner } = args;

    try {
      const response = await axios.get(`${SUI_SERVICE_URL}/dapps/owner/${owner}`);
      const { dapps, total } = response.data;

      const dappList: {
        owner: string;
        total: number;
        dapps: Array<Record<string, unknown>>;
        insights: Array<{ type: string; message: string; action: string }>;
      } = {
        owner,
        total,
        dapps: dapps.map((dapp: any) => ({
          id: dapp.id,
          name: dapp.name,
          description: dapp.description,
          permlink: dapp.permlink,
          category: dapp.category,
          tags: dapp.tags,
          createdAt: dapp.createdAt,
          updatedAt: dapp.updatedAt,
          url: `https://${dapp.permlink}.walrus.dlux.io/@${owner}/${dapp.permlink}`
        })),
        insights: []
      };

      // Add insights
      if (total === 0) {
        dappList.insights.push({
          type: 'opportunity',
          message: 'No dApps published yet. Consider creating your first dApp to start monetizing.',
          action: 'Use the developer guide to create your first dApp'
        });
      } else if (total < 3) {
        dappList.insights.push({
          type: 'growth',
          message: `You have ${total} dApp(s). Consider creating more to diversify revenue streams.`,
          action: 'Experiment with different content types and categories'
        });
      }

      // Check for monetization opportunities
      const monetizedDapps = dapps.filter((d: any) => d.tags?.includes('premium') || d.tags?.includes('paid'));
      if (monetizedDapps.length === 0) {
        dappList.insights.push({
          type: 'monetization',
          message: 'None of your dApps appear to have premium content. Consider adding paid features.',
          action: 'Use premium content tools to monetize your dApps'
        });
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(dappList, null, 2)
        }]
      };
    } catch (error) {
      logger.error('Failed to list user dApps', { owner, error });
      throw new Error('Failed to list user dApps');
    }
  },

  async listPremiumContent(args: { dappId: string; owner?: string }) {
    const { dappId, owner } = args;

    try {
      // Note: This would check access for the owner, but since MCP is read-only,
      // we show all content but mark access status
      const response = await axios.get(`${WALRUS_SERVICE_URL}/premium/content/${dappId}`);
      const { contents } = response.data;

      const contentList = {
        dappId,
        total: contents.length,
        contents: contents.map((content: any) => ({
          id: content.id,
          name: content.name,
          description: content.description,
          price: content.price,
          contentType: content.contentType,
          createdAt: content.createdAt,
          // Since MCP doesn't have user context, we can't check access
          accessStatus: 'unknown',
          performance: {
            estimatedRevenue: content.price * 0.9, // Creator share
            platformFee: content.price * 0.1
          }
        })),
        summary: {
          totalValue: contents.reduce((sum: number, c: any) => sum + c.price, 0),
          averagePrice: contents.length > 0 ?
            contents.reduce((sum: number, c: any) => sum + c.price, 0) / contents.length : 0,
          contentTypes: [...new Set(contents.map((c: any) => c.contentType))]
        }
      };

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(contentList, null, 2)
        }]
      };
    } catch (error) {
      logger.error('Failed to list premium content', { dappId, owner, error });
      throw new Error('Failed to list premium content');
    }
  },

  async getContentPerformance(args: { owner: string; timeframe?: string }) {
    const { owner, timeframe = '30d' } = args;

    try {
      // Get premium content earnings
      const earningsResponse = await axios.get(`${WALRUS_SERVICE_URL}/premium/earnings/${owner}`);
      const earnings = earningsResponse.data;

      const earningsTotal = earnings.total || 0;
      const contentCount = earnings.contentCount || 0;
      const topPerformer = earnings.breakdown?.sort((a: any, b: any) => b.earnings - a.earnings)[0] || null;
      const performance: {
        owner: string;
        timeframe: string;
        earnings: { total: number; breakdown: any[]; platformFeesPaid: number };
        metrics: { totalContent: number; activeContent: number; averageEarningsPerContent: number; topPerformer: any };
        recommendations: Array<{
          type: string;
          priority: string;
          title: string;
          description: string;
          actions: string[];
        }>;
      } = {
        owner,
        timeframe,
        earnings: {
          total: earningsTotal,
          breakdown: earnings.breakdown || [],
          platformFeesPaid: earningsTotal * 0.1 // 10% platform fee
        },
        metrics: {
          totalContent: contentCount,
          activeContent: earnings.breakdown?.filter((b: any) => b.purchases > 0).length || 0,
          averageEarningsPerContent: contentCount > 0 ?
            earningsTotal / contentCount : 0,
          topPerformer: topPerformer
        },
        recommendations: []
      };

      // Add recommendations
      if (performance.metrics.totalContent === 0) {
        performance.recommendations.push({
          type: 'getting_started',
          priority: 'high',
          title: 'Create Your First Premium Content',
          description: 'Start monetizing by adding premium content to your dApps.',
          actions: [
            'Identify high-value content in your dApps',
            'Set competitive pricing (0.1-1.0 SUI)',
            'Use Seal encryption for security',
            'Promote premium content to users'
          ]
        });
      }

      if (performance.earnings.total < 1 && performance.metrics.totalContent > 0) {
        performance.recommendations.push({
          type: 'marketing',
          priority: 'medium',
          title: 'Improve Content Discoverability',
          description: 'Your content exists but isn\'t generating revenue. Focus on marketing.',
          actions: [
            'Add clear premium content indicators',
            'Create compelling descriptions',
            'Use social features to drive traffic',
            'Consider bundling content packages'
          ]
        });
      }

      if (performance.metrics.topPerformer) {
        performance.recommendations.push({
          type: 'optimization',
          priority: 'low',
          title: 'Analyze Top Performer',
          description: `Your "${performance.metrics.topPerformer.contentName}" is performing well.`,
          actions: [
            'Create similar content',
            'Study what makes it successful',
            'Apply lessons to other content',
            'Consider premium series or bundles'
          ]
        });
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(performance, null, 2)
        }]
      };
    } catch (error) {
      logger.error('Failed to get content performance', { owner, timeframe, error });
      throw new Error('Failed to get content performance');
    }
  }
};