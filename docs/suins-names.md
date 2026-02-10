# SuiNS Names

## Overview

DLUX uses SuiNS for readable identities instead of a custom naming system. SuiNS names provide:
- Clean profile URLs (`/@yourname`)
- Consistent identity across the Sui ecosystem
- Portable ownership and name management

## URL Structure

- **SuiNS Name**: `https://dlux.io/@yourname`
- **SUI Address**: `https://dlux.io/@0xabc123...` (fallback if no SuiNS name)

Both URLs resolve to the same account page.

## Registration Flow

1. Enter desired SuiNS name on your profile page
2. Check availability (via SuiNS resolver service)
3. Continue to registration (opens the SuiNS registration portal)
4. Complete the SuiNS registration transaction in your wallet
5. Your profile and dApp URLs now use your SuiNS name

## API Endpoints

### SuiNS Service (SUI Service, Port 3001)

- `GET /suins/availability/:name` - Check if name is available
- `GET /suins/resolve/:name` - Resolve name to address
- `GET /suins/reverse/:address` - Reverse resolve address to name
- `GET /suins/profile/:identifier` - Get user profile by name or address
- `POST /suins/register-intent` - Get registration URL (supports referral tracking)

## Notes

- SuiNS names are ecosystem-wide and managed on Sui mainnet.
- **SUINS always uses mainnet API**: The SUINS resolver service always queries mainnet regardless of the `SUI_NETWORK` setting. This allows resolving mainnet SUINS names even when the DLUX app is running on testnet.
- Registration fees are set by SuiNS; referral tracking can be configured via environment variables.
- `SUINS_SERVICE_URL` should point to a mainnet SUINS resolver service.
