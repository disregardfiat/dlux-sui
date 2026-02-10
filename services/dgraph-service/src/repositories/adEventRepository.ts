import { dgraphClient } from '../dgraph/client';
import { logger } from '../utils/logger';

export interface AdClick {
  id: string;
  adId: string;
  contentId: string;
  clickTokenHash: string;
  targetHash: string;
  zkProof: string;
  proofHash: string;
  encryptedViewer: string;
  blockHeader: string;
  timestamp: Date;
  verified: boolean;
}

export interface AdConversion {
  id: string;
  adId: string;
  contentId: string;
  clickTokenHash: string;
  conversionTokenHash: string;
  zkProof: string;
  proofHash: string;
  encryptedViewer: string;
  blockHeader: string;
  timestamp: Date;
  verified: boolean;
}

export interface AdAggregate {
  id: string;
  adId: string;
  contentId: string;
  encryptedCount: string;
  threshold: number;
  currentCount: number;
  reachedAt?: Date;
}

// Check if DGraph is available (for in-memory fallback)
function isDGraphAvailable(): boolean {
  try {
    dgraphClient.getClient();
    return true;
  } catch {
    return false;
  }
}

export class AdEventRepository {
  private inMemoryClicks: AdClick[] = [];
  private inMemoryConversions: AdConversion[] = [];

  private isTest(): boolean {
    return process.env.NODE_ENV === 'test';
  }

  // Use in-memory mode if DGraph not available or in test mode
  private useInMemory(): boolean {
    return this.isTest() || !isDGraphAvailable();
  }

  async saveClick(click: Omit<AdClick, 'id' | 'timestamp'>): Promise<string> {
    const id = `click_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const timestamp = new Date();

    if (this.useInMemory()) {
      this.inMemoryClicks.push({
        id,
        adId: click.adId,
        contentId: click.contentId,
        clickTokenHash: click.clickTokenHash,
        targetHash: click.targetHash,
        zkProof: click.zkProof,
        proofHash: click.proofHash,
        encryptedViewer: click.encryptedViewer,
        blockHeader: click.blockHeader,
        timestamp,
        verified: click.verified || false
      });
      return id;
    }

    const mutation = {
      set: {
        uid: `_:${id}`,
        dgraph_type: 'AdClick',
        id,
        adId: click.adId,
        contentId: click.contentId,
        clickTokenHash: click.clickTokenHash,
        targetHash: click.targetHash,
        zkProof: click.zkProof,
        proofHash: click.proofHash,
        encryptedViewer: click.encryptedViewer,
        blockHeader: click.blockHeader,
        timestamp: timestamp.toISOString(),
        verified: click.verified || false
      }
    };

    try {
      const result = await dgraphClient.mutate(mutation);
      const uid = Object.values(result.uids)[0] as string;
      logger.info('Saved ad click', { id, adId: click.adId, contentId: click.contentId });
      return uid;
    } catch (error) {
      logger.error('Failed to save ad click', error);
      throw error;
    }
  }

  async saveConversion(conversion: Omit<AdConversion, 'id' | 'timestamp'>): Promise<string> {
    const id = `conversion_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
    const timestamp = new Date();

    if (this.useInMemory()) {
      this.inMemoryConversions.push({
        id,
        adId: conversion.adId,
        contentId: conversion.contentId,
        clickTokenHash: conversion.clickTokenHash,
        conversionTokenHash: conversion.conversionTokenHash,
        zkProof: conversion.zkProof,
        proofHash: conversion.proofHash,
        encryptedViewer: conversion.encryptedViewer,
        blockHeader: conversion.blockHeader,
        timestamp,
        verified: conversion.verified || false
      });
      return id;
    }

    const mutation = {
      set: {
        uid: `_:${id}`,
        dgraph_type: 'AdConversion',
        id,
        adId: conversion.adId,
        contentId: conversion.contentId,
        clickTokenHash: conversion.clickTokenHash,
        conversionTokenHash: conversion.conversionTokenHash,
        zkProof: conversion.zkProof,
        proofHash: conversion.proofHash,
        encryptedViewer: conversion.encryptedViewer,
        blockHeader: conversion.blockHeader,
        timestamp: timestamp.toISOString(),
        verified: conversion.verified || false
      }
    };

    try {
      const result = await dgraphClient.mutate(mutation);
      const uid = Object.values(result.uids)[0] as string;
      logger.info('Saved ad conversion', { id, adId: conversion.adId, contentId: conversion.contentId });
      return uid;
    } catch (error) {
      logger.error('Failed to save ad conversion', error);
      throw error;
    }
  }

  async countClicks(contentId: string): Promise<number> {
    if (this.useInMemory()) {
      return this.inMemoryClicks.filter(c => c.contentId === contentId).length;
    }
    const query = `
      query count($contentId: string) {
        count(func: eq(contentId, $contentId)) @filter(type(AdClick)) {
          count(uid)
        }
      }
    `;

    const result = await dgraphClient.query(query, { $contentId: contentId });
    return result.count?.[0]?.count || 0;
  }

  async countConversions(contentId: string): Promise<number> {
    if (this.useInMemory()) {
      return this.inMemoryConversions.filter(c => c.contentId === contentId).length;
    }
    const query = `
      query count($contentId: string) {
        count(func: eq(contentId, $contentId)) @filter(type(AdConversion)) {
          count(uid)
        }
      }
    `;

    const result = await dgraphClient.query(query, { $contentId: contentId });
    return result.count?.[0]?.count || 0;
  }

  async findClicksByContent(contentId: string): Promise<AdClick[]> {
    if (this.useInMemory()) {
      return this.inMemoryClicks
        .filter(c => c.contentId === contentId)
        .map(c => ({ ...c, timestamp: new Date(c.timestamp) }));
    }
    const query = `
      query clicks($contentId: string) {
        clicks(func: eq(contentId, $contentId)) @filter(type(AdClick)) {
          id
          adId
          contentId
          clickTokenHash
          targetHash
          zkProof
          proofHash
          encryptedViewer
          blockHeader
          timestamp
          verified
        }
      }
    `;

    const result = await dgraphClient.query(query, { $contentId: contentId });
    return (result.clicks || []).map((click: any) => ({
      ...click,
      timestamp: new Date(click.timestamp)
    }));
  }

  async findClickByTokenHash(clickTokenHash: string): Promise<AdClick | null> {
    if (this.useInMemory()) {
      const click = this.inMemoryClicks.find(c => c.clickTokenHash === clickTokenHash);
      return click ? { ...click, timestamp: new Date(click.timestamp) } : null;
    }
    const query = `
      query click($clickTokenHash: string) {
        clicks(func: eq(clickTokenHash, $clickTokenHash)) @filter(type(AdClick)) {
          id
          adId
          contentId
          clickTokenHash
          targetHash
          zkProof
          proofHash
          encryptedViewer
          blockHeader
          timestamp
          verified
        }
      }
    `;

    const result = await dgraphClient.query(query, { $clickTokenHash: clickTokenHash });
    const click = result.clicks?.[0];
    if (!click) return null;
    return { ...click, timestamp: new Date(click.timestamp) };
  }

  async findConversionsByContent(contentId: string): Promise<AdConversion[]> {
    if (this.useInMemory()) {
      return this.inMemoryConversions
        .filter(c => c.contentId === contentId)
        .map(c => ({ ...c, timestamp: new Date(c.timestamp) }));
    }
    const query = `
      query conversions($contentId: string) {
        conversions(func: eq(contentId, $contentId)) @filter(type(AdConversion)) {
          id
          adId
          contentId
          clickTokenHash
          conversionTokenHash
          zkProof
          proofHash
          encryptedViewer
          blockHeader
          timestamp
          verified
        }
      }
    `;

    const result = await dgraphClient.query(query, { $contentId: contentId });
    return (result.conversions || []).map((conv: any) => ({
      ...conv,
      timestamp: new Date(conv.timestamp)
    }));
  }

  async saveClickAggregate(aggregate: Omit<AdAggregate, 'id'>): Promise<string> {
    if (this.useInMemory()) {
      return `click_aggregate_${aggregate.adId}_${aggregate.contentId}`;
    }
    const id = `click_aggregate_${aggregate.adId}_${aggregate.contentId}`;
    const mutation = {
      set: {
        uid: `_:${id}`,
        dgraph_type: 'AdClickAggregate',
        id,
        adId: aggregate.adId,
        contentId: aggregate.contentId,
        encryptedCount: aggregate.encryptedCount,
        threshold: aggregate.threshold,
        currentCount: aggregate.currentCount,
        reachedAt: aggregate.reachedAt?.toISOString() || ''
      }
    };

    const result = await dgraphClient.mutate(mutation);
    return Object.values(result.uids)[0] as string;
  }

  async saveConversionAggregate(aggregate: Omit<AdAggregate, 'id'>): Promise<string> {
    if (this.useInMemory()) {
      return `conversion_aggregate_${aggregate.adId}_${aggregate.contentId}`;
    }
    const id = `conversion_aggregate_${aggregate.adId}_${aggregate.contentId}`;
    const mutation = {
      set: {
        uid: `_:${id}`,
        dgraph_type: 'AdConversionAggregate',
        id,
        adId: aggregate.adId,
        contentId: aggregate.contentId,
        encryptedCount: aggregate.encryptedCount,
        threshold: aggregate.threshold,
        currentCount: aggregate.currentCount,
        reachedAt: aggregate.reachedAt?.toISOString() || ''
      }
    };

    const result = await dgraphClient.mutate(mutation);
    return Object.values(result.uids)[0] as string;
  }

  async findClicksByAdId(adId: string): Promise<AdClick[]> {
    if (this.useInMemory()) {
      return this.inMemoryClicks
        .filter(c => c.adId === adId)
        .map(c => ({ ...c, timestamp: new Date(c.timestamp) }));
    }

    const query = `
      query clicks($adId: string) {
        clicks(func: eq(adId, $adId)) @filter(type(AdClick)) {
          id
          adId
          contentId
          clickTokenHash
          targetHash
          zkProof
          proofHash
          encryptedViewer
          blockHeader
          timestamp
          verified
        }
      }
    `;

    const result = await dgraphClient.query(query, { $adId: adId });
    return (result.clicks || []).map((click: any) => ({
      ...click,
      timestamp: new Date(click.timestamp)
    }));
  }

  async findConversionsByAdId(adId: string): Promise<AdConversion[]> {
    if (this.useInMemory()) {
      return this.inMemoryConversions
        .filter(c => c.adId === adId)
        .map(c => ({ ...c, timestamp: new Date(c.timestamp) }));
    }

    const query = `
      query conversions($adId: string) {
        conversions(func: eq(adId, $adId)) @filter(type(AdConversion)) {
          id
          adId
          contentId
          clickTokenHash
          conversionTokenHash
          zkProof
          proofHash
          encryptedViewer
          blockHeader
          timestamp
          verified
        }
      }
    `;

    const result = await dgraphClient.query(query, { $adId: adId });
    return (result.conversions || []).map((conv: any) => ({
      ...conv,
      timestamp: new Date(conv.timestamp)
    }));
  }

  clearTestData() {
    if (!this.isTest()) return;
    this.inMemoryClicks = [];
    this.inMemoryConversions = [];
  }
}

export const adEventRepository = new AdEventRepository();
