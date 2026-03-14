#!/usr/bin/env bash
# Test the MCP server deployed on Vercel
# Usage: ./test-vercel.sh [MCP_AUTH_TOKEN]

BASE_URL="https://spotify-mcp-server-teal.vercel.app/mcp"
AUTH_TOKEN="${1:-}"

AUTH_HEADER=""
if [ -n "$AUTH_TOKEN" ]; then
  AUTH_HEADER="-H \"Authorization: Bearer $AUTH_TOKEN\""
fi

echo "=== Testing MCP Server: $BASE_URL ==="
echo ""

# Test 1: Initialize
echo "--- Test 1: initialize ---"
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  ${AUTH_TOKEN:+-H "Authorization: Bearer $AUTH_TOKEN"} \
  -d '{
    "jsonrpc": "2.0",
    "id": 1,
    "method": "initialize",
    "params": {
      "protocolVersion": "2024-11-05",
      "capabilities": {},
      "clientInfo": { "name": "test-client", "version": "1.0" }
    }
  }')

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | grep -v "HTTP_STATUS:")

echo "Status: $HTTP_STATUS"
echo "Body: $BODY"
echo ""

if [ "$HTTP_STATUS" != "200" ]; then
  echo "FAIL: Expected 200, got $HTTP_STATUS"
  exit 1
fi

# Test 2: List tools
echo "--- Test 2: tools/list ---"
RESPONSE=$(curl -s -w "\nHTTP_STATUS:%{http_code}" \
  -X POST "$BASE_URL" \
  -H "Content-Type: application/json" \
  -H "Accept: application/json" \
  ${AUTH_TOKEN:+-H "Authorization: Bearer $AUTH_TOKEN"} \
  -d '{
    "jsonrpc": "2.0",
    "id": 2,
    "method": "tools/list",
    "params": {}
  }')

HTTP_STATUS=$(echo "$RESPONSE" | grep "HTTP_STATUS:" | cut -d: -f2)
BODY=$(echo "$RESPONSE" | grep -v "HTTP_STATUS:")

echo "Status: $HTTP_STATUS"
echo "Body: $BODY" | head -50
echo ""

if [ "$HTTP_STATUS" != "200" ]; then
  echo "FAIL: Expected 200, got $HTTP_STATUS"
  exit 1
fi

echo "=== All tests passed! ==="
