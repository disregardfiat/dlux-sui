declare module 'snarkjs' {
  export const groth16: {
    fullProve(
      input: Record<string, unknown>,
      wasmFile: string,
      zkeyFile: string
    ): Promise<{ proof: unknown; publicSignals: string[] }>;
    verify(
      verificationKey: unknown,
      publicSignals: string[],
      proof: unknown
    ): Promise<boolean>;
  };
  export const plonk: {
    fullProve(
      input: Record<string, unknown>,
      wasmFile: string,
      zkeyFile: string
    ): Promise<{ proof: unknown; publicSignals: string[] }>;
    verify(
      verificationKey: unknown,
      publicSignals: string[],
      proof: unknown
    ): Promise<boolean>;
  };
}

declare module 'circomlib' {
  export const poseidon: (inputs: bigint[]) => bigint;
  export const mimcsponge: {
    multiHash(inputs: bigint[], key: bigint, numOutputs: number): bigint[];
  };
  export const smt: {
    newMemEmptyTrie(): Promise<unknown>;
  };
}
