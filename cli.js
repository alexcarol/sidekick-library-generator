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
  .command('setup')
  .description('Set up the Sidekick library structure in your project')
  .action(async () => {
    try {
      await setup();
      console.log('Setup completed successfully');
    } catch (error) {
      console.error('Setup failed:', error.message);
      process.exit(1);
    }
  });

program
  .command('generate')
  .description('Generate the library from your project blocks')
  .option('--org <organization>', 'Organization name (e.g., adobe)')
  .option('--project <project>', 'Project name (e.g., helix-website)')
  .requiredOption('--site <site>', 'Site URL (e.g., https://www.aem.live/)')
  .action(async (options) => {
    try {
      const apiKey = process.env.AEM_API_KEY;
      if (!apiKey) {
        throw new Error('AEM_API_KEY environment variable is required. See README.md for setup instructions.');
      }

      // Get git remote info if org and project are not provided
      const gitInfo = !options.org || !options.project ? getGitRemoteInfo() : null;
      
      if (!options.org && !gitInfo) {
        throw new Error('Organization name is required. Either provide --org or ensure git remote is configured.');
      }
      
      if (!options.project && !gitInfo) {
        throw new Error('Project name is required. Either provide --project or ensure git remote is configured.');
      }

      await generateLibrary({
        organization: options.org || gitInfo.organization,
        project: options.project || gitInfo.project,
        site: options.site,
        apiKey,
      });
      console.log('Library generation completed successfully');
      process.exit(0);
    } catch (error) {
      console.error('Library generation failed:', error.message);
      process.exit(1);
    }
  });

program.parse();
