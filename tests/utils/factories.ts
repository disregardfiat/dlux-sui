/**
 * Test data factories for creating test objects
 */

import { User, SocialPost, VanityAddress, ZKLink } from '@dlux-sui/types';

// Simple faker-like functions (we'll use a real faker library later)
function randomHex(length: number): string {
  return '0x' + Array.from({ length }, () => 
    Math.floor(Math.random() * 16).toString(16)
  ).join('');
}

function randomString(length: number): string {
  return Array.from({ length }, () => 
    String.fromCharCode(97 + Math.floor(Math.random() * 26))
  ).join('');
}

export const userFactory = {
  create: (overrides?: Partial<User>): User => ({
    suiAddress: randomHex(40),
    vanityAddress: undefined,
    linkedZKPs: [],
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  })
};

export const vanityFactory = {
  create: (overrides?: Partial<VanityAddress>): VanityAddress => ({
    address: randomString(8).toLowerCase(),
    owner: randomHex(40),
    price: 10,
    purchasedAt: new Date(),
    expiresAt: undefined,
    verified: true,
    ...overrides
  })
};

export const zkLinkFactory = {
  create: (overrides?: Partial<ZKLink>): ZKLink => ({
    provider: 'github',
    proof: randomHex(64),
    linkedAt: new Date(),
    ...overrides
  })
};

export const postFactory = {
  create: (overrides?: Partial<SocialPost>): SocialPost => ({
    id: randomString(32),
    author: randomHex(40),
    vanityAddress: undefined,
    content: 'Test post content',
    contentType: 'text',
    likes: 0,
    dislikes: 0,
    replies: 0,
    reposts: 0,
    quotes: 0,
    signature: randomHex(64),
    signedAt: new Date(),
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides
  })
};
