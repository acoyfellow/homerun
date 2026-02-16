# Changelog

All notable changes to this project will be documented in this file.

## [Unreleased]

## [0.2.0] - 2026-02-16

### Added
- API Directory with 17+ community-discovered APIs
- `force` option to skip gallery cache during scout
- `headers` support in Worker for authenticated endpoints
- Validation safeguards for directory publish
- DELETE endpoint for directory cleanup

### Changed
- Simplified directory UI to minimal table design
- OpenAPI paths now use relative URLs instead of full URLs

### Fixed
- `publish` flag now properly passed through scout HTTP handler
- ValidationError now propagates instead of being silently caught

## [0.1.0] - 2024-02-10

### Added
- Initial release
- Scout tool: browser-based API discovery
- Worker tool: replay captured endpoints
- Heal tool: re-scout broken paths
- MCP server support
- Gallery for caching discovered specs
- Cloudflare Worker deployment
- Effect-based architecture
- OpenAPI 3.1 spec generation
