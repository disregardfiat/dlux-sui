# Prediction Market Service

Service for managing prediction markets around dApp safety metrics.

## Features

- Create prediction markets when dApps are posted (50% of posting fee goes to market)
- Create markets when dApp files change
- Create markets when someone flags a dApp
- Place bets on market outcomes
- Auto-resolve markets after 3 days based on market odds
- Provide safety status (green/yellow/red) for dApps

## API Endpoints

### Markets

- `POST /markets` - Create a new market
- `POST /markets/:marketId/bets` - Place a bet
- `GET /markets/:marketId/status` - Get market status with color
- `POST /markets/:marketId/resolve` - Manually resolve a market
- `GET /markets/dapp/:dappId` - Get active markets for a dApp

### Safety

- `GET /safety/dapp/:dappId` - Get overall safety status
- `POST /safety/flag` - Flag a dApp for safety issues

## Market Resolution

Markets resolve after 3 days based on which side has more total value:
- If `safePool > unsafePool` → resolution is "safe"
- Otherwise → resolution is "unsafe"

Winnings are distributed proportionally to winning bettors.
