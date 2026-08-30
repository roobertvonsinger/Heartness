import { execSync } from 'node:child_process'

async function createRepo() {
  console.log('Fetching GitHub credentials from git-credential-manager...')
  const creds = execSync('git credential fill', {
    input: 'protocol=https\nhost=github.com\n',
    encoding: 'utf8',
  })

  let username = ''
  let token = ''
  for (const line of creds.split('\n')) {
    if (line.startsWith('username=')) username = line.slice('username='.length).trim()
    if (line.startsWith('password=')) token = line.slice('password='.length).trim()
  }

  if (!token) {
    throw new Error('No GitHub token found in git credential helper')
  }

  const repoName = 'Heartness'
  console.log(`Checking if repo ${username}/${repoName} exists...`)

  const checkRes = await fetch(`https://api.github.com/repos/${username}/${repoName}`, {
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'Node-Fetch',
    },
  })

  if (checkRes.status === 200) {
    const data = await checkRes.json()
    console.log(`Repo already exists: ${data.html_url} (Private: ${data.private})`)
    if (data.private) {
      console.log('Updating repo visibility to PUBLIC...')
      const patchRes = await fetch(`https://api.github.com/repos/${username}/${repoName}`, {
        method: 'PATCH',
        headers: {
          Authorization: `token ${token}`,
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'Node-Fetch',
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ private: false }),
      })
      const patchData = await patchRes.json()
      console.log('Updated visibility:', patchData.html_url, 'Private:', patchData.private)
    }
    return data.html_url
  }

  console.log(`Creating public repo ${username}/${repoName}...`)
  const createRes = await fetch('https://api.github.com/user/repos', {
    method: 'POST',
    headers: {
      Authorization: `token ${token}`,
      Accept: 'application/vnd.github.v3+json',
      'User-Agent': 'Node-Fetch',
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      name: repoName,
      description: 'DeepSick Hardness (DSH) — Sovereign Fronting & Governance Suite with Cordis Middlewares & Multi-Provider Gateway',
      private: false,
      has_issues: true,
      has_projects: true,
      has_wiki: true,
    }),
  })

  if (!createRes.ok) {
    const err = await createRes.text()
    throw new Error(`Failed to create repo (${createRes.status}): ${err}`)
  }

  const newRepo = await createRes.json()
  console.log(`Successfully created public repository: ${newRepo.html_url}`)
  return newRepo.html_url
}

createRepo().catch(err => {
  console.error(err)
  process.exit(1)
})
