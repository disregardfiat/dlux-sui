import axios from 'axios';
import { logger } from '../utils/logger.js';

const DGRAPH_SERVICE_URL = process.env.DGRAPH_SERVICE_URL || 'http://localhost:3003';

export const adTools = {
  async getAdPerformance(args: { owner: string; timeframe?: string }) {
    const { owner, timeframe = '30d' } = args;

    try {
      // Get ad revenue for the owner
      const revenueResponse = await axios.get(`${DGRAPH_SERVICE_URL}/ads/revenue/owner/${owner}`);
      const revenue = revenueResponse.data;

      // Mock additional performance metrics
      const performance = {
        owner,
        timeframe,
        revenue: {
          total: revenue.total || 0,
          events: revenue.events || 0,
          averageRPM: revenue.events > 0 ? (revenue.total / revenue.events) * 1000 : 0
        },
        metrics: {
          impressions: Math.floor((revenue.events || 0) * 10), // Mock: ~10 impressions per event
          clicks: revenue.events || 0,
          ctr: revenue.events > 0 ? ((revenue.events / (revenue.events * 10)) * 100) : 0,
          averageCPC: revenue.total > 0 ? (revenue.total / revenue.events) : 0
        },
        campaigns: [
          {
            id: 'default_campaign',
            name: 'Platform Ads',
            status: 'active',
            budget: 100,
            spent: revenue.total || 0,
            performance: revenue.events || 0
          }
        ]
      };

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(performance, null, 2)
        }]
      };
    } catch (error) {
      logger.error('Failed to get ad performance', { owner, timeframe, error });
      throw new Error('Failed to get ad performance');
    }
  },

  async getAdRecommendations(args: { owner: string; currentPerformance?: any }) {
    const { owner, currentPerformance } = args;

    try {
      // Get current performance if not provided
      let performance = currentPerformance;
      if (!performance) {
        const perfResult = await this.getAdPerformance({ owner });
        performance = JSON.parse(perfResult.content[0].text);
      }

      const recommendations: {
        owner: string;
        recommendations: Array<{
          type: string;
          priority: string;
          title: string;
          description: string;
          actions: string[];
        }>;
        priority: string;
      } = {
        owner,
        recommendations: [],
        priority: 'medium'
      };

      // Analyze performance and provide recommendations
      if (performance.metrics.ctr < 1) {
        recommendations.recommendations.push({
          type: 'content_optimization',
          priority: 'high',
          title: 'Improve Ad Content Quality',
          description: 'Your click-through rate is below average. Consider creating more engaging ad content.',
          actions: [
            'Use high-quality images or videos',
            'Write compelling headlines',
            'Target specific user interests',
            'A/B test different ad formats'
          ]
        });
        recommendations.priority = 'high';
      }

      if (performance.metrics.averageCPC > 0.01) {
        recommendations.recommendations.push({
          type: 'budget_optimization',
          priority: 'medium',
          title: 'Optimize Ad Spend',
          description: 'Your cost per click is relatively high. Consider refining your targeting.',
          actions: [
            'Narrow audience targeting',
            'Focus on high-intent users',
            'Monitor performance by content type',
            'Set daily budget limits'
          ]
        });
      }

      if (performance.revenue.total < 1) {
        recommendations.recommendations.push({
          type: 'monetization_strategy',
          priority: 'medium',
          title: 'Diversify Revenue Streams',
          description: 'Consider adding premium content alongside ads for better monetization.',
          actions: [
            'Create exclusive premium content',
            'Offer subscription tiers',
            'Bundle content packages',
            'Use prediction markets for content validation'
          ]
        });
      }

      if (recommendations.recommendations.length === 0) {
        recommendations.recommendations.push({
          type: 'maintenance',
          priority: 'low',
          title: 'Keep Up the Good Work',
          description: 'Your ad performance is solid. Continue monitoring and optimizing.',
          actions: [
            'Regular performance reviews',
            'Stay updated with platform changes',
            'Experiment with new content formats',
            'Monitor competitor strategies'
          ]
        });
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(recommendations, null, 2)
        }]
      };
    } catch (error) {
      logger.error('Failed to get ad recommendations', { owner, error });
      throw new Error('Failed to get ad recommendations');
    }
  }
};