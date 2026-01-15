/**
 * Test helper functions
 */

import axios from 'axios';

const SUI_SERVICE_URL = process.env.SUI_SERVICE_URL || 'http://localhost:3001';
const DGRAPH_SERVICE_URL = process.env.DGRAPH_SERVICE_URL || 'http://localhost:3003';

export async function getAuthToken(suiAddress: string): Promise<string> {
  // Mock implementation - in real tests, this would call the auth endpoint
  return `mock-token-${suiAddress}`;
}

export async function signMessage(message: string): Promise<string> {
  // Mock implementation - in real tests, this would use a wallet to sign
  return `mock-signature-${Buffer.from(message).toString('hex')}`;
}

export async function createPost(data: {
  content: string;
  author: string;
  signature?: string;
}): Promise<any> {
  const signature = data.signature || await signMessage(data.content);
  
  const response = await axios.post(`${DGRAPH_SERVICE_URL}/social/posts`, {
    author: data.author,
    content: data.content,
    contentType: 'text',
    signature
  });
  
  return response.data;
}

export async function createUser(data: {
  suiAddress: string;
  vanityAddress?: string;
}): Promise<any> {
  // Mock implementation - in real tests, this would create a user via API
  return {
    suiAddress: data.suiAddress,
    vanityAddress: data.vanityAddress,
    createdAt: new Date(),
    updatedAt: new Date()
  };
}

export async function createVanity(vanity: string, owner: string): Promise<any> {
  // Mock implementation - in real tests, this would create a vanity via API
  return {
    address: vanity,
    owner,
    price: 10,
    purchasedAt: new Date(),
    verified: true
  };
}

export async function healthCheck(service: string): Promise<boolean> {
  try {
    const url = service === 'sui' ? SUI_SERVICE_URL :
                service === 'dgraph' ? DGRAPH_SERVICE_URL :
                `http://localhost:300${service}`;
    
    const response = await axios.get(`${url}/health`);
    return response.status === 200;
  } catch (error) {
    return false;
  }
}
