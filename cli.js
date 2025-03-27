#!/usr/bin/env node

import { Command } from 'commander';
import { setup } from './setup.js';
import { generateLibrary } from './generate_library.js';
import { execSync } from 'child_process';

function getGitRemoteInfo() {
  try {
    const remoteUrl = execSync('git remote get-url origin').toString().trim();
    const match = remoteUrl.match(/(?:git@github\.com:|https:\/\/github\.com\/)([^/]+)\/([^/]+?)(?:\.git)?$/);
    if (match) {
      return {
        organization: match[1],
        project: match[2],
      };
    }
    return null;
  } catch {
    return null;
  }
}

const program = new Command();

program
  .name('sidekick-library-generator')
  .description('CLI tool for generating Sidekick libraries for AEM Edge Delivery Services projects')
  .version('0.1.0');

program
  .command('generate')
  .description('Generate the library from your project blocks')
  .option('--org <organization>', 'Organization name (e.g., adobe)')
  .option('--project <project>', 'Project name (e.g., helix-website)')
  .requiredOption('--site <site>', 'Site URL (e.g., https://www.aem.live/)')
  .option('--force', 'Force generation even if blocks directory exists')
  .option('--keep-block-context', 'Keep the block context (other blocks and default content) in the section')
  .action(async (options) => {
    try {
      const apiKey = process.env.AEM_API_KEY;
      const authToken = process.env.AEM_AUTH_TOKEN;

      // Get git remote info if org and project are not provided
      const gitInfo = !options.org || !options.project ? getGitRemoteInfo() : null;
      
      if (!options.org && !gitInfo) {
        throw new Error('Organization name is required. Either provide --org or ensure git remote is configured.');
      }
      
      if (!options.project && !gitInfo) {
        throw new Error('Project name is required. Either provide --project or ensure git remote is configured.');
      }

      const organization = options.org || gitInfo.organization;
      const project = options.project || gitInfo.project;

      if (!apiKey && !authToken) {
        console.log('\nAuthentication is required. You can provide it in one of two ways:');
        console.log('\n1. Using an API key:');
        console.log('   Set the AEM_API_KEY environment variable');
        console.log('   Example: export AEM_API_KEY=your-api-key');
        console.log('\n2. Using browser authentication:');
        console.log(`   a. Visit https://admin.hlx.page/login/${organization}/${project}/main`);
        console.log('   b. Log in to your account if prompted');
        console.log('   c. Open your browser\'s Developer Tools (F12 or right-click -> Inspect)');
        console.log('   d. Go to the "Application" or "Storage" tab');
        console.log('   e. Look for "Cookies" under the domain "admin.hlx.page"');
        console.log('   f. Find the cookie named "auth_token"');
        console.log('   g. Copy its value');
        console.log('   h. Set the AEM_AUTH_TOKEN environment variable');
        console.log('   Example: export AEM_AUTH_TOKEN=your-auth-token');
        process.exit(1);
      }

      // Run setup first
      await setup(options.force);

      // Then generate the library
      await generateLibrary({
        organization,
        project,
        site: options.site,
        apiKey,
        authToken,
        keepBlockContext: options.keepBlockContext,
      });
      console.log('Library generation completed successfully');
      process.exit(0);
    } catch (error) {
      console.error('Library generation failed:', error.message);
      process.exit(1);
    }
  });

program.parse();
