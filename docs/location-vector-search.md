# Location-Based Vector Search

## Overview

DLUX-SUI supports privacy-preserving location-based search using Dgraph vector search capabilities. Users can opt-in to location-based discovery, allowing them to find relevant content, dApps, and users based on their geographic proximity while maintaining privacy through anonymized location zones.

## Privacy Model

### Anonymized Location Zones

To protect user privacy, location data is anonymized by subscribing to **popular spots with reduced precision**:

- **City-level zones**: ~10-50km radius (2-3 significant digits)
- **Neighborhood zones**: ~1-5km radius (3-4 significant digits)  
- **Popular landmarks**: Pre-defined zones around major points of interest

**Example:**
- Exact location: `40.7128°N, -74.0060°W` (New York City)
- Anonymized zone: `40.7°N, -74.0°W` (NYC area, ~10km precision)
- Popular spot subscription: "Times Square" or "Central Park"

This approach ensures:
- Users can discover location-relevant content
- Individual user locations cannot be precisely identified
- Location data is aggregated at a safe level of granularity
- Users maintain control over their location sharing preferences

## Opt-In Flow

### User Consent

1. **Initial Prompt**: Users are prompted to enable location-based search during onboarding or in settings
2. **Privacy Explanation**: Clear explanation of how location is anonymized
3. **Zone Selection**: Users can choose their preferred anonymization level:
   - City-level (most private)
   - Neighborhood-level (moderate privacy)
   - Popular spot subscription (specific landmarks only)
4. **Granular Control**: Users can enable/disable location search per session or permanently

### Implementation

```typescript
// User opts in to location search
interface LocationSearchPreferences {
  enabled: boolean;
  precision: 'city' | 'neighborhood' | 'landmark';
  subscribedSpots?: string[]; // e.g., ["Times Square", "Central Park"]
  sessionOnly?: boolean; // Clear on session end
}

// Anonymize user location
function anonymizeLocation(
  lat: number, 
  lon: number, 
  precision: 'city' | 'neighborhood' | 'landmark'
): { lat: number; lon: number; zone: string } {
  let digits: number;
  switch (precision) {
    case 'city':
      digits = 2; // ~10-50km radius
      break;
    case 'neighborhood':
      digits = 3; // ~1-5km radius
      break;
    case 'landmark':
      // Use predefined landmark zones
      return findNearestLandmark(lat, lon);
  }
  
  // Round to specified precision
  const factor = Math.pow(10, digits);
  const anonymizedLat = Math.round(lat * factor) / factor;
  const anonymizedLon = Math.round(lon * factor) / factor;
  
  return {
    lat: anonymizedLat,
    lon: anonymizedLon,
    zone: `${anonymizedLat.toFixed(digits)},${anonymizedLon.toFixed(digits)}`
  };
}
```

## Vector Search Architecture

### Dgraph Vector Indexing

Dgraph supports vector search through custom predicates and vector embeddings:

1. **Content Embeddings**: Content (posts, dApps) are embedded with location context
2. **Location Vectors**: Geographic coordinates are converted to vector embeddings
3. **Hybrid Search**: Combines semantic search (content meaning) with location proximity

### Schema Extension

```dql
# Location-based search preferences
type LocationSearchPreference {
  user: string @index(hash)
  enabled: bool
  precision: string @index(hash) # 'city', 'neighborhood', 'landmark'
  subscribedSpots: [string] @index(hash)
  currentZone: string @index(hash)
  updatedAt: datetime @index(hour)
}

# Location-annotated content
type SocialPost {
  # ... existing fields ...
  locationZone: string @index(hash) # Anonymized zone
  locationVector: [float] # Vector embedding for proximity search
  locationMetadata: LocationMetadata
}

type DApp {
  # ... existing fields ...
  locationZone: string @index(hash)
  locationVector: [float]
  locationMetadata: LocationMetadata
}
```

## Search Queries

### Location-Based Content Discovery

```graphql
query SearchNearbyContent(
  $query: String!
  $userZone: String!
  $radius: Float
  $limit: Int
) {
  # Vector search combining semantic + location
  searchContent(
    query: $query
    locationZone: $userZone
    radius: $radius
    limit: $limit
  ) {
    id
    content
    author
    locationZone
    distance
    relevance
  }
}
```

### Popular Spots Subscription

```graphql
query GetSpotContent(
  $spotId: String!
  $query: String
  $limit: Int
) {
  # Content from subscribed popular spots
  spotContent(spotId: $spotId, query: $query, limit: $limit) {
    id
    content
    author
    spotName
    relevance
  }
}
```

## API Endpoints

### Dgraph Service (Port 3003)

#### Location Search Preferences

- `POST /location/preferences` - Update user location search preferences
  ```json
  {
    "enabled": true,
    "precision": "city",
    "subscribedSpots": ["Times Square", "Central Park"],
    "sessionOnly": false
  }
  ```

- `GET /location/preferences` - Get user location search preferences

#### Location-Based Search

- `POST /search/location` - Search content by location proximity
  ```json
  {
    "query": "restaurants",
    "userZone": "40.7,-74.0",
    "radius": 5.0,
    "limit": 20
  }
  ```

- `GET /spots/popular` - List popular location spots available for subscription
- `POST /spots/subscribe` - Subscribe to a popular spot
- `DELETE /spots/subscribe/:spotId` - Unsubscribe from a spot

## Vector Embedding Strategy

### Location-Aware Embeddings

Content embeddings include location context:

1. **Semantic Embedding**: Standard text/content embedding (e.g., using sentence transformers)
2. **Location Embedding**: Geographic coordinates converted to vector space
3. **Combined Vector**: Concatenated or weighted combination of semantic + location vectors

```typescript
async function generateLocationAwareEmbedding(
  content: string,
  location: { lat: number; lon: number }
): Promise<number[]> {
  // Generate semantic embedding
  const semanticEmbedding = await embedText(content);
  
  // Generate location embedding (normalized coordinates)
  const locationEmbedding = [
    normalizeLat(location.lat),
    normalizeLon(location.lon)
  ];
  
  // Combine embeddings (weighted combination)
  const combined = [
    ...semanticEmbedding.map(v => v * 0.8), // 80% semantic
    ...locationEmbedding.map(v => v * 0.2)  // 20% location
  ];
  
  return combined;
}
```

## Privacy Guarantees

### Data Minimization

- Only anonymized zones are stored, never exact coordinates
- Location data is session-scoped if user prefers
- Users can revoke location sharing at any time

### Aggregation

- Search results are aggregated across zones
- Individual user locations cannot be inferred from results
- Popular spots provide additional privacy through shared zones

### User Control

- **Opt-in only**: Location search is disabled by default
- **Granular control**: Users choose precision level
- **Session-based**: Option to clear location data on session end
- **Revocable**: Users can disable location search at any time

## Use Cases

### Local Content Discovery

- Find dApps relevant to your area
- Discover local events and posts
- Connect with nearby users (anonymized)

### Popular Spot Feeds

- Subscribe to content from major landmarks
- Get updates from specific locations
- Discover trending content in your area

### Geospatial dApps

- Location-based games and AR experiences
- Local marketplace dApps
- Event discovery and coordination

## Enhancements

1. **Dynamic Zone Updates**: Adjust anonymization based on user density
2. **Privacy-Preserving Aggregation**: Use homomorphic encryption for location stats
3. **Cross-Platform Location**: Share location zones across federated ecosystems
4. **Temporal Location**: Time-based location zones (e.g., "NYC during work hours")
5. **Custom Zones**: Users define their own anonymized zones

## Security Considerations

1. **Location Spoofing**: Validate location data to prevent abuse
2. **Zone Collision**: Ensure sufficient users per zone for anonymity
3. **Data Retention**: Clear location data according to user preferences
4. **Access Control**: Only allow location search for opted-in users
5. **Audit Logging**: Track location search usage for security monitoring
