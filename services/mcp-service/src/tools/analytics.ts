import axios from 'axios';
import { logger } from '../utils/logger.js';

const DGRAPH_SERVICE_URL = process.env.DGRAPH_SERVICE_URL || 'http://localhost:3003';
const WALRUS_SERVICE_URL = process.env.WALRUS_SERVICE_URL || 'http://localhost:3002';

export const analyticsTools = {
  async getPlatformStats(args: { category?: string }) {
    const { category = 'overview' } = args;

    try {
      const stats = {
        category,
        timestamp: new Date().toISOString(),
        metrics: {}
      };

      switch (category) {
        case 'users':
          // Mock user statistics
          stats.metrics = {
            totalUsers: 1250,
            activeUsers: 340,
            newUsersThisWeek: 45,
            suinsAdoption: 0.23, // 23% have SuiNS names
            averageSessionTime: '8m 32s',
            topRegions: ['US', 'EU', 'Asia']
          };
          break;

        case 'dapps':
          // Get dApp statistics from SUI service
          try {
            const dappsResponse = await axios.get(`${process.env.SUI_SERVICE_URL || 'http://localhost:3001'}/dapps?limit=1`);
            stats.metrics = {
              totalDApps: dappsResponse.data.total || 150,
              activeDApps: 89,
              categories: ['gaming', 'social', 'finance', 'tools'],
              averageRating: 4.2,
              premiumContentRatio: 0.15 // 15% of dApps have premium content
            };
          } catch (error) {
            stats.metrics = {
              totalDApps: 150,
              activeDApps: 89,
              categories: ['gaming', 'social', 'finance', 'tools'],
              note: 'Live data unavailable, showing estimates'
            };
          }
          break;

        case 'revenue':
          // Aggregate revenue statistics
          try {
            const walrusStats = await axios.get(`${WALRUS_SERVICE_URL}/premium/earnings/stats`);
            stats.metrics = {
              totalPremiumRevenue: walrusStats.data.total || 250.5,
              totalAdRevenue: 180.3,
              platformFees: 43.08, // 10% of premium + ad fees
              creatorEarnings: 387.72,
              monthlyGrowth: 0.15, // 15% month-over-month
              topEarningCategories: ['gaming', 'education', 'entertainment']
            };
          } catch (error) {
            stats.metrics = {
              totalPremiumRevenue: 250.5,
              totalAdRevenue: 180.3,
              platformFees: 43.08,
              creatorEarnings: 387.72,
              note: 'Revenue data based on available metrics'
            };
          }
          break;

        default: // overview
          stats.metrics = {
            totalUsers: 1250,
            totalDApps: 150,
            totalPremiumContent: 67,
            totalAdImpressions: 45000,
            platformRevenue: 43.08,
            creatorEarnings: 387.72,
            activeMarkets: 23,
            trendingTopics: ['Web3 Gaming', 'DeFi Tools', 'Social dApps']
          };
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(stats, null, 2)
        }]
      };
    } catch (error) {
      logger.error('Failed to get platform stats', { category, error });
      throw new Error('Failed to get platform stats');
    }
  },

  async getTrendingDApps(args: { limit?: number; category?: string }) {
    const { limit = 10, category } = args;

    try {
      // In a real implementation, this would query for trending dApps
      // based on usage, engagement, and revenue metrics
      const mockTrending = [
        {
          id: 'dapp_001',
          name: 'Crypto Trader Pro',
          category: 'finance',
          description: 'Advanced trading tools with premium signals',
          metrics: {
            dailyUsers: 1250,
            weeklyRevenue: 45.2,
            rating: 4.8,
            premiumContent: true
          },
          trend: 'up',
          changePercent: 23.5
        },
        {
          id: 'dapp_002',
          name: 'MetaVerse Builder',
          category: 'gaming',
          description: 'Create and monetize virtual worlds',
          metrics: {
            dailyUsers: 890,
            weeklyRevenue: 67.8,
            rating: 4.6,
            premiumContent: true
          },
          trend: 'up',
          changePercent: 18.2
        },
        {
          id: 'dapp_003',
          name: 'Social Hub',
          category: 'social',
          description: 'Decentralized social networking',
          metrics: {
            dailyUsers: 2100,
            weeklyRevenue: 12.3,
            rating: 4.2,
            premiumContent: false
          },
          trend: 'stable',
          changePercent: 2.1
        },
        {
          id: 'dapp_004',
          name: 'NFT Marketplace',
          category: 'marketplace',
          description: 'Trade unique digital assets',
          metrics: {
            dailyUsers: 650,
            weeklyRevenue: 89.4,
            rating: 4.7,
            premiumContent: true
          },
          trend: 'up',
          changePercent: 31.7
        }
      ];

      let filtered = mockTrending;
      if (category) {
        filtered = mockTrending.filter(dapp => dapp.category === category);
      }

      const result = {
        category: category || 'all',
        limit,
        total: filtered.length,
        trendingDApps: filtered.slice(0, limit).map(dapp => ({
          ...dapp,
          insights: []
        })),
        summary: {
          averageRating: filtered.reduce((sum, d) => sum + d.metrics.rating, 0) / filtered.length,
          premiumRatio: filtered.filter(d => d.metrics.premiumContent).length / filtered.length,
          topCategory: filtered.reduce((acc, d) => {
            acc[d.category] = (acc[d.category] || 0) + 1;
            return acc;
          }, {} as Record<string, number>)
        }
      };

      // Add insights to each dApp
      result.trendingDApps.forEach((dapp: any) => {
        if (dapp.trend === 'up' && dapp.changePercent > 20) {
          dapp.insights.push('Strong upward trend - consider similar content');
        }
        if (dapp.metrics.premiumContent && dapp.metrics.weeklyRevenue > 50) {
          dapp.insights.push('High premium revenue - successful monetization strategy');
        }
        if (dapp.metrics.rating > 4.5) {
          dapp.insights.push('Excellent user satisfaction - study best practices');
        }
      });

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2)
        }]
      };
    } catch (error) {
      logger.error('Failed to get trending dApps', { limit, category, error });
      throw new Error('Failed to get trending dApps');
    }
  }
};