# Sidekick Library Generator

A CLI tool for generating Sidekick libraries for AEM Edge Delivery Services projects.

## Installation

```bash
npm install -g sidekick-library-generator
```

## Prerequisites

Before using the tool, you need to set up your AEM API key:

```bash
export AEM_API_KEY=your-api-key
```

For security reasons, the API key must be provided via environment variable. Never commit your API key to version control or share it in logs or error messages.

## Usage

```bash
sidekick-library-generator [--org <organization>] [--project <project>] --site <site> [--force] [--keep-block-context]
```

Required:
- `--site`: Site URL (e.g., https://www.aem.live)

Optional:
- `--org`: Organization name (e.g., adobe). If not provided, will be automatically detected from git remote.
- `--project`: Project name (e.g., helix-website). If not provided, will be automatically detected from git remote.
- `--force`: Force generation even if blocks directory exists. Without this option, the command will fail if blocks have already been generated.
- `--keep-block-context`: Preserve the original block context when generating the library. This is useful when the block alters its containing section in any way.

Required environment variable:
- `AEM_API_KEY`: Your AEM API key for authentication

Examples:
```bash
# Using explicit organization and project names
export AEM_API_KEY=your-api-key
sidekick-library-generator --org adobe --project helix-website --site https://www.aem.live/

# Using automatic git remote detection (requires git remote to be configured)
export AEM_API_KEY=your-api-key
sidekick-library-generator --site https://www.aem.live/

# Force overwrite existing blocks
export AEM_API_KEY=your-api-key
sidekick-library-generator --site https://www.aem.live/ --force

# Preserve block context while generating
export AEM_API_KEY=your-api-key
sidekick-library-generator --site https://www.aem.live/ --keep-block-context
```

The tool automatically detects the organization and project names from your git remote URL if not provided. This works with both SSH (git@github.com:organization/project.git) and HTTPS (https://github.com/organization/project.git) remote URLs.

## Security Best Practices

### API Key Management

The tool requires an AEM API key for authentication, which must be provided via the `AEM_API_KEY` environment variable. This is a security requirement to prevent accidental exposure of sensitive information.

Best practices for API key management:
- Never commit API keys to version control
- Use environment variables in production environments
- Consider using a secrets management service for production deployments
- Rotate API keys regularly
- Use the minimum required permissions for the API key
- Never share API keys in logs, error messages, or documentation

### Environment Variables

For production use, it's recommended to set up environment variables in your deployment environment. This helps prevent accidental exposure of sensitive information in shell history or logs.

## Development

### Project Structure

- `cli.js`: Main CLI entry point
- `setup.js`: Setup functionality for generating library structure
- `generate_library.js`: Library generation implementation
- `block_helpers.js`: Helper functions for block processing
- `template/`: Directory containing template files

### Adding New Features

1. Add new commands in `cli.js`
2. Create corresponding implementation files
3. Update tests if applicable
4. Update documentation

## License

Apache-2.0 