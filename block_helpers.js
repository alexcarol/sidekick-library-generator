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

function getAuthTokenFromBrowser(organization, project) {
  const loginUrl = `https://admin.hlx.page/login/${organization}/${project}/main`;
  console.log('\nTo get your authentication token:');
  console.log(`1. Open this URL in your browser: ${loginUrl}`);
  console.log('2. Log in to your account if prompted');
  console.log('3. Open your browser\'s Developer Tools (F12 or right-click -> Inspect)');
  console.log('4. Go to the "Application" or "Storage" tab');
  console.log('5. Look for "Cookies" under the domain "admin.hlx.page"');
  console.log('6. Find the cookie named "auth_token"');
  console.log('7. Copy its value\n');
  
  throw new Error('Please provide the auth_token from your browser cookies in the config');
}

export async function fetchSiteUrls(config) {
  console.log('Fetching site URLs...');

  const { organization, project, site, apiKey } = config;
  const initialUrl = `https://admin.hlx.page/status/${organization}/${project}/main/*`;
  const postData = {
    paths: ['/*'],
  };

  // Get authentication token either from API key or browser cookie
  let authToken;
  if (apiKey) {
    authToken = `token ${apiKey}`;
  } else if (config.authToken) {
    authToken = config.authToken;
  } else {
    getAuthTokenFromBrowser(organization, project);
  }

  const authHeaders = {
    authorization: authToken,
    'Content-Type': 'application/json',
  };

  // Step 1: Start the job
  const { data: startJobResponse } = await axios.post(initialUrl, postData, {
    headers: authHeaders,
  });

  const selfLink = startJobResponse.links.self;

  const limit = 20;
  let count = 0;

  // Step 2: Poll the "self" link until the job state is "stopped"
  let jobState = 'created';
  while (jobState !== 'stopped' && count < limit) {
    count += 1;
     
    const { data: jobStatus } = await axios.get(selfLink, {
      headers: authHeaders,
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
    headers: authHeaders,
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
