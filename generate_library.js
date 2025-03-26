import axios from 'axios';
import cheerio from 'cheerio';
import xlsx from 'xlsx';
/* eslint-disable-next-line import/extensions */
import { html2docx, Blocks } from '@adobe/helix-importer/';
import { JSDOM } from 'jsdom';
import fs from 'fs';
import { fetchSiteUrls } from './block_helpers.js';

async function getBlocksAndVariants(url) {
  const aggregatedBlocks = {};

  const blocksToIgnore = ['section-metadata'];
  const { data: html } = await axios.get(url);
  const $ = cheerio.load(html);

  $('main > div > div').each((index, element) => {
    const classList = $(element).attr('class').split(/\s+/);
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

function prepareBlockHtml(block) {
  const { name: originalBlockName, variants } = block;
  const pageHtml = '<html><body><main></main></body></html>';
  const { document } = new JSDOM(pageHtml).window;

  variants.forEach((variant) => {
    const { sectionHtml, instanceVariants } = variant;
    const section = document.createElement('div');
    section.innerHTML = sectionHtml;

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
      const blockElem = Blocks.createBlock(document, {
        name: newBlockName,
        variants: newInstanceVariants,
        cells,
      });
      div.replaceChildren(blockElem);
    });

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

async function processUrls(urls) {
  const aggregatedBlocks = {};
  await Promise.all(urls.map(async (url) => {
    await getBlocksAndVariants(url)
      .then((iterationAggregatedBlocks) => {
        Object.keys(iterationAggregatedBlocks).forEach((blockName) => {
          if (!aggregatedBlocks[blockName]) {
            aggregatedBlocks[blockName] = [];
          }
          aggregatedBlocks[blockName].push(...iterationAggregatedBlocks[blockName]);
        });
      })
      .catch((error) => {
        console.error('Error processing URL:', url, error);
      });
  }));

  fs.mkdirSync('tools/sidekick/blocks', { recursive: true });

  const rows = [['name', 'path']];
  const reduced = reduceBlocks(aggregatedBlocks);

  await Promise.all(reduced.map(async (block) => {
    const {
      name,
      variants,
    } = block;

    const targetPathname = `tools/sidekick/blocks/${toClassName(name)}`;

    rows.push([name, `/${targetPathname}`]);
    const document = prepareBlockHtml(block);

    // TODO fix url somewhere else
    await writeDocx(variants[0].url, targetPathname, document);
  }));

  const ws = xlsx.utils.aoa_to_sheet(rows);
  const wb = xlsx.utils.book_new();
  xlsx.utils.book_append_sheet(wb, ws, 'blocks');
  xlsx.writeFile(wb, 'tools/sidekick/library.xlsx');

  console.log('Library file generated successfully in tools/sidekick/library.xlsx, upload it to sharepoint and make sure to publish it');
}

export async function generateLibrary(config) {
  const urls = await fetchSiteUrls(config);
  await processUrls(urls);
  console.log('Finished processing URLs');
}
