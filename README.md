# Sidekick Library Generator

A CLI tool for generating Sidekick libraries for AEM Edge Delivery Services projects.

## Installation

```bash
npm install
```

## Prerequisites

Before using the tool, you need to set up your AEM API key:

```bash
export AEM_API_KEY=your-api-key
```

For security reasons, the API key must be provided via environment variable. Never commit your API key to version control or share it in logs or error messages.

## Usage

### Setup Command

```bash
node cli.js setup
```

This command sets up the Sidekick library structure in your project.

### Generate Command

```bash
node cli.js generate --org <organization> --project <project> --site <site>
```

Required options:
- `--org`: Organization name (e.g., adobe)
- `--project`: Project name (e.g., helix-website)
- `--site`: Site URL (e.g., https://www.aem.live/)

Required environment variable:
- `AEM_API_KEY`: Your AEM API key for authentication

Example:
```bash
export AEM_API_KEY=your-api-key
node cli.js generate --org adobe --project helix-website --site https://www.aem.live/
```

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
- `setup.js`: Setup command implementation
- `generate_library.js`: Library generation implementation
- `block_helpers.js`: Helper functions for block processing
- `template/`: Directory containing template files

### Adding New Features

1. Add new commands in `cli.js`
2. Create corresponding implementation files
3. Update tests if applicable
4. Update documentation

## License

UNLICENSED 