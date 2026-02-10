#!/bin/bash

# DLUX-SUI Deployment Script

set -e

echo "🚀 Starting DLUX-SUI deployment..."

# Check if kubectl is available
if ! command -v kubectl &> /dev/null; then
    echo "❌ kubectl not found. Please install kubectl."
    exit 1
fi

# Create namespace
echo "📦 Creating namespace..."
kubectl apply -f ../kubernetes/namespace.yml

# Wait for namespace
kubectl wait --for=jsonpath='{.status.phase}'=Active namespace/dlux-sui --timeout=60s

# Deploy dGraph first
echo "🐘 Deploying dGraph..."
kubectl apply -f ../kubernetes/deployment.yml -l app=dgraph-alpha
kubectl apply -f ../kubernetes/service.yml -l app=dgraph-alpha

# Wait for dGraph
echo "⏳ Waiting for dGraph to be ready..."
kubectl wait --for=condition=available --timeout=300s deployment/dgraph-alpha -n dlux-sui

# Deploy services
echo "🔧 Deploying microservices..."
kubectl apply -f ../kubernetes/deployment.yml
kubectl apply -f ../kubernetes/service.yml

# Deploy ingress
echo "🌐 Deploying ingress..."
kubectl apply -f ../kubernetes/ingress.yml

# Wait for all deployments
echo "⏳ Waiting for all services to be ready..."
kubectl wait --for=condition=available --timeout=300s deployment/sui-service -n dlux-sui
kubectl wait --for=condition=available --timeout=300s deployment/walrus-service -n dlux-sui
kubectl wait --for=condition=available --timeout=300s deployment/dgraph-service -n dlux-sui
kubectl wait --for=condition=available --timeout=300s deployment/presence-service -n dlux-sui
kubectl wait --for=condition=available --timeout=300s deployment/vue-app -n dlux-sui

echo "✅ Deployment completed successfully!"
echo ""
echo "🌟 Services available at:"
echo "  - Frontend: https://dlux-sui.com"
echo "  - GraphQL API: https://api.dlux-sui.com/graphql"
echo "  - SUI Service: https://sui.dlux-sui.com"
echo "  - Walrus Service: https://walrus.dlux-sui.com"
echo "  - Presence Service: https://presence.dlux-sui.com"