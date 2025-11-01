# Reference Materials

This document lists the important reference materials that are preserved in this project for future development and understanding of the CodeWhisperer protocol.

## Official AWS Source Code

### amazon-q-developer-cli/ (Git Submodule)

This is AWS's official Amazon Q Developer CLI implementation, included as a git submodule.

**Location:** `amazon-q-developer-cli/`  
**Type:** Git submodule  
**Repository:** https://github.com/aws/amazon-q-developer-cli.git  
**Purpose:** Reference implementation for CodeWhisperer protocol

**Key Areas of Interest:**
- `crates/amzn-codewhisperer-streaming-client/` - Rust implementation of CodeWhisperer streaming client
- `crates/amzn-codewhisperer-streaming-client/src/types/` - Type definitions
- `crates/amzn-codewhisperer-streaming-client/src/protocol_serde/` - Protocol serialization/deserialization
- Authentication implementation and token management

**Usage:**
```bash
# Initialize the submodule (if not already done)
git submodule update --init --recursive

# Browse the source code
cd amazon-q-developer-cli
```

## Analysis Documentation

### ANALYSIS.md

In-depth technical analysis of the CodeWhisperer protocol, including:
- Protocol structure and message formats
- Authentication flows
- Event stream handling
- Request/response examples
- Implementation notes

**When to use:** When you need to understand the low-level details of the CodeWhisperer API protocol.

### AMAZON_Q_CLI_INTEGRATION.md

Integration guide explaining how this project relates to and can work with Amazon Q Developer CLI.

**Topics covered:**
- Integration strategies
- Workflow comparisons
- Authentication compatibility
- Best practices

**When to use:** When considering integration with Amazon Q CLI or understanding how both systems work together.

## Amazon Q CLI Analysis (docs/amazon-q-cli-analysis/)

Comprehensive documentation analyzing the Amazon Q Developer CLI codebase in detail.

### Structure

1. **01-project-overview.md**
   - High-level project architecture
   - Core components
   - Tech stack overview

2. **02-directory-structure.md**
   - Detailed breakdown of the codebase structure
   - Module organization
   - Important files and directories

3. **03-cli-workflow.md**
   - Command-line interface workflow
   - User interaction patterns
   - Command processing

4. **04-authentication.md**
   - Authentication mechanisms
   - Token management
   - SSO/Builder ID flows
   - OAuth implementation details

5. **05-codewhisperer-protocol.md**
   - CodeWhisperer protocol details
   - Message formats
   - Event types
   - API endpoints

6. **06-api-client.md**
   - Client implementation analysis
   - HTTP/streaming handling
   - Error handling
   - Request/response processing

7. **07-development-guide.md**
   - Development setup
   - Building and testing
   - Contributing guidelines
   - Debugging tips

### README.md

Overview and navigation guide for all the analysis documents.

## Why These Are Important

### For Protocol Understanding

The official AWS implementation provides the ground truth for:
- Correct field names and types
- Proper serialization formats
- Authentication requirements
- Error handling patterns

### For Debugging

When issues arise, you can:
1. Check how AWS implements the same feature
2. Verify protocol details in ANALYSIS.md
3. Reference the detailed breakdowns in docs/amazon-q-cli-analysis/

### For Future Development

These materials help with:
- Adding new features (reference AWS implementation)
- Understanding edge cases
- Maintaining protocol compatibility
- Implementing advanced features

## How to Use These Materials

### When Adding New Features

1. Check `ANALYSIS.md` for protocol details
2. Look at AWS implementation in `amazon-q-developer-cli/`
3. Reference specific docs in `docs/amazon-q-cli-analysis/`
4. Implement with the official `@aws/codewhisperer-streaming-client` package

### When Debugging Issues

1. Compare your implementation with AWS source code
2. Verify protocol details in `05-codewhisperer-protocol.md`
3. Check authentication flows in `04-authentication.md`
4. Review client implementation in `06-api-client.md`

### When Understanding Architecture

1. Start with `AMAZON_Q_CLI_INTEGRATION.md` for high-level overview
2. Read `01-project-overview.md` for AWS's architecture
3. Deep dive into specific areas using other docs

## Keeping References Up to Date

### Git Submodule

To update the Amazon Q Developer CLI submodule:

```bash
cd amazon-q-developer-cli
git pull origin main
cd ..
git add amazon-q-developer-cli
git commit -m "Update amazon-q-developer-cli submodule"
```

### Analysis Documentation

When AWS makes significant changes to their protocol or implementation:
1. Review changes in the submodule
2. Update ANALYSIS.md if protocol changed
3. Update relevant docs in docs/amazon-q-cli-analysis/ if needed

## Integration with Current Project

Our current implementation (v2.0.0) uses the official `@aws/codewhisperer-streaming-client` npm package, which eliminates the need for custom protocol implementation. However, these reference materials remain valuable for:

- Understanding what's happening under the hood
- Debugging complex issues
- Adding features not yet exposed by the npm package
- Contributing improvements back to the AWS ecosystem

## Important Notes

1. **Read-Only Reference:** The submodule is for reference only - don't modify it
2. **No Direct Dependencies:** Our code doesn't import from the submodule
3. **Protocol Changes:** If AWS updates the protocol, the npm package will be updated; use these references to understand changes
4. **License Compliance:** The submodule has its own license (see amazon-q-developer-cli/LICENSE*)

---

**Last Updated:** 2024-11-01 (v2.0.0)  
**Maintained By:** Project maintainers  
**Status:** Active reference materials
