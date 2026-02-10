import * as dgraph from 'dgraph-js';
import * as grpc from '@grpc/grpc-js';
import { logger } from '../utils/logger';

class SUIDGraphClient {
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

      // Test connection when login is supported by the client library.
      const loginable = this.client as unknown as {
        login?: (user: string, password: string) => Promise<void>;
      };
      if (typeof loginable.login === 'function') {
        await loginable.login(
          process.env.DGRAPH_USER || 'groot',
          process.env.DGRAPH_PASSWORD || 'password'
        );
      }

      logger.info(`SUI Service connected to dGraph at ${process.env.DGRAPH_HOST || 'localhost:9080'}`);
    } catch (error) {
      logger.error('Failed to connect SUI service to dGraph', error);
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
    logger.info('SUI Service disconnected from dGraph');
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
}

export const suiDgraphClient = new SUIDGraphClient();