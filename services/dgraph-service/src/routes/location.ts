import express from 'express';
import { dgraphClient } from '../dgraph/client';
import { logger } from '../utils/logger';
import { sameParty } from '../middleware/auth';

const router = express.Router();

// Location search preferences
interface LocationSearchPreference {
  user: string;
  enabled: boolean;
  precision: 'city' | 'neighborhood' | 'landmark';
  subscribedSpots?: string[];
  currentZone?: string;
  sessionOnly?: boolean;
  updatedAt: string;
}

// Anonymize location to specified precision
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
      // For landmarks, use predefined zones (simplified - would need landmark database)
      digits = 2;
      break;
    default:
      digits = 2;
  }

  const factor = Math.pow(10, digits);
  const anonymizedLat = Math.round(lat * factor) / factor;
  const anonymizedLon = Math.round(lon * factor) / factor;

  return {
    lat: anonymizedLat,
    lon: anonymizedLon,
    zone: `${anonymizedLat.toFixed(digits)},${anonymizedLon.toFixed(digits)}`
  };
}

// POST /location/preferences - Update user location search preferences. Requires JWT as that user.
router.post('/preferences', async (req, res) => {
  try {
    const { user, enabled, precision, subscribedSpots, currentZone, sessionOnly } = req.body;

    if (!user) {
      return res.status(400).json({ error: 'user is required' });
    }
    if (!req.auth || !sameParty(req.auth.suiAddress, user)) {
      return res.status(403).json({ error: 'Must be authenticated as the user to update preferences' });
    }

    if (enabled === undefined) {
      return res.status(400).json({ error: 'enabled is required' });
    }

    const validPrecisions = ['city', 'neighborhood', 'landmark'];
    const finalPrecision = precision || 'city';
    if (!validPrecisions.includes(finalPrecision)) {
      return res.status(400).json({ error: `precision must be one of: ${validPrecisions.join(', ')}` });
    }

    // Upsert location preference
    const mutation = {
      set: {
        uid: `_:pref_${user}`,
        dgraph_type: 'LocationSearchPreference',
        user,
        enabled,
        precision: finalPrecision,
        subscribedSpots: subscribedSpots || [],
        currentZone: currentZone || '',
        sessionOnly: sessionOnly || false,
        updatedAt: new Date().toISOString()
      }
    };

    await dgraphClient.mutate(mutation);

    logger.info('Location preference updated', { user, enabled, precision: finalPrecision });

    res.json({
      success: true,
      preference: {
        user,
        enabled,
        precision: finalPrecision,
        subscribedSpots: subscribedSpots || [],
        currentZone: currentZone || '',
        sessionOnly: sessionOnly || false,
        updatedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    logger.error('Failed to update location preference', error);
    res.status(500).json({ error: 'Failed to update location preference' });
  }
});

// GET /location/preferences - Get user location search preferences. Requires JWT as that user.
router.get('/preferences', async (req, res) => {
  try {
    const { user } = req.query;

    if (!user || typeof user !== 'string') {
      return res.status(400).json({ error: 'user query parameter is required' });
    }
    if (!req.auth || !sameParty(req.auth.suiAddress, user)) {
      return res.status(403).json({ error: 'Can only read your own location preferences' });
    }

    const query = `
      query preferences($user: string) {
        preferences(func: eq(user, $user)) @filter(type(LocationSearchPreference)) {
          user
          enabled
          precision
          subscribedSpots
          currentZone
          sessionOnly
          updatedAt
        }
      }
    `;

    const result = await dgraphClient.query(query, { $user: user });

    const preference = result.preferences?.[0];

    if (!preference) {
      return res.json({
        preference: {
          user,
          enabled: false,
          precision: 'city',
          subscribedSpots: [],
          currentZone: '',
          sessionOnly: false
        }
      });
    }

    res.json({ preference });
  } catch (error) {
    logger.error('Failed to get location preference', error);
    res.status(500).json({ error: 'Failed to get location preference' });
  }
});

// POST /search/location - Search content by location proximity
// Also accessible via POST /location/search
router.post('/search', async (req, res) => {
  try {
    const { query: searchQuery, userZone, radius = 5.0, limit = 20 } = req.body;

    if (!userZone) {
      return res.status(400).json({ error: 'userZone is required' });
    }

    // Parse zone (format: "lat,lon")
    const [latStr, lonStr] = userZone.split(',');
    const lat = parseFloat(latStr);
    const lon = parseFloat(lonStr);

    if (isNaN(lat) || isNaN(lon)) {
      return res.status(400).json({ error: 'userZone must be in format "lat,lon"' });
    }

    // Calculate approximate bounding box for radius (simplified - assumes 1 degree ≈ 111km)
    const latDelta = radius / 111.0;
    const lonDelta = radius / (111.0 * Math.cos(lat * Math.PI / 180));

    const minLat = lat - latDelta;
    const maxLat = lat + latDelta;
    const minLon = lon - lonDelta;
    const maxLon = lon + lonDelta;

    // Search for content in the zone
    // Note: This is a simplified implementation - full vector search would require
    // vector embeddings and Dgraph vector search capabilities
    let dqlQuery = `
      query searchLocation($minLat: float, $maxLat: float, $minLon: float, $maxLon: float, $limit: int) {
        var(func: type(SocialPost)) @filter(ge(locationLat, $minLat) AND le(locationLat, $maxLat) AND ge(locationLon, $minLon) AND le(locationLon, $maxLon)) {
          distance as math(sqrt(
            pow(locationLat - ${lat}, 2) + pow(locationLon - ${lon}, 2)
          ))
        }
        
        content(func: uid(var), orderasc: distance, first: $limit) {
          id: uid
          author
          content
          locationZone
          locationLat
          locationLon
          distance: math(sqrt(
            pow(locationLat - ${lat}, 2) + pow(locationLon - ${lon}, 2)
          )) * 111.0
          createdAt
        }
      }
    `;

    // If search query provided, filter by content
    if (searchQuery) {
      dqlQuery = `
        query searchLocation($minLat: float, $maxLat: float, $minLon: float, $maxLon: float, $query: string, $limit: int) {
          var(func: type(SocialPost)) @filter(anyoftext(content, $query) AND ge(locationLat, $minLat) AND le(locationLat, $maxLat) AND ge(locationLon, $minLon) AND le(locationLon, $maxLon)) {
            distance as math(sqrt(
              pow(locationLat - ${lat}, 2) + pow(locationLon - ${lon}, 2)
            ))
          }
          
          content(func: uid(var), orderasc: distance, first: $limit) {
            id: uid
            author
            content
            locationZone
            locationLat
            locationLon
            distance: math(sqrt(
              pow(locationLat - ${lat}, 2) + pow(locationLon - ${lon}, 2)
            )) * 111.0
            createdAt
          }
        }
      `;
    }

    try {
      const result = await dgraphClient.query(
        dqlQuery,
        searchQuery
          ? { $minLat: minLat, $maxLat: maxLat, $minLon: minLon, $maxLon: maxLon, $query: searchQuery, $limit: limit }
          : { $minLat: minLat, $maxLat: maxLat, $minLon: minLon, $maxLon: maxLon, $limit: limit }
      );

      const content = (result.content || []).map((item: any) => ({
        id: item.id,
        content: item.content,
        author: item.author,
        locationZone: item.locationZone,
        distance: item.distance,
        relevance: 1.0 - (item.distance / (radius * 2)), // Simple relevance score
        createdAt: item.createdAt
      }));

      res.json({
        results: content,
        total: content.length,
        userZone,
        radius
      });
    } catch (queryError) {
      // If location fields don't exist, return empty results
      logger.warn('Location search query failed (location fields may not be indexed)', queryError);
      res.json({
        results: [],
        total: 0,
        userZone,
        radius,
        message: 'Location search not yet fully implemented - location fields need to be added to content'
      });
    }
  } catch (error) {
    logger.error('Failed to search by location', error);
    res.status(500).json({ error: 'Failed to search by location' });
  }
});

// GET /spots/popular - List popular location spots
router.get('/spots/popular', async (req, res) => {
  try {
    // Return predefined popular spots (in production, this would come from a database)
    const popularSpots = [
      { id: 'times-square', name: 'Times Square', zone: '40.75,-73.98', city: 'New York' },
      { id: 'central-park', name: 'Central Park', zone: '40.78,-73.96', city: 'New York' },
      { id: 'golden-gate', name: 'Golden Gate Bridge', zone: '37.81,-122.47', city: 'San Francisco' },
      { id: 'hollywood-sign', name: 'Hollywood Sign', zone: '34.13,-118.32', city: 'Los Angeles' },
      { id: 'london-eye', name: 'London Eye', zone: '51.50,-0.12', city: 'London' },
      { id: 'eiffel-tower', name: 'Eiffel Tower', zone: '48.85,2.29', city: 'Paris' },
      { id: 'tokyo-tower', name: 'Tokyo Tower', zone: '35.66,139.75', city: 'Tokyo' }
    ];

    res.json({ spots: popularSpots });
  } catch (error) {
    logger.error('Failed to get popular spots', error);
    res.status(500).json({ error: 'Failed to get popular spots' });
  }
});

// POST /spots/subscribe - Subscribe to a popular spot
router.post('/spots/subscribe', async (req, res) => {
  try {
    const { user, spotId } = req.body;

    if (!user || !spotId) {
      return res.status(400).json({ error: 'user and spotId are required' });
    }

    // Get user's current preferences
    const prefQuery = `
      query preferences($user: string) {
        preferences(func: eq(user, $user)) @filter(type(LocationSearchPreference)) {
          uid
          subscribedSpots
        }
      }
    `;

    const prefResult = await dgraphClient.query(prefQuery, { $user: user });
    const preference = prefResult.preferences?.[0];

    const currentSpots = preference?.subscribedSpots || [];
    if (currentSpots.includes(spotId)) {
      return res.json({ success: true, message: 'Already subscribed to this spot' });
    }

    const updatedSpots = [...currentSpots, spotId];

    // Update preference
    const mutation = {
      set: {
        uid: preference?.uid || `_:pref_${user}`,
        dgraph_type: 'LocationSearchPreference',
        user,
        subscribedSpots: updatedSpots,
        updatedAt: new Date().toISOString()
      }
    };

    await dgraphClient.mutate(mutation);

    logger.info('User subscribed to spot', { user, spotId });

    res.json({ success: true, message: 'Subscribed to spot successfully', subscribedSpots: updatedSpots });
  } catch (error) {
    logger.error('Failed to subscribe to spot', error);
    res.status(500).json({ error: 'Failed to subscribe to spot' });
  }
});

// DELETE /spots/subscribe/:spotId - Unsubscribe from a spot
router.delete('/spots/subscribe/:spotId', async (req, res) => {
  try {
    const { spotId } = req.params;
    const { user } = req.query;

    if (!user || typeof user !== 'string') {
      return res.status(400).json({ error: 'user query parameter is required' });
    }

    // Get user's current preferences
    const prefQuery = `
      query preferences($user: string) {
        preferences(func: eq(user, $user)) @filter(type(LocationSearchPreference)) {
          uid
          subscribedSpots
        }
      }
    `;

    const prefResult = await dgraphClient.query(prefQuery, { $user: user });
    const preference = prefResult.preferences?.[0];

    if (!preference) {
      return res.status(404).json({ error: 'Location preferences not found' });
    }

    const currentSpots = preference.subscribedSpots || [];
    if (!currentSpots.includes(spotId)) {
      return res.json({ success: true, message: 'Not subscribed to this spot' });
    }

    const updatedSpots = currentSpots.filter((s: string) => s !== spotId);

    // Update preference
    const mutation = {
      set: {
        uid: preference.uid,
        subscribedSpots: updatedSpots,
        updatedAt: new Date().toISOString()
      }
    };

    await dgraphClient.mutate(mutation);

    logger.info('User unsubscribed from spot', { user, spotId });

    res.json({ success: true, message: 'Unsubscribed from spot successfully', subscribedSpots: updatedSpots });
  } catch (error) {
    logger.error('Failed to unsubscribe from spot', error);
    res.status(500).json({ error: 'Failed to unsubscribe from spot' });
  }
});

export default router;
