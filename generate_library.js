import axios from 'axios';
import * as cheerio from 'cheerio';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const xlsx = require('xlsx');
 
import { html2docx, Blocks } from '@adobe/helix-importer/src/index.js';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import { fetchSiteUrls, listProjectBlocks } from './block_helpers.js';

async function getBlocksAndVariants(url) {
  const aggregatedBlocks = {};

  const blocksToIgnore = ['section-metadata'];
  try {
    const { data: html } = await axios.get(url);
    const $ = cheerio.load(html);

    $('main > div > div').each((index, element) => {
      const classAttr = $(element).attr('class');
      const classList = classAttr.split(/\s+/);
      if (classList.length > 0) {
        const blockName = classList[0];
        if (blocksToIgnore.includes(blockName)) {
          return;
        }
        const variants = classList.slice(1);

        if (!aggregatedBlocks[blockName]) {
          aggregatedBlocks[blockName] = [];
        }

        aggregatedBlocks[blockName].push({
          blockName,
          url,
          variants,
          // html of the parent of the element
          sectionHtml: $(element).parent().html(),
        });
      }
    });
  } catch (error) {
    console.error(`Error processing URL ${url}:`, error);
    throw error;
  }

  return aggregatedBlocks;
}

function toClassName(name) {
  return typeof name === 'string'
    ? name
      .toLowerCase()
      .replace(/[^0-9a-z]/gi, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '')
    : '';
}

function reduceBlocks(aggregatedBlocks) {
  const reduced = [];
  Object.entries(aggregatedBlocks).forEach(([blockName, instances]) => {
    const block = {
      name: blockName,
      variants: [],
    };

    const variantMap = new Map();

    instances.forEach((instance) => {
      if (!variantMap.has('') || instance.variants.length < variantMap.get('').variants.length) {
        variantMap.set('', instance);
      }

      instance.variants.forEach((variant) => {
        if (!variantMap.has(variant)
          || instance.variants.length < variantMap.get(variant).variants.length) {
          variantMap.set(variant, instance);
        }
      });
    });

    variantMap.forEach((instance, variant) => {
      const displayName = (variant === '') ? blockName : `${blockName} (${variant})`;
      block.variants.push({
        name: displayName,
        instanceVariants: instance.variants,
        variantName: variant,
        url: instance.url,
        sectionHtml: instance.sectionHtml,
      });
    });

    reduced.push(block);
  });

  return reduced;
}

async function writeDocx(url, pathname, document) {
  // TODO see what's the "proper" fix for this replace
  const { docx } = await html2docx(url, document);
  const filepath = `${pathname}.docx`;
  fs.writeFileSync(filepath, docx);
}

function prepareBlockHtml(block, keepBlockContext = false) {
  const { name: originalBlockName, variants } = block;
  const pageHtml = '<html><body><main></main></body></html>';
  const { document } = new JSDOM(pageHtml).window;

  variants.forEach((variant) => {
    const { sectionHtml, instanceVariants } = variant;
    const section = document.createElement('div');
    section.innerHTML = sectionHtml;

    if (!keepBlockContext) {
      // Find the matching block and replace the entire section with just that block
      const matchingBlock = section.querySelector(`div.${[originalBlockName, ...instanceVariants].join('.')}`);
      const cells = [...matchingBlock.querySelectorAll(':scope > div')]
        .map((columnDiv) => [...columnDiv.querySelectorAll(':scope > div')]);
      
      const block = Blocks.createBlock(document, {
        name: originalBlockName,
        variants: instanceVariants,
        cells,
      });
      section.innerHTML = '';
      section.appendChild(block);
    } else {
      let foundBlock = false;
      section.querySelectorAll(':scope > div').forEach((div) => {
        const currentBlockName = div.classList[0];
        if (currentBlockName === originalBlockName) {
          if (foundBlock || div.classList.toString() !== [originalBlockName, ...instanceVariants].join(' ')) {
            div.remove();
            return;
          }
          foundBlock = true;
        } else if (currentBlockName !== 'section-metadata') {
          div.remove();
          return;
        }

        const cells = [...div.querySelectorAll(':scope > div')]
          .map((columnDiv) => [...columnDiv.querySelectorAll(':scope > div')]);

        const [newBlockName, ...newInstanceVariants] = div.classList;
        // Create a table for the block data
        const data = [[newBlockName]];
        cells.forEach(row => {
          data.push(row);
        });
        const block = Blocks.createBlock(document, {
          name: newBlockName,
          variants: newInstanceVariants,
          cells,
        });
        div.replaceChildren(block);
      });
    }

    const libraryMetadata = Blocks.createBlock(document, {
      name: 'Library Metadata',
      cells: {
        name: variant.name,
      },
    });
    section.append(libraryMetadata);
    document.querySelector('main').append(section);
  });

  const sections = document.querySelectorAll('main > div');
  sections.forEach((section, index) => {
    if (index < sections.length - 1) {
      const p = document.createElement('p');
      p.textContent = '---';
      section.after(p);
    }
  });

  return document;
}

async function processUrls(urls, config) {
  console.log(`\nStarting to process ${urls.length} URLs`);
  const aggregatedBlocks = {};
  const existingBlocks = listProjectBlocks();
  console.log(`Found ${existingBlocks.length} existing blocks in the project`);

  await Promise.all(urls.map(async (url) => {
    try {
      const iterationAggregatedBlocks = await getBlocksAndVariants(url);
      Object.keys(iterationAggregatedBlocks).forEach((blockName) => {
        if (!aggregatedBlocks[blockName]) {
          aggregatedBlocks[blockName] = [];
        }
        aggregatedBlocks[blockName].push(...iterationAggregatedBlocks[blockName]);
      });
    } catch (error) {
      console.error('Error processing URL:', url, error);
    }
  }));

  fs.mkdirSync('tools/sidekick/blocks', { recursive: true });

  const rows = [['name', 'path']];
  const reduced = reduceBlocks(aggregatedBlocks);
  console.log(`Found ${reduced.length} blocks in the site`);

  await Promise.all(reduced.map(async (block) => {
    try {
      const {
        name,
        variants,
      } = block;

      // Check if the block exists locally
      if (!existingBlocks.includes(name)) {
        console.warn(`\x1b[33mWarning: Block "${name}" not found in local blocks directory. Found at URL: ${variants[0].url}\x1b[0m`);
        return;
      }

      const targetPathname = `tools/sidekick/blocks/${toClassName(name)}`;
      rows.push([name, `/${targetPathname}`]);
      const document = prepareBlockHtml(block, config.keepBlockContext);

      await writeDocx(variants[0].url, targetPathname, document);
    } catch (error) {
      console.error(`Error processing block ${block.name}:`, error);
    }
  }));

  const ws = xlsx.utils.aoa_to_sheet(rows);
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, 'blocks');
  
  const buffer = xlsx.write(wb, { bookType: 'xlsx', type: 'buffer' });
  fs.writeFileSync('tools/sidekick/library.xlsx', buffer);

  console.log('\n\x1b[32m%s\x1b[0m', 'Library generated successfully!');
  console.log('\n\x1b[33m%s\x1b[0m', 'Next steps - Upload to SharePoint:');
  console.log('\x1b[36m%s\x1b[0m', '1. Upload all files from tools/sidekick/blocks/');
  console.log('\x1b[36m%s\x1b[0m', '2. Upload tools/sidekick/library.xlsx');
  console.log('\x1b[36m%s\x1b[0m', '3. Publish all uploaded files');
}

export async function generateLibrary(config) {
  const normalizedConfig = {
    ...config,
    site: config.site.replace(/\/+$/, ''),
  };
  const urls = await fetchSiteUrls(normalizedConfig);
  await processUrls(urls, normalizedConfig);
  console.log('Finished processing URLs');
}
