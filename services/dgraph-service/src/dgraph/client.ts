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

      // Test connection when login is supported by the client library.
      const loginable = this.client as unknown as {
        login?: (user: string, password: string) => Promise<void>;
      };
      if (typeof loginable.login === 'function') {
        try {
          await loginable.login(
            process.env.DGRAPH_USER || 'groot',
            process.env.DGRAPH_PASSWORD || 'password'
          );
        } catch (loginError) {
          // Login failure indicates DGraph is not available
          throw new Error(`DGraph server not available at ${process.env.DGRAPH_HOST || 'localhost:9080'}: ${loginError instanceof Error ? loginError.message : String(loginError)}`);
        }
      }

      // Test connection with a simple query to verify DGraph is actually running
      try {
        const testTxn = this.client.newTxn({ readOnly: true });
        // Use a valid DQL query - query for a non-existent predicate to test connection
        await testTxn.query('{ _dummy(func: has(_dummy)) { uid } }');
        await testTxn.discard();
      } catch (testError) {
        throw new Error(`DGraph server not responding at ${process.env.DGRAPH_HOST || 'localhost:9080'}: ${testError instanceof Error ? testError.message : String(testError)}`);
      }

      logger.info(`Connected to dGraph at ${process.env.DGRAPH_HOST || 'localhost:9080'}`);
    } catch (error) {
      logger.error('Failed to connect to dGraph', error);
      // Clean up on failure
      if (this.dgraphStub) {
        this.dgraphStub.close();
        this.dgraphStub = null;
        this.client = null;
      }
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
    
    try {
      // Use the client's alter method directly (not through a transaction)
      const operation = new dgraph.Operation();
      operation.setSchema(schema);
      await client.alter(operation);
      logger.info('Schema altered successfully');
    } catch (error) {
      logger.error('Failed to alter schema', error);
      throw error;
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
      // dgraph-js v21+ requires a Mutation protobuf object, not a plain JS object.
      // setSetJson/setDeleteJson expect bytes (Uint8Array), not strings.
      const mu = new dgraph.Mutation();
      if (mutation.set) {
        mu.setSetJson(new Uint8Array(Buffer.from(JSON.stringify(mutation.set))));
      }
      if (mutation.delete) {
        mu.setDeleteJson(new Uint8Array(Buffer.from(JSON.stringify(mutation.delete))));
      }
      mu.setCommitNow(true);
      const assigned = await txn.mutate(mu);

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
      await txn.doRequest({ dropAll: true } as unknown as dgraph.Request);
      logger.info('All data dropped');
    } finally {
      await txn.discard();
    }
  }
}

export const dgraphClient = new DGraphClient();