# Premium Content System

## Overview

The premium content system enables dApp creators to monetize digital assets through programmable encryption and access control using Sui's Seal protocol. Content is encrypted server-side and access is granted only to paying users, creating a secure paywall system.

## Key Features

1. **Seal Integration**: Uses Sui's programmable encryption for content protection
2. **Flexible Pricing**: Set custom SUI prices for any digital content
3. **Instant Access**: One-time payments grant permanent access to content
4. **Creator Control**: Full management of content and access rights
5. **Audit Trail**: Complete tracking of purchases and access grants

## Architecture

### Seal Protocol Integration

```
Content Upload → Seal Encryption → Walrus Storage → Access Grants
     ↑              ↓                    ↓            ↓
   Creator       Encrypted            Blob ID     Purchasing
   Uploads        Content            Stored        Users
```

### Data Flow

1. **Encryption**: Content is encrypted with Seal before Walrus storage
2. **Storage**: Encrypted content stored as Walrus blobs
3. **Metadata**: Content info and pricing stored in service database
4. **Purchase**: Users pay in SUI, receive Seal access grants
5. **Access**: Authorized users decrypt content on-demand

## API Endpoints

### Content Management

#### Create Premium Content
```http
POST /premium/content
Content-Type: multipart/form-data

file: <binary file>
name: "Premium Video"
description: "Exclusive content"
price: 0.5
contentType: "video/mp4"
owner: "0x..."
dappId: "dapp_123"
```

**Response:**
```json
{
  "contentId": "premium_123",
  "sealObjectId": "0x...",
  "name": "Premium Video",
  "price": 0.5,
  "createdAt": "2024-01-13T..."
}
```

#### List Premium Content
```http
GET /premium/content/{dappId}?user={userAddress}
```

**Response:**
```json
{
  "contents": [
    {
      "id": "premium_123",
      "name": "Premium Video",
      "description": "Exclusive content",
      "price": 0.5,
      "contentType": "video/mp4",
      "createdAt": "2024-01-13T...",
      "hasAccess": false,
      "canPurchase": true
    }
  ]
}
```

### Purchase & Access

#### Purchase Content
```http
POST /premium/purchase
Content-Type: application/json

{
  "contentId": "premium_123",
  "buyer": "0x...",
  "paymentTxId": "0x..."
}
```

**Response:**
```json
{
  "success": true,
  "contentId": "premium_123",
  "accessGrantId": "grant_123",
  "grantedAt": "2024-01-13T..."
}
```

#### Access Content
```http
GET /premium/access/{contentId}?user={userAddress}
```

**Response:** Binary content blob

### User Management

#### Get User Purchases
```http
GET /premium/purchases/{userAddress}
```

**Response:**
```json
{
  "purchases": [
    {
      "id": "purchase_123",
      "contentId": "premium_123",
      "contentName": "Premium Video",
      "price": 0.5,
      "purchasedAt": "2024-01-13T...",
      "accessGrantId": "grant_123"
    }
  ]
}
```

## Frontend Integration

### dApp API

Premium content functionality is automatically injected into dApps:

```javascript
// Create premium content
const result = await window.dluxPremium.createContent(file, {
  name: "My Premium Content",
  description: "Exclusive access",
  price: 0.1,
  owner: userAddress,
  dappId: currentDappId
});

// Get available premium content
const { contents } = await window.dluxPremium.getContent(currentDappId, userAddress);

// Purchase content
const purchase = await window.dluxPremium.purchaseContent(contentId, paymentTxId);

// Access purchased content
const contentBlob = await window.dluxPremium.accessContent(contentId);
```

### Paywall Implementation

```javascript
// Check if user has access
const { contents } = await window.dluxPremium.getContent(dappId, userAddress);
const content = contents.find(c => c.id === contentId);

if (!content.hasAccess) {
  // Show paywall
  showPaywall(content);
} else {
  // Show content
  showContent(content);
}

// Handle purchase (real SUI transfer)
async function purchaseContent(contentId, content) {
  try {
    // Transfer SUI to creator and record purchase (one call)
    await window.dluxPremium.purchaseContentWithTransfer(
      contentId,
      content.owner,
      content.price
    );
    location.reload();
  } catch (error) {
    showError('Purchase failed: ' + error.message);
  }
}

// Or: transfer and purchase separately
async function purchaseContentManual(contentId, content) {
  const digest = await window.dluxPremium.transferSui(content.owner, content.price);
  await window.dluxPremium.purchaseContent(contentId, digest);
}
```

## Payment Flow

### SUI Payment Process

1. **Price Display**: Content price shown in SUI
2. **Wallet Connection**: User connects SUI wallet
3. **Transaction Creation**: dApp creates SUI transfer transaction
4. **User Approval**: User signs and submits transaction
5. **Verification**: Service verifies payment on blockchain
6. **Access Grant**: Seal access granted upon confirmation
7. **Content Access**: User can now decrypt and view content

### Transaction Structure

```javascript
// Example payment transaction
const paymentTx = {
  to: contentOwnerAddress,
  amount: content.price,
  memo: `Premium content purchase: ${contentId}`
};
```

### Platform Fees & Moderation

#### Automatic Platform Fee Deduction

All premium content purchases include an automatic 10% platform fee that supports platform development:

- **Creator Receives**: 90% of the purchase price
- **Platform Fee**: 10% sent to foundation address
- **Fee Distribution**: Handled automatically during purchase verification

#### Moderation Access

Platform moderation accounts have automatic access to all premium content for safety reviews:

```bash
# Environment configuration
PLATFORM_FEE_PERCENT=0.10
FOUNDATION_ADDRESS=0xfoundation_address_here
MODERATION_ADDRESSES=0xmoderator1,0xmoderator2,0xmoderator3
```

Moderation accounts can access any premium content without purchasing, ensuring compliance and safety reviews are possible.

## Security Considerations

1. **Encryption**: Content encrypted with Seal before storage
2. **Access Control**: Seal grants control decryption permissions
3. **Payment Verification**: Blockchain-verified SUI transactions
4. **Audit Trail**: All purchases and access grants logged
5. **Revocation**: Content owners can revoke access if needed

## Content Types

Supported for premium monetization:
- **Videos**: MP4, WebM, MOV
- **Audio**: MP3, WAV, FLAC
- **Images**: High-resolution photos, artwork
- **Documents**: PDFs, eBooks, exclusive content
- **3D Models**: GLTF, OBJ, USDZ
- **Code/Assets**: Premium templates, scripts
- **Archives**: ZIP files with multiple assets

## Creator Dashboard

### Content Management

- Upload new premium content
- Set pricing and descriptions
- View sales analytics
- Manage access rights
- Update content metadata

### Revenue Tracking

- Total sales revenue
- Content performance metrics
- User acquisition stats
- Payout claim interface

## Future Enhancements

1. **Subscription Tiers**: Recurring payments for content series
2. **Dynamic Pricing**: AI-powered price optimization
3. **Content Analytics**: Detailed usage and engagement metrics
4. **Bulk Operations**: Manage multiple content pieces
5. **Content Licensing**: Time-limited or usage-based access
6. **Social Features**: Content sharing and recommendations

## E2E Coverage

| Journey | Spec | Browser |
|---------|------|---------|
| Premium content browser | `premium-content-browser.spec.ts` | yes |
| Premium content API | `premium-content.spec.ts` | no (API) |