# Changelog

All notable changes to this project will be documented in this file.

## [2.0.0] - 2024-11-01

### Changed - Major Rewrite

This is a complete rewrite of the project using the official `@aws/codewhisperer-streaming-client` npm package.

#### Breaking Changes

- Complete rewrite of the CodeWhisperer client to use the official AWS client library
- Simplified type system - now uses types from the official package
- API method names changed:
  - `generateAssistantResponse()` → `sendMessage()`
  - `generateAssistantResponseNonStreaming()` → `sendMessageNonStreaming()`

#### Added

- Official AWS client library integration (`@aws/codewhisperer-streaming-client`)
- Comprehensive documentation for the CodeWhisperer Streaming Client
- Much more reliable event stream handling
- Better type safety with official type definitions

#### Removed

- Custom event stream parsing code (replaced by official client)
- Custom protocol implementation
- Manual event stream codec handling
- Old documentation files (bug fixes, debug logs, etc.)
- Unused dependencies:
  - `@smithy/eventstream-codec`
  - `@smithy/eventstream-serde-universal`
  - `@smithy/util-utf8`

#### Improved

- More maintainable codebase
- Simpler architecture focused on protocol conversion
- Better error handling
- Cleaner separation of concerns

### Documentation

- Added `docs/codewhisperer-streaming-client-guide.md` - comprehensive guide to the AWS client
- Added `REFERENCE_MATERIALS.md` - guide to using reference materials
- Updated README.md with new architecture
- **Preserved** important reference materials:
  - `ANALYSIS.md` - CodeWhisperer protocol analysis
  - `AMAZON_Q_CLI_INTEGRATION.md` - Integration guide
  - `amazon-q-developer-cli/` - AWS official CLI source (submodule)
  - `docs/amazon-q-cli-analysis/` - Detailed CLI analysis
- Removed obsolete temporary documentation files

### Technical Details

The project now focuses entirely on protocol conversion between OpenAI and CodeWhisperer formats, leveraging the official AWS client library for all communication with the CodeWhisperer API. This makes the codebase more maintainable and reliable.

## [1.0.1] - Previous Version

Previous version with custom protocol implementation. See git history for details.
