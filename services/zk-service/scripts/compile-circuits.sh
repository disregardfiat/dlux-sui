#!/bin/bash

# Compile Circom circuits for ZK proof generation

set -e

CIRCUITS_DIR="../../circuits"
OUTPUT_DIR="./circuits"

echo "Compiling Circom circuits..."

# Check if circom is installed
if ! command -v circom &> /dev/null; then
    echo "Error: circom not found. Install with: npm install -g circom"
    exit 1
fi

# Create output directory
mkdir -p "$OUTPUT_DIR"

# Compile ad-view-proof circuit
echo "Compiling ad-view-proof.circom..."
circom "$CIRCUITS_DIR/ad-view-proof.circom" \
    --r1cs \
    --wasm \
    --sym \
    --c \
    -o "$OUTPUT_DIR"

# Compile merkle-proof circuit
echo "Compiling merkle-proof.circom..."
circom "$CIRCUITS_DIR/merkle-proof.circom" \
    --r1cs \
    --wasm \
    --sym \
    --c \
    -o "$OUTPUT_DIR"

echo "Circuits compiled successfully!"
echo ""
echo "⚠️  Note: You still need to generate trusted setup (zkey) files."
echo "   This requires a trusted setup ceremony or using a trusted setup service."
