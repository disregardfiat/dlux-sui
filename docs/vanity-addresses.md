# Vanity Address System

## Overview

Users can purchase vanity addresses (3-20 characters, URL-safe) to create memorable profile URLs. Vanity addresses can be used to:
- Create readable profile URLs (e.g., `@yourname` instead of `@0xabc123...`)
- Link multiple ZK accounts (GitHub, Gmail, Facebook) to a single vanity address
- Display profile information (avatar, banner, bio)
- View all published dApps and prediction markets

## URL Structure

- **Vanity Address**: `https://dlux.io/@yourname`
- **SUI Address**: `https://dlux.io/@0xabc123...` (fallback if no vanity)

Both URLs resolve to the same account page.

## Vanity Address Rules

- **Length**: 3-20 characters
- **Format**: Alphanumeric, hyphen, underscore only (URL-safe)
- **Case-insensitive**: `YourName` and `yourname` are the same
- **Pricing**: Shorter addresses cost more
  - 3 chars: ~1000 SUI
  - 20 chars: 1 SUI
  - Formula: `10^(4 - length)` SUI

## Features

### Profile Management

Users with vanity addresses can:
- Set display name, bio, avatar, banner
- Add website and location
- Link ZK accounts (GitHub, Gmail, Facebook)
- View all published dApps
- View prediction markets for their dApps

### Account Page

The account page (`/@identifier`) displays:
1. **Profile Header**
   - Banner image
   - Avatar with verification badge
   - Display name and vanity address
   - Bio and metadata (location, website)

2. **Linked Accounts**
   - All ZK accounts linked to the address
   - Provider icons and verification status

3. **Published dApps**
   - Grid of all dApps published by the user
   - Click to navigate to dApp

4. **Safety Reviews**
   - All prediction markets for user's dApps
   - Market status and statistics

## API Endpoints

### Vanity Service

- `GET /vanity/check/:vanity` - Check if vanity address is available
- `GET /vanity/:identifier` - Get user by vanity or SUI address
- `POST /vanity/purchase` - Purchase a vanity address
- `PUT /vanity/:vanity/profile` - Update profile

## Purchase Flow

1. User enters desired vanity address
2. System checks availability and calculates price
3. User signs transaction with SUI wallet
4. Payment is processed on SUI blockchain
5. Vanity address is registered to user's SUI address
6. User can now use `@vanity` URL

## Integration

### Vue Frontend

- Account page component: `AccountView.vue`
- Vanity purchase modal: `VanityPurchaseModal.vue`
- Router configured for `/@:identifier` pattern

### SUI Service

- Vanity service handles purchase and profile management
- Repository stores vanity addresses and profiles
- Integrated with auth service for ZK account linking

## Future Enhancements

1. **Subdomain Support**: `yourname.dlux.io` in addition to `@yourname`
2. **Transfer**: Allow transferring vanity addresses
3. **Rental**: Time-limited vanity addresses
4. **Verification Badges**: Special badges for verified accounts
5. **Social Features**: Follow/unfollow, activity feed
