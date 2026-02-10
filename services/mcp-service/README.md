# DLUX-SUI MCP Service

A Model Context Protocol server that provides AI assistants with safe, controlled access to DLUX-SUI platform operations.

## Overview

The MCP service enables AI agents to:
- ✅ Read account data and analytics
- ✅ Monitor ad performance and revenue
- ✅ Manage dApps and premium content (with user approval)
- ✅ Access platform analytics and insights
- ❌ **NEVER** access or store private keys

## Security Model

**Zero Private Key Exposure:**
- MCP server performs read-only operations
- Write operations require explicit user approval via wallet signatures
- No custodial key management
- All blockchain operations initiated by users

## Available Tools

### Account Management (Read-Only)
- `get_account_overview` - Complete account dashboard
- `get_transaction_history` - Recent transactions
- `get_balance_breakdown` - SUI balance details
- `check_suins_status` - SuiNS name status
- `get_social_stats` - Posts, followers, engagement

### Ad Management
- `get_ad_performance` - Campaign analytics
- `monitor_ad_revenue` - Revenue tracking
- `get_ad_recommendations` - Optimization suggestions
- `check_ad_compliance` - Safety status

### Content Management
- `list_user_dapps` - User's published dApps
- `get_dapp_analytics` - dApp usage stats
- `list_premium_content` - Premium content inventory
- `get_content_performance` - Sales and engagement

### Platform Analytics
- `get_platform_stats` - Overall platform metrics
- `get_trending_dapps` - Popular content
- `get_market_insights` - PM and governance data

## Architecture

```
AI Assistant → MCP Server → DLUX Services
       ↓             ↓
User Approval → Wallet Signature → Blockchain
```

## Installation

```bash
npm install
npm run build
npm start
```

## Configuration

```env
PORT=3009
SUI_SERVICE_URL=http://localhost:3001
DGRAPH_SERVICE_URL=http://localhost:3003
WALRUS_SERVICE_URL=http://localhost:3002
# No private keys stored here!
```

## Usage Examples

### Account Management
```javascript
// AI can check account status
const overview = await mcp.get_account_overview({
  address: "0x123...",
  includePrivateData: false  // Only public data
});

// AI can suggest optimizations
if (overview.storageFunding.some(f => f.precarious)) {
  console.log("⚠️ Storage funding at risk - recommend adding funds");
}
```

### Ad Optimization
```javascript
// AI monitors ad performance
const performance = await mcp.get_ad_performance({
  owner: "0x123...",
  timeframe: "30d"
});

// AI provides recommendations
if (performance.ctr < 0.02) {
  console.log("📈 Consider updating ad creative for better engagement");
}
```

### Content Strategy
```javascript
// AI analyzes content performance
const content = await mcp.list_premium_content("dapp_123");
const topPerformer = content.sort((a,b) => b.sales - a.sales)[0];

// AI suggests new content ideas
console.log(`💡 Create more ${topPerformer.category} content - high demand!`);
```

## Security Guarantees

1. **No Private Key Storage** - MCP never sees or stores wallet keys
2. **Read-Only by Default** - Most operations are read-only
3. **User Approval Required** - Write operations need explicit consent
4. **Audit Logging** - All operations are logged for transparency
5. **Rate Limiting** - Prevents abuse and ensures fair usage

## Integration

The MCP service integrates with existing DLUX infrastructure:

- **SUI Service**: Account and transaction data
- **DGraph Service**: Social and analytics data
- **Walrus Service**: Content and storage data
- **PM Service**: Market and governance data

## Future Extensions

- Content generation suggestions
- Automated ad campaign optimization
- Smart contract deployment assistance
- Multi-platform content distribution
- Revenue optimization recommendations