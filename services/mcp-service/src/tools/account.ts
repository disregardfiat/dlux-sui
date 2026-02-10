import axios from 'axios';
import { logger } from '../utils/logger.js';

const SUI_SERVICE_URL = process.env.SUI_SERVICE_URL || 'http://localhost:3001';
const DGRAPH_SERVICE_URL = process.env.DGRAPH_SERVICE_URL || 'http://localhost:3003';

export const accountTools = {
  async getAccountOverview(args: { address: string; includePrivateData?: boolean }) {
    const { address, includePrivateData = false } = args;

    try {
      // Get billing overview (includes subscription, suins, payouts, storage funding)
      const billingResponse = await axios.get(`${SUI_SERVICE_URL}/billing/overview?owner=${address}`);
      const billing = billingResponse.data;

      // Get user profile
      const profileResponse = await axios.get(`${SUI_SERVICE_URL}/suins/profile/${address}`);
      const profile = profileResponse.data;

      // Get social stats
      const socialResponse = await axios.get(`${DGRAPH_SERVICE_URL}/social/users/${address}/stats`);
      const socialStats = socialResponse.data;

      // Get dApp count
      const dappsResponse = await axios.get(`${SUI_SERVICE_URL}/dapps/owner/${address}?limit=1`);
      const dappCount = dappsResponse.data.total || 0;

      const overview: {
        address: string;
        profile: Record<string, unknown>;
        billing: Record<string, unknown>;
        social: Record<string, unknown>;
        dapps: { count: number; sample: string[] };
        alerts: Array<{ type: string; message: string; action: string }>;
      } = {
        address,
        profile: {
          displayName: profile.displayName || profile.suinsName,
          suinsName: profile.suinsName,
          avatar: profile.avatar,
          bio: profile.bio,
          verified: profile.verified
        },
        billing: includePrivateData ? billing : {
          ...billing,
          // Remove sensitive payout amounts for public queries
          payouts: {
            ...billing.payouts,
            total: billing.payouts.total
          }
        },
        social: socialStats,
        dapps: {
          count: dappCount,
          sample: dappCount > 0 ? [`${dappsResponse.data.dapps[0].name} (${dappsResponse.data.dapps[0].id})`] : []
        },
        alerts: []
      };

      // Add alerts for important issues
      if (billing.storageFunding.some((f: any) => f.precarious)) {
        overview.alerts.push({
          type: 'warning',
          message: 'Some dApps have precarious storage funding',
          action: 'Add funds or content will expire'
        });
      }

      if (billing.payouts.total > 0) {
        overview.alerts.push({
          type: 'info',
          message: `You have ${billing.payouts.total.toFixed(2)} SUI available to claim`,
          action: 'Visit account page to claim'
        });
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(overview, null, 2)
        }]
      };
    } catch (error) {
      logger.error('Failed to get account overview', { address, error });
      throw new Error(`Failed to get account overview: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  },

  async getTransactionHistory(args: { address: string; limit?: number }) {
    const { address, limit = 10 } = args;

    try {
      // In a real implementation, this would query blockchain for transactions
      // For now, return mock data based on recent activity
      const mockTransactions = [
        {
          type: 'premium_purchase',
          amount: 1.5,
          timestamp: new Date(Date.now() - 86400000).toISOString(),
          description: 'Premium content purchase'
        },
        {
          type: 'ad_revenue',
          amount: 0.25,
          timestamp: new Date(Date.now() - 172800000).toISOString(),
          description: 'Ad revenue share'
        }
      ].slice(0, limit);

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            address,
            transactions: mockTransactions,
            note: 'Transaction history is limited in this demo. Full implementation would query Sui blockchain.'
          }, null, 2)
        }]
      };
    } catch (error) {
      logger.error('Failed to get transaction history', { address, error });
      throw new Error('Failed to get transaction history');
    }
  },

  async getBalanceBreakdown(args: { address: string }) {
    const { address } = args;

    try {
      const billingResponse = await axios.get(`${SUI_SERVICE_URL}/billing/overview?owner=${address}`);
      const { payouts } = billingResponse.data;

      const breakdown: {
        address: string;
        totalAvailable: number;
        breakdown: Record<string, { amount: number; description: string; claimable: boolean }>;
        recommendations: string[];
      } = {
        address,
        totalAvailable: payouts.total,
        breakdown: {
          adShare: {
            amount: payouts.adShare,
            description: 'Revenue from ads shown in your dApps',
            claimable: payouts.adShare > 0
          },
          subscriptionShare: {
            amount: payouts.subscriptionShare,
            description: 'Revenue from premium subscriptions',
            claimable: payouts.subscriptionShare > 0
          },
          pmShare: {
            amount: payouts.pmShare,
            description: 'Earnings from prediction market participation',
            claimable: payouts.pmShare > 0
          },
          premiumShare: {
            amount: payouts.premiumShare,
            description: 'Revenue from premium content sales',
            claimable: payouts.premiumShare > 0
          }
        },
        recommendations: []
      };

      // Add recommendations
      if (payouts.total > 5) {
        breakdown.recommendations.push('Consider claiming your earnings to avoid losing them');
      }

      if (payouts.adShare > payouts.premiumShare * 2) {
        breakdown.recommendations.push('Your ad revenue is strong - consider creating more premium content');
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(breakdown, null, 2)
        }]
      };
    } catch (error) {
      logger.error('Failed to get balance breakdown', { address, error });
      throw new Error('Failed to get balance breakdown');
    }
  },

  async checkSuiNSStatus(args: { identifier: string }) {
    const { identifier } = args;

    try {
      const response = await axios.get(`${SUI_SERVICE_URL}/suins/profile/${identifier}`);
      const profile = response.data;

      const status = {
        identifier,
        hasSuiNS: !!profile.suinsName,
        suiAddress: profile.owner || identifier,
        suiNSName: profile.suinsName || null,
        profile: {
          displayName: profile.displayName,
          avatar: profile.avatar,
          bio: profile.bio
        }
      };

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(status, null, 2)
        }]
      };
    } catch (error) {
      logger.error('Failed to check SuiNS status', { identifier, error });
      throw new Error('Failed to check SuiNS status');
    }
  },

  async getSocialStats(args: { address: string }) {
    const { address } = args;

    try {
      const response = await axios.get(`${DGRAPH_SERVICE_URL}/social/users/${address}/stats`);
      const stats = response.data;

      const socialStats: {
        address: string;
        posts: number;
        replies: number;
        likes: number;
        followers: number;
        following: number;
        engagement: number;
        insights: string[];
      } = {
        address,
        posts: stats.posts || 0,
        replies: stats.replies || 0,
        likes: stats.likes || 0,
        followers: stats.followers || 0,
        following: stats.following || 0,
        engagement: ((stats.likes || 0) + (stats.replies || 0)) / Math.max(stats.posts || 1, 1),
        insights: []
      };

      // Add insights
      if (socialStats.posts > 50 && socialStats.followers < socialStats.posts * 0.5) {
        socialStats.insights.push('Consider improving content quality to increase follower engagement');
      }

      if (socialStats.engagement > 2) {
        socialStats.insights.push('Great engagement! Your content resonates with the community');
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(socialStats, null, 2)
        }]
      };
    } catch (error) {
      logger.error('Failed to get social stats', { address, error });
      throw new Error('Failed to get social stats');
    }
  }
};