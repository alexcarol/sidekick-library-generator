import axios from 'axios';
import fs from 'fs';
import path from 'path';

export function listProjectBlocks() {
  const blocksDir = 'blocks';
  return fs
    .readdirSync(blocksDir)
    .filter((file) => fs.statSync(path.join(blocksDir, file)).isDirectory());
}

export function populateFileContentsMap(folder, fileContentsMap) {
  const files = fs.readdirSync(folder);
  files.forEach((file) => {
    const fullPath = path.join(folder, file);
    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      populateFileContentsMap(fullPath, fileContentsMap);
    } else if (stat.isFile()) {
      const content = fs.readFileSync(fullPath, 'utf8');
      fileContentsMap.set(fullPath, content);
    } else {
      throw new Error('Unexpected file type', stat);
    }
  });
}

export function getFileContentsMap() {
  const fileContentsMap = new Map();
  const folders = ['blocks', 'scripts', 'templates', 'styles'];
  folders.forEach((folder) => populateFileContentsMap(folder, fileContentsMap));
  return fileContentsMap;
}

export async function fetchSiteUrls(config) {
  console.log('Fetching site URLs...');

  const { organization, project, site, apiKey } = config;
  const initialUrl = `https://admin.hlx.page/status/${organization}/${project}/main/*`;
  const postData = {
    paths: ['/*'],
  };

  // Step 1: Start the job
  const { data: startJobResponse } = await axios.post(initialUrl, postData, {
    headers: {
      authorization: `token ${apiKey}`,
      'Content-Type': 'application/json',
    },
  });

  const selfLink = startJobResponse.links.self;

  const limit = 20;
  let count = 0;

  // Step 2: Poll the "self" link until the job state is "stopped"
  let jobState = 'created';
  while (jobState !== 'stopped' && count < limit) {
    count += 1;
     
    const { data: jobStatus } = await axios.get(selfLink, {
      headers: {
        authorization: `token ${apiKey}`,
      },
    });
    jobState = jobStatus.state;
    if (jobState !== 'stopped') {
       
      await new Promise((resolve) => { setTimeout(resolve, 500); });
    }
  }

  if (jobState !== 'stopped') {
    throw new Error(`Job did not complete after ${limit} attempts`);
  }

  // Step 3: Query the "details" link to get the URLs
  const detailsLink = `${selfLink}/details`;
  const { data: detailsResponse } = await axios.get(detailsLink, {
    headers: {
      authorization: `token ${apiKey}`,
    },
  });

  const siteUrls = detailsResponse.data.resources.filter((resource) => {
    if (resource.publishConfigRedirectLocation) {
      return false;
    }

    if (!resource.publishLastModified) {
      return false;
    }

    const pathname = resource.path;
    if (pathname.startsWith('/drafts/') || pathname.startsWith('/tools')) {
      return false;
    }

    const filteredExtensions = ['.svg', '.json', '.mp4'];
    return !filteredExtensions.includes(path.extname(pathname));
  }).map((resource) => `${site}${resource.path}`);
  console.log(`Obtained ${siteUrls.length} site URLs`);

  return siteUrls;
}
