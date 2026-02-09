#!/bin/bash
# Seed the gallery with example entries via D1 API
set -e

export CLOUDFLARE_API_TOKEN=$(cat ~/.config/cloudflare/api-token)
export CLOUDFLARE_ACCOUNT_ID=$(cat ~/.config/cloudflare/account-id)
DB_ID="d368fc2c-3bd0-4278-b6f2-3fa2d661899f"
API="https://api.cloudflare.com/client/v4/accounts/$CLOUDFLARE_ACCOUNT_ID/d1/database/$DB_ID/query"
NOW=$(date -u +%Y-%m-%dT%H:%M:%SZ)

run_sql() {
  curl -s "$API" \
    -H "Authorization: Bearer $CLOUDFLARE_API_TOKEN" \
    -H "Content-Type: application/json" \
    -d "{\"sql\": \"$1\"}" | jq -r '.success // .errors'
}

echo "Seeding gallery..."

# 1. Hacker News
run_sql "INSERT OR REPLACE INTO gallery (id, domain, url, task, endpoint_count, endpoints_summary, spec_key, contributor, created_at, updated_at, version) VALUES ('gal_hackernews', 'hacker-news.firebaseio.com', 'https://news.ycombinator.com', 'Discover the Hacker News API — stories, comments, users, and polls', 8, 'GET /v0/topstories, GET /v0/newstories, GET /v0/beststories, GET /v0/item/{id}, GET /v0/user/{id}, GET /v0/askstories, GET /v0/showstories, GET /v0/jobstories', 'gallery/hackernews-spec.json', 'unsurf', '$NOW', '$NOW', 1);"

# 2. JSONPlaceholder
run_sql "INSERT OR REPLACE INTO gallery (id, domain, url, task, endpoint_count, endpoints_summary, spec_key, contributor, created_at, updated_at, version) VALUES ('gal_jsonplaceholder', 'jsonplaceholder.typicode.com', 'https://jsonplaceholder.typicode.com', 'Map all REST endpoints for the fake JSON API', 6, 'GET /posts, GET /posts/{id}, GET /comments, GET /users, GET /todos, GET /albums', 'gallery/jsonplaceholder-spec.json', 'unsurf', '$NOW', '$NOW', 1);"

# 3. GitHub REST API
run_sql "INSERT OR REPLACE INTO gallery (id, domain, url, task, endpoint_count, endpoints_summary, spec_key, contributor, created_at, updated_at, version) VALUES ('gal_github', 'api.github.com', 'https://github.com', 'Capture GitHub public REST API endpoints — repos, users, orgs, gists', 12, 'GET /users/{user}, GET /users/{user}/repos, GET /repos/{owner}/{repo}, GET /repos/{owner}/{repo}/commits, GET /repos/{owner}/{repo}/issues, GET /orgs/{org}, GET /orgs/{org}/repos, GET /gists/public, GET /search/repositories, GET /search/users, GET /search/code, GET /rate_limit', 'gallery/github-spec.json', 'unsurf', '$NOW', '$NOW', 1);"

# 4. Open Meteo Weather
run_sql "INSERT OR REPLACE INTO gallery (id, domain, url, task, endpoint_count, endpoints_summary, spec_key, contributor, created_at, updated_at, version) VALUES ('gal_openmeteo', 'api.open-meteo.com', 'https://open-meteo.com', 'Capture weather forecast and geocoding API endpoints', 4, 'GET /v1/forecast, GET /v1/archive, GET /v1/elevation, GET /v1/search', 'gallery/openmeteo-spec.json', 'unsurf', '$NOW', '$NOW', 1);"

# 5. PokeAPI
run_sql "INSERT OR REPLACE INTO gallery (id, domain, url, task, endpoint_count, endpoints_summary, spec_key, contributor, created_at, updated_at, version) VALUES ('gal_pokeapi', 'pokeapi.co', 'https://pokeapi.co', 'Map the Pokemon REST API — pokemon, types, abilities, moves', 10, 'GET /api/v2/pokemon, GET /api/v2/pokemon/{id}, GET /api/v2/type, GET /api/v2/type/{id}, GET /api/v2/ability, GET /api/v2/ability/{id}, GET /api/v2/move, GET /api/v2/move/{id}, GET /api/v2/generation, GET /api/v2/item', 'gallery/pokeapi-spec.json', 'unsurf', '$NOW', '$NOW', 1);"

# 6. Dog CEO API
run_sql "INSERT OR REPLACE INTO gallery (id, domain, url, task, endpoint_count, endpoints_summary, spec_key, contributor, created_at, updated_at, version) VALUES ('gal_dogapi', 'dog.ceo', 'https://dog.ceo/dog-api/', 'Capture the Dog CEO random dog image API', 5, 'GET /api/breeds/list/all, GET /api/breeds/image/random, GET /api/breed/{breed}/images, GET /api/breed/{breed}/images/random, GET /api/breed/{breed}/list', 'gallery/dogapi-spec.json', 'unsurf', '$NOW', '$NOW', 1);"

# 7. Rick and Morty API
run_sql "INSERT OR REPLACE INTO gallery (id, domain, url, task, endpoint_count, endpoints_summary, spec_key, contributor, created_at, updated_at, version) VALUES ('gal_rickmorty', 'rickandmortyapi.com', 'https://rickandmortyapi.com', 'Map all character, location, and episode endpoints', 6, 'GET /api/character, GET /api/character/{id}, GET /api/location, GET /api/location/{id}, GET /api/episode, GET /api/episode/{id}', 'gallery/rickmorty-spec.json', 'unsurf', '$NOW', '$NOW', 1);"

# 8. CoinGecko
run_sql "INSERT OR REPLACE INTO gallery (id, domain, url, task, endpoint_count, endpoints_summary, spec_key, contributor, created_at, updated_at, version) VALUES ('gal_coingecko', 'api.coingecko.com', 'https://www.coingecko.com', 'Capture cryptocurrency market data API — prices, coins, exchanges', 8, 'GET /api/v3/coins/list, GET /api/v3/coins/{id}, GET /api/v3/coins/markets, GET /api/v3/simple/price, GET /api/v3/exchanges, GET /api/v3/exchanges/{id}, GET /api/v3/search/trending, GET /api/v3/global', 'gallery/coingecko-spec.json', 'unsurf', '$NOW', '$NOW', 1);"

# Now sync FTS
run_sql "INSERT INTO gallery_fts(gallery_fts) VALUES('rebuild');"

echo "Done! Verifying..."
curl -s "https://unsurf.coy.workers.dev/gallery?q=api" | jq '.total, .results[].domain'
