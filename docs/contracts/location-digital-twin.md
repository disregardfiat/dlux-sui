# Location & Digital Twin Metadata

**Module:** `dlux::metadata_pm`  
**Location:** `contracts/metadata_pm/sources/metadata_pm.move`

## Overview

The metadata contract provides location and digital twin support for content and ads, enabling geospatial targeting and virtual world integration.

## Location Metadata

### LocationMetadata Struct

Represents a geographic location with optional planet specification.

```move
public struct LocationMetadata has store {
    latitude: u64,   // Scaled by 1e6 (e.g., 40600000 = 40.6 degrees)
    longitude: u64,  // Scaled by 1e6 (e.g., -74000000 = -74.0 degrees)
    elevation: u64,  // Elevation in meters
    planet: u8,      // 0=Earth, 1=Moon, 2=Mars
}
```

### Creating Location Metadata

```move
public fun create_location_metadata(
    latitude: u64,
    longitude: u64,
    elevation: u64,
    planet: u8
): LocationMetadata
```

**Example:**
```move
// New York City, Earth
let nyc = create_location_metadata(
    40600000,   // 40.6 degrees latitude
    -74000000,  // -74.0 degrees longitude
    10,         // 10 meters elevation
    0           // Earth
);

// Lunar Base Alpha, Moon
let moon_base = create_location_metadata(
    0,          // Equator
    0,          // Prime meridian
    0,          // Surface level
    1           // Moon
);
```

## Digital Twin Origin Marker

### DigitalTwinOrigin Struct

Represents a 6DOF (six degrees of freedom) pose for digital twin positioning in virtual worlds.

```move
public struct DigitalTwinOrigin has store {
    gltf_index: vector<u8>,  // GLTF file reference or index
    position_x: u64,         // Position X (scaled)
    position_y: u64,         // Position Y (scaled)
    position_z: u64,         // Position Z (scaled)
    rotation_x: u64,         // Rotation X (quaternion component, scaled)
    rotation_y: u64,         // Rotation Y (quaternion component, scaled)
    rotation_z: u64,         // Rotation Z (quaternion component, scaled)
    rotation_w: u64,         // Rotation W (quaternion component, scaled)
}
```

### Creating Digital Twin Origin

```move
public fun create_digital_twin_origin(
    gltf_index: vector<u8>,
    position_x: u64,
    position_y: u64,
    position_z: u64,
    rotation_x: u64,
    rotation_y: u64,
    rotation_z: u64,
    rotation_w: u64
): DigitalTwinOrigin
```

**Example:**
```move
// Digital twin at origin with identity rotation
let origin = create_digital_twin_origin(
    b"models/building.gltf",  // GLTF file reference
    0,                        // X position
    0,                        // Y position
    0,                        // Z position
    0,                        // Rotation X (quaternion)
    0,                        // Rotation Y (quaternion)
    0,                        // Rotation Z (quaternion)
    1000000                   // Rotation W = 1.0 (scaled by 1e6)
);
```

## Ad Campaign Targeting

### User Zones (GeoIP Targeting)

Campaigns can target users by geographic zones:

```move
// Target users in US and EU
let user_zones = vector[
    b"US",
    b"EU"
];

// Target users on Moon
let user_zones = vector[
    b"MOON"
];
```

### Content Zones

Campaigns can target content in specific zones:

```move
// Target content in NYC and London
let content_zones = vector[
    b"NYC",
    b"LON"
];

// Target lunar base content
let content_zones = vector[
    b"LUNAR_BASE_ALPHA"
];
```

### Planet Specification

Campaigns can specify which planet they target:

```move
// Earth campaign (default)
let planet = option::some(0);  // 0 = Earth

// Moon campaign
let planet = option::some(1);  // 1 = Moon

// Mars campaign
let planet = option::some(2);  // 2 = Mars

// No planet restriction
let planet = option::none();
```

## Usage in Campaign Creation

```typescript
// Create campaign with location targeting
const tx = new TransactionBlock();

tx.moveCall({
  target: `${PACKAGE_ID}::ad_campaigns::create_campaign_entry`,
  arguments: [
    // ... standard campaign params ...
    tx.pure([Buffer.from("US"), Buffer.from("EU")]),  // user_zones
    tx.pure([Buffer.from("NYC")]),                     // content_zones
    tx.pure(0),                                        // planet: Earth
    // ...
  ],
});

// Create campaign for Moon digital twin
tx.moveCall({
  target: `${PACKAGE_ID}::ad_campaigns::create_campaign_entry`,
  arguments: [
    // ... standard campaign params ...
    tx.pure([Buffer.from("MOON")]),                   // user_zones
    tx.pure([Buffer.from("LUNAR_BASE")]),             // content_zones
    tx.pure(1),                                        // planet: Moon
    // ...
  ],
});
```

## Coordinate Scaling

All coordinates use fixed-point scaling:

- **Latitude/Longitude**: Scaled by 1e6 (multiply degrees by 1,000,000)
  - Example: 40.6° = 40600000
  - Example: -74.0° = -74000000

- **Elevation**: Meters (no scaling)

- **Position (6DOF)**: Scaled by 1e6
  - Example: 1.5 units = 1500000

- **Rotation (Quaternion)**: Scaled by 1e6
  - Example: 1.0 = 1000000, 0.5 = 500000

## Integration with dApps

dApps can specify location and digital twin origins:

```javascript
// Set location metadata
const location = {
  latitude: 40.6 * 1e6,   // NYC
  longitude: -74.0 * 1e6,
  elevation: 10,
  planet: 0  // Earth
};

// Set digital twin origin
const origin = {
  gltfIndex: "models/my-building.gltf",
  position: { x: 0, y: 0, z: 0 },
  rotation: { x: 0, y: 0, z: 0, w: 1.0 }
};
```

## Future Enhancements

- Multi-planet campaigns
- Dynamic zone updates
- 6DOF interpolation
- GLTF asset verification
- Zone-based pricing