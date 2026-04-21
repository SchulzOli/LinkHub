/**
 * Deploy script for publishing the browser extension to store(s).
 *
 * Usage:
 *   node extension/deploy.mjs                    # deploy to all configured stores
 *   node extension/deploy.mjs --publish-only firefox
 *   node extension/deploy.mjs --publish-only chrome firefox
 *   node extension/deploy.mjs --dry-run          # validate without deploying
 *
 * Prerequisites:
 *   - Run `npm run build:extension` first (or this script runs it for you)
 *   - Store credentials in .env files: firefox.env, chrome.env, edge.env
 *   - See *.env.example files for templates
 *
 * Environment variables (for CI):
 *   FIREFOX_JWT_ISSUER, FIREFOX_JWT_SECRET, FIREFOX_EXT_ID
 *   CHROME_EXT_ID, CHROME_PUBLISHER_ID, CHROME_SERVICE_ACCOUNT_JSON
 *   EDGE_CLIENT_ID, EDGE_API_KEY, EDGE_PRODUCT_ID
 */

import { GoogleAuth } from 'google-auth-library'
import JSZip from 'jszip'
import { execSync } from 'node:child_process'
import {
  existsSync,
  readFileSync,
  readdirSync,
  statSync,
  writeFileSync,
} from 'node:fs'
import { dirname, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const distDir = resolve(root, 'dist-extension')
const chromeScope = 'https://www.googleapis.com/auth/chromewebstore'
const supportedStores = ['firefox', 'chrome', 'edge']

function fail(message) {
  console.error(message)
  process.exit(1)
}

function parseCliArgs(argv) {
  const publishOnly = []
  const passThroughArgs = []
  let dryRun = false

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index]

    if (arg === '--dry-run') {
      dryRun = true
      continue
    }

    if (arg === '--publish-only') {
      while (index + 1 < argv.length && !argv[index + 1].startsWith('--')) {
        publishOnly.push(argv[index + 1])
        index += 1
      }
      continue
    }

    passThroughArgs.push(arg)
  }

  return {
    dryRun,
    passThroughArgs,
    publishOnly: [...new Set(publishOnly)],
  }
}

function parseEnvFile(filePath) {
  if (!existsSync(filePath)) {
    return {}
  }

  const content = readFileSync(filePath, 'utf8')
  const env = {}

  for (const rawLine of content.split(/\r?\n/u)) {
    const line = rawLine.trim()
    if (!line || line.startsWith('#')) {
      continue
    }

    const separatorIndex = line.indexOf('=')
    if (separatorIndex === -1) {
      continue
    }

    const key = line.slice(0, separatorIndex).trim()
    let value = line.slice(separatorIndex + 1).trim()

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    env[key] = value
  }

  return env
}

function normalizeSecret(value) {
  return value ? value.replace(/\\n/g, '\n') : undefined
}

function readChromeConfig() {
  const env = parseEnvFile(resolve(root, 'chrome.env'))
  const zipPath = resolve(
    root,
    process.env.CHROME_ZIP || env.ZIP || 'dist-extension.zip',
  )

  const config = {
    extId: process.env.CHROME_EXT_ID || env.EXT_ID,
    publisherId: process.env.CHROME_PUBLISHER_ID || env.PUBLISHER_ID,
    zipPath,
    serviceAccountJson:
      process.env.CHROME_SERVICE_ACCOUNT_JSON || env.SERVICE_ACCOUNT_JSON,
    serviceAccountKeyFile:
      process.env.CHROME_SERVICE_ACCOUNT_KEY_FILE ||
      env.SERVICE_ACCOUNT_KEY_FILE,
    serviceAccountEmail:
      process.env.CHROME_SERVICE_ACCOUNT_EMAIL || env.SERVICE_ACCOUNT_EMAIL,
    serviceAccountPrivateKey: normalizeSecret(
      process.env.CHROME_SERVICE_ACCOUNT_PRIVATE_KEY ||
        env.SERVICE_ACCOUNT_PRIVATE_KEY,
    ),
    serviceAccountProjectId:
      process.env.CHROME_SERVICE_ACCOUNT_PROJECT_ID ||
      env.SERVICE_ACCOUNT_PROJECT_ID,
  }

  const missing = []

  if (!config.extId) {
    missing.push('EXT_ID / CHROME_EXT_ID')
  }

  if (!config.publisherId) {
    missing.push('PUBLISHER_ID / CHROME_PUBLISHER_ID')
  }

  if (
    !config.serviceAccountJson &&
    !config.serviceAccountKeyFile &&
    !(config.serviceAccountEmail && config.serviceAccountPrivateKey)
  ) {
    missing.push(
      'SERVICE_ACCOUNT_KEY_FILE or SERVICE_ACCOUNT_JSON or SERVICE_ACCOUNT_EMAIL + SERVICE_ACCOUNT_PRIVATE_KEY',
    )
  }

  if (!existsSync(config.zipPath)) {
    missing.push(`ZIP file not found: ${config.zipPath}`)
  }

  return {
    ...config,
    isConfigured: missing.length === 0,
    missing,
  }
}

function getChromeServiceAccountCredentials(config) {
  if (config.serviceAccountJson) {
    return JSON.parse(config.serviceAccountJson)
  }

  if (config.serviceAccountKeyFile) {
    const keyFilePath = resolve(root, config.serviceAccountKeyFile)
    return JSON.parse(readFileSync(keyFilePath, 'utf8'))
  }

  return {
    client_email: config.serviceAccountEmail,
    private_key: config.serviceAccountPrivateKey,
    project_id: config.serviceAccountProjectId,
    type: 'service_account',
  }
}

async function getChromeAccessToken(config) {
  const credentials = getChromeServiceAccountCredentials(config)
  const auth = new GoogleAuth({
    credentials,
    scopes: [chromeScope],
  })
  const client = await auth.getClient()
  const tokenResponse = await client.getAccessToken()
  const accessToken =
    typeof tokenResponse === 'string' ? tokenResponse : tokenResponse?.token

  if (!accessToken) {
    throw new Error('Could not acquire a Chrome Web Store access token.')
  }

  return accessToken
}

async function chromeApiRequest(
  url,
  { accessToken, method = 'GET', body, contentType },
) {
  const response = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${accessToken}`,
      ...(contentType ? { 'Content-Type': contentType } : {}),
    },
    body,
  })

  const rawBody = await response.text()
  const data = rawBody ? JSON.parse(rawBody) : {}

  if (!response.ok) {
    throw new Error(
      `Chrome Web Store API ${method} ${url} failed (${response.status}): ${rawBody}`,
    )
  }

  return data
}

function isChromeUploadInProgress(result) {
  const uploadState = String(result?.uploadState || '').toUpperCase()
  return uploadState === 'UPLOAD_IN_PROGRESS' || uploadState === 'IN_PROGRESS'
}

function getChromeErrorDetails(result) {
  const errors = result?.itemError || result?.itemErrors || result?.errors
  if (!Array.isArray(errors) || errors.length === 0) {
    return undefined
  }

  return errors
    .map(
      (error) => error?.errorDetail || error?.message || JSON.stringify(error),
    )
    .join('; ')
}

async function waitForChromeUpload(config, accessToken) {
  const statusUrl = `https://chromewebstore.googleapis.com/v2/publishers/${config.publisherId}/items/${config.extId}:fetchStatus`

  for (let attempt = 1; attempt <= 10; attempt += 1) {
    await new Promise((resolvePoll) => {
      setTimeout(resolvePoll, 3000)
    })

    const status = await chromeApiRequest(statusUrl, { accessToken })
    if (!isChromeUploadInProgress(status)) {
      return status
    }

    console.log(`Chrome upload still processing (${attempt}/10)…`)
  }

  throw new Error('Chrome upload did not finish processing within 30 seconds.')
}

function ensureChromeUploadSucceeded(result) {
  const uploadState = String(result?.uploadState || '').toUpperCase()

  if (
    !uploadState ||
    uploadState === 'SUCCESS' ||
    uploadState === 'SUCCEEDED'
  ) {
    return
  }

  const details = getChromeErrorDetails(result)
  const detailSuffix = details ? `: ${details}` : ''
  throw new Error(
    `Chrome upload failed with state ${uploadState}${detailSuffix}`,
  )
}

async function deployChrome(config, { dryRun }) {
  if (!config.isConfigured) {
    fail(
      `Chrome deployment is missing configuration: ${config.missing.join(', ')}`,
    )
  }

  console.log('\nChrome Web Store configuration found.')

  if (dryRun) {
    console.log('✓ Chrome dry-run validation passed')
    return
  }

  const accessToken = await getChromeAccessToken(config)
  const uploadUrl = `https://chromewebstore.googleapis.com/upload/v2/publishers/${config.publisherId}/items/${config.extId}:upload`
  const publishUrl = `https://chromewebstore.googleapis.com/v2/publishers/${config.publisherId}/items/${config.extId}:publish`

  console.log('Uploading Chrome package…')
  let uploadResult = await chromeApiRequest(uploadUrl, {
    accessToken,
    method: 'POST',
    body: readFileSync(config.zipPath),
    contentType: 'application/zip',
  })

  if (isChromeUploadInProgress(uploadResult)) {
    console.log('Chrome upload accepted, waiting for processing…')
    uploadResult = await waitForChromeUpload(config, accessToken)
  }

  ensureChromeUploadSucceeded(uploadResult)
  console.log('✓ Chrome package uploaded')

  console.log('Submitting Chrome item for publish…')
  await chromeApiRequest(publishUrl, {
    accessToken,
    method: 'POST',
  })
  console.log('✓ Chrome publish request submitted')
}

function createSourceArchive() {
  const sourceZip = resolve(root, 'linkhub-source.zip')
  console.log('\nCreating source archive…')
  try {
    execSync('git archive --format=zip -o linkhub-source.zip HEAD', {
      cwd: root,
      stdio: 'inherit',
    })
    console.log('✓ linkhub-source.zip')
  } catch (err) {
    fail(
      `Failed to create source archive: ${err.message}\n  (git must be available and the working directory must be a git repo)`,
    )
  }

  return sourceZip
}

function runWebExtDeploy(stores, { dryRun, passThroughArgs }) {
  if (stores.length === 0) {
    return
  }

  const args = [
    'env',
    '--publish-only',
    ...stores,
    ...(dryRun ? ['--dry-run'] : []),
    ...passThroughArgs,
    '--verbose',
  ]

  const cmd = `npx web-ext-deploy ${args.join(' ')}`
  console.log(`\nRunning: ${cmd}\n`)

  try {
    execSync(cmd, { cwd: root, stdio: 'inherit' })
  } catch {
    fail('\n❌ Deployment failed')
  }
}

const cliArgs = parseCliArgs(process.argv.slice(2))

for (const store of cliArgs.publishOnly) {
  if (!supportedStores.includes(store)) {
    fail(
      `Unsupported store \"${store}\". Supported stores: ${supportedStores.join(', ')}`,
    )
  }
}

// ── 1. Ensure extension is built ─────────────────────────────────
if (!existsSync(resolve(distDir, 'manifest.json'))) {
  console.log('dist-extension/ not found — building extension first…')
  execSync('node extension/build.mjs', { cwd: root, stdio: 'inherit' })
}

// ── 2. Create extension ZIP from dist-extension/ ─────────────────
const extensionZip = resolve(root, 'dist-extension.zip')
console.log('\nCreating extension ZIP…')
try {
  await zipDirectory(distDir, extensionZip)
  console.log('✓ dist-extension.zip')
} catch (err) {
  console.error('Failed to create extension ZIP:', err.message)
  process.exit(1)
}

/**
 * Create a ZIP archive of `sourceDir` at `outputPath` using JSZip.
 * Uses only sanitized path values (no shell invocation) to avoid
 * command injection from paths that contain spaces or quotes.
 */
async function zipDirectory(sourceDir, outputPath) {
  const zip = new JSZip()

  function addEntries(currentDir) {
    for (const entry of readdirSync(currentDir)) {
      const absolutePath = resolve(currentDir, entry)
      const relativePath = relative(sourceDir, absolutePath).replace(/\\/g, '/')
      const stats = statSync(absolutePath)
      if (stats.isDirectory()) {
        addEntries(absolutePath)
      } else if (stats.isFile()) {
        zip.file(relativePath, readFileSync(absolutePath))
      }
    }
  }

  addEntries(sourceDir)

  const buffer = await zip.generateAsync({
    type: 'nodebuffer',
    compression: 'DEFLATE',
    compressionOptions: { level: 9 },
  })
  writeFileSync(outputPath, buffer)
}

// ── 3. Generate .env files from environment variables (CI) ────────
function writeCiEnvFile(storeName, entries, requiredKeys = []) {
  const envPath = resolve(root, `${storeName}.env`)
  if (existsSync(envPath)) return // local .env takes priority

  const requiredValues = new Map(entries)
  const hasRequiredValues = requiredKeys.every((key) => requiredValues.get(key))
  if (!hasRequiredValues) return

  const lines = entries
    .filter(([, value]) => value)
    .map(([key, value]) => `${key}=${value}`)

  if (lines.length === 0) return

  writeFileSync(envPath, lines.join('\n') + '\n')
  console.log(`✓ Generated ${storeName}.env from environment variables`)
}

writeCiEnvFile(
  'firefox',
  [
    ['JWT_ISSUER', process.env.FIREFOX_JWT_ISSUER],
    ['JWT_SECRET', process.env.FIREFOX_JWT_SECRET],
    ['EXT_ID', process.env.FIREFOX_EXT_ID || 'linkhub'],
    ['ZIP', 'dist-extension.zip'],
    ['ZIP_SOURCE', 'linkhub-source.zip'],
  ],
  ['JWT_ISSUER', 'JWT_SECRET'],
)

writeCiEnvFile(
  'edge',
  [
    ['CLIENT_ID', process.env.EDGE_CLIENT_ID],
    ['API_KEY', process.env.EDGE_API_KEY],
    ['PRODUCT_ID', process.env.EDGE_PRODUCT_ID],
    ['ZIP', 'dist-extension.zip'],
  ],
  ['CLIENT_ID', 'API_KEY', 'PRODUCT_ID'],
)

const chromeConfig = readChromeConfig()
const configuredStores = []

if (existsSync(resolve(root, 'firefox.env'))) {
  configuredStores.push('firefox')
}

if (chromeConfig.isConfigured) {
  configuredStores.push('chrome')
}

if (existsSync(resolve(root, 'edge.env'))) {
  configuredStores.push('edge')
}

const storesToDeploy =
  cliArgs.publishOnly.length > 0 ? cliArgs.publishOnly : configuredStores

if (storesToDeploy.length === 0) {
  fail(
    'No configured stores found. Add firefox.env, chrome.env, or edge.env, or pass CI secrets.',
  )
}

if (
  storesToDeploy.includes('firefox') &&
  !existsSync(resolve(root, 'firefox.env'))
) {
  fail(
    'Firefox deployment requested, but firefox.env (or equivalent CI secrets) is missing.',
  )
}

if (storesToDeploy.includes('chrome') && !chromeConfig.isConfigured) {
  fail(
    `Chrome deployment is missing configuration: ${chromeConfig.missing.join(', ')}`,
  )
}

if (storesToDeploy.includes('edge') && !existsSync(resolve(root, 'edge.env'))) {
  fail(
    'Edge deployment requested, but edge.env (or equivalent CI secrets) is missing.',
  )
}

if (storesToDeploy.includes('firefox')) {
  createSourceArchive()
}

try {
  if (storesToDeploy.includes('chrome')) {
    await deployChrome(chromeConfig, { dryRun: cliArgs.dryRun })
  }

  runWebExtDeploy(
    storesToDeploy.filter((store) => store !== 'chrome'),
    cliArgs,
  )

  console.log('\n✅ Deployment complete!')
} catch (err) {
  fail(`\n❌ Deployment failed\n${err.message}`)
}
