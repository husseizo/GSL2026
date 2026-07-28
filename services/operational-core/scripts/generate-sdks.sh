#!/usr/bin/env bash
# Generates real client SDKs from the real openapi.json produced by
# generate-openapi.ts, using openapi-generator-cli (Java-based — Java 17 is
# available in this environment, confirmed before this script was written).
# See docs/architecture/api-platform.md.
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f openapi.json ]; then
  echo "openapi.json not found — run: npx ts-node -T scripts/generate-openapi.ts" >&2
  exit 1
fi

GEN="npx --yes @openapitools/openapi-generator-cli"

echo "Generating TypeScript SDK..."
$GEN generate -i openapi.json -g typescript-axios -o sdks/typescript \
  --additional-properties=npmName=@aios/sdk-typescript,supportsES6=true

echo "Generating .NET (C#) SDK..."
$GEN generate -i openapi.json -g csharp -o sdks/dotnet \
  --additional-properties=packageName=Aios.Sdk,targetFramework=net8.0

echo "Generating Python SDK..."
$GEN generate -i openapi.json -g python -o sdks/python \
  --additional-properties=packageName=aios_sdk

echo "SDKs generated in sdks/typescript, sdks/dotnet, sdks/python"
