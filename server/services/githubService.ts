import { Octokit } from '@octokit/rest'
import * as fs from 'fs';
import * as path from 'path';

let connectionSettings: any;

async function getAccessToken() {
  if (connectionSettings && connectionSettings.settings.expires_at && new Date(connectionSettings.settings.expires_at).getTime() > Date.now()) {
    return connectionSettings.settings.access_token;
  }
  
  const hostname = process.env.REPLIT_CONNECTORS_HOSTNAME
  const xReplitToken = process.env.REPL_IDENTITY 
    ? 'repl ' + process.env.REPL_IDENTITY 
    : process.env.WEB_REPL_RENEWAL 
    ? 'depl ' + process.env.WEB_REPL_RENEWAL 
    : null;

  if (!xReplitToken) {
    throw new Error('X_REPLIT_TOKEN not found for repl/depl');
  }

  connectionSettings = await fetch(
    'https://' + hostname + '/api/v2/connection?include_secrets=true&connector_names=github',
    {
      headers: {
        'Accept': 'application/json',
        'X_REPLIT_TOKEN': xReplitToken
      }
    }
  ).then(res => res.json()).then(data => data.items?.[0]);

  const accessToken = connectionSettings?.settings?.access_token || connectionSettings.settings?.oauth?.credentials?.access_token;

  if (!connectionSettings || !accessToken) {
    throw new Error('GitHub not connected');
  }
  return accessToken;
}

export async function getUncachableGitHubClient() {
  const accessToken = await getAccessToken();
  return new Octokit({ auth: accessToken });
}

const IGNORED_PATHS = [
  'node_modules',
  '.git',
  '.cache',
  '.config',
  '.upm',
  'dist',
  '.replit',
  'replit.nix',
  '.breakpoints',
  'generated-icon.png',
  'attached_assets'
];

function shouldIgnore(filePath: string): boolean {
  const parts = filePath.split('/');
  return parts.some(part => IGNORED_PATHS.includes(part));
}

function getAllFiles(dirPath: string, basePath: string = ''): { path: string; content: string }[] {
  const files: { path: string; content: string }[] = [];
  
  try {
    const items = fs.readdirSync(dirPath);
    
    for (const item of items) {
      const fullPath = path.join(dirPath, item);
      const relativePath = basePath ? `${basePath}/${item}` : item;
      
      if (shouldIgnore(relativePath)) continue;
      
      const stat = fs.statSync(fullPath);
      
      if (stat.isDirectory()) {
        files.push(...getAllFiles(fullPath, relativePath));
      } else if (stat.isFile()) {
        try {
          const content = fs.readFileSync(fullPath);
          files.push({
            path: relativePath,
            content: content.toString('base64')
          });
        } catch (e) {
          console.log(`Skipping file ${relativePath}: ${e}`);
        }
      }
    }
  } catch (e) {
    console.error(`Error reading directory ${dirPath}:`, e);
  }
  
  return files;
}

export async function pushToGitHub(repoName: string): Promise<{ success: boolean; repoUrl?: string; error?: string }> {
  try {
    const octokit = await getUncachableGitHubClient();
    
    const { data: user } = await octokit.users.getAuthenticated();
    const owner = user.login;
    
    let repo;
    try {
      const { data: existingRepo } = await octokit.repos.get({ owner, repo: repoName });
      repo = existingRepo;
      console.log(`Repository ${repoName} already exists, will update files`);
    } catch (e: any) {
      if (e.status === 404) {
        const { data: newRepo } = await octokit.repos.createForAuthenticatedUser({
          name: repoName,
          description: 'AI Assignment Grader - Built with Replit',
          private: false,
          auto_init: true
        });
        repo = newRepo;
        console.log(`Created new repository: ${repoName}`);
        await new Promise(resolve => setTimeout(resolve, 2000));
      } else {
        throw e;
      }
    }
    
    const files = getAllFiles('.');
    console.log(`Found ${files.length} files to push`);
    
    let baseTree: string;
    try {
      const { data: ref } = await octokit.git.getRef({
        owner,
        repo: repoName,
        ref: 'heads/main'
      });
      baseTree = ref.object.sha;
    } catch (e) {
      const { data: ref } = await octokit.git.getRef({
        owner,
        repo: repoName,
        ref: 'heads/master'
      });
      baseTree = ref.object.sha;
    }
    
    const blobs = [];
    for (const file of files) {
      try {
        const { data: blob } = await octokit.git.createBlob({
          owner,
          repo: repoName,
          content: file.content,
          encoding: 'base64'
        });
        blobs.push({
          path: file.path,
          mode: '100644' as const,
          type: 'blob' as const,
          sha: blob.sha
        });
      } catch (e) {
        console.log(`Failed to create blob for ${file.path}:`, e);
      }
    }
    
    const { data: tree } = await octokit.git.createTree({
      owner,
      repo: repoName,
      tree: blobs,
      base_tree: baseTree
    });
    
    const { data: commit } = await octokit.git.createCommit({
      owner,
      repo: repoName,
      message: 'Push from Replit - AI Assignment Grader',
      tree: tree.sha,
      parents: [baseTree]
    });
    
    try {
      await octokit.git.updateRef({
        owner,
        repo: repoName,
        ref: 'heads/main',
        sha: commit.sha
      });
    } catch (e) {
      await octokit.git.updateRef({
        owner,
        repo: repoName,
        ref: 'heads/master',
        sha: commit.sha
      });
    }
    
    return {
      success: true,
      repoUrl: `https://github.com/${owner}/${repoName}`
    };
  } catch (error: any) {
    console.error('GitHub push error:', error);
    return {
      success: false,
      error: error.message || 'Failed to push to GitHub'
    };
  }
}
