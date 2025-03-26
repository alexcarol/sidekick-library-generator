import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import mustache from 'mustache';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export async function setup() {
  const packageJsonPath = path.join(process.cwd(), 'package.json');
  const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf8'));
  const { name: projectName } = packageJson;

  const templateDir = path.join(__dirname, 'template');
  const outputDir = path.join(process.cwd(), 'tools/sidekick');

  // Check if the output directory already exists
  if (fs.existsSync(outputDir)) {
    throw new Error('The output directory already exists. Please delete the "tools/sidekick" folder and try again.');
  }

  // Create the output directory
  fs.mkdirSync(outputDir, { recursive: true });

  // Read all files in the template directory
  const files = await fs.promises.readdir(templateDir);

  await Promise.all(files.map(async (file) => {
    const templatePath = path.join(templateDir, file);
    const outputPath = path.join(outputDir, file.replace('.mustache', ''));

    // Read the template file
    const template = await fs.promises.readFile(templatePath, 'utf8');

    // Render the template with the project name
    const rendered = mustache.render(template, { project: projectName });

    // Write the rendered content to the output file
    await fs.promises.writeFile(outputPath, rendered, 'utf8');
  }));

  console.log('Sidekick files generated successfully.');
}
