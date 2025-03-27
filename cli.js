#!/usr/bin/env node

import { Command } from 'commander';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import { setup } from './setup.js';
import { generateLibrary } from './generate_library.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
  .requiredOption('--org <organization>', 'Organization name (e.g., adobe)')
  .requiredOption('--project <project>', 'Project name (e.g., helix-website)')
  .requiredOption('--site <site>', 'Site URL (e.g., https://www.aem.live/)')
  .action(async (options) => {
    try {
      const apiKey = process.env.AEM_API_KEY;
      if (!apiKey) {
        throw new Error('AEM_API_KEY environment variable is required. See README.md for setup instructions.');
      }

      await generateLibrary({
        organization: options.org,
        project: options.project,
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
