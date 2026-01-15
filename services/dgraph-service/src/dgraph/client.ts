import * as dgraph from 'dgraph-js';
import * as grpc from '@grpc/grpc-js';
import { logger } from '../utils/logger';

class DGraphClient {
  private client: dgraph.DgraphClient | null = null;
  private dgraphStub: dgraph.DgraphClientStub | null = null;

  async connect(): Promise<void> {
    try {
      const clientStub = new dgraph.DgraphClientStub(
        process.env.DGRAPH_HOST || 'localhost:9080',
        grpc.credentials.createInsecure()
      );

      this.dgraphStub = clientStub;
      this.client = new dgraph.DgraphClient(clientStub);

      // Test connection
      await this.client.login(
        process.env.DGRAPH_USER || 'groot',
        process.env.DGRAPH_PASSWORD || 'password'
      );

      logger.info(`Connected to dGraph at ${process.env.DGRAPH_HOST || 'localhost:9080'}`);
    } catch (error) {
      logger.error('Failed to connect to dGraph', error);
      throw error;
    }
  }

  getClient(): dgraph.DgraphClient {
    if (!this.client) {
      throw new Error('dGraph client not initialized');
    }
    return this.client;
  }

  async disconnect(): Promise<void> {
    if (this.dgraphStub) {
      this.dgraphStub.close();
      this.dgraphStub = null;
      this.client = null;
    }
    logger.info('Disconnected from dGraph');
  }

  async alterSchema(schema: string): Promise<void> {
    const client = this.getClient();
    const txn = client.newTxn();

    try {
      await txn.doRequest({ schema });
      logger.info('Schema altered successfully');
    } finally {
      await txn.discard();
    }
  }

  async query(query: string, variables?: any): Promise<any> {
    const client = this.getClient();
    const txn = client.newTxn({ readOnly: true });

    try {
      const res = await txn.queryWithVars(query, variables || {});
      const json = res.getJson();
      return json;
    } finally {
      await txn.discard();
    }
  }

  async mutate(mutation: any): Promise<any> {
    const client = this.getClient();
    const txn = client.newTxn();

    try {
      const assigned = await txn.mutate(mutation);
      await txn.commit();

      const uids = assigned.getUidsMap();
      return {
        uids,
        json: assigned.getJson()
      };
    } catch (error) {
      await txn.discard();
      throw error;
    }
  }

  async dropAll(): Promise<void> {
    const client = this.getClient();
    const txn = client.newTxn();

    try {
      await txn.doRequest({ dropAll: true });
      logger.info('All data dropped');
    } finally {
      await txn.discard();
    }
  }
}

export const dgraphClient = new DGraphClient();