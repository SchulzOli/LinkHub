/**
 * Build script for the browser extension.
 *
 * 1. Verifies committed extension PNG icons exist in extension/icons/
 * 2. Runs vite build with base='./' → output to dist-extension/
 * 3. Copies extension/manifest.json and extension/icons/ into dist-extension/
 *
 * Usage: node extension/build.mjs
 */

import { execSync } from 'node:child_process'
import { cpSync, existsSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const outDir = resolve(root, 'dist-extension')
const iconsDir = resolve(__dirname, 'icons')
const requiredIcons = ['icon-16.png', 'icon-48.png', 'icon-128.png']

// 1. Verify committed icons exist
const missingIcons = requiredIcons.filter(
  (iconFile) => !existsSync(resolve(iconsDir, iconFile)),
)

if (missingIcons.length > 0) {
  console.error(
    `Missing extension icons: ${missingIcons.join(', ')}. Add the PNG files to extension/icons/ before building.`,
  )
  process.exit(1)
}

// 2. Vite build with relative base and extension output dir
console.log('\nBuilding app for extension…')
execSync('npx vite build --base ./ --outDir dist-extension --emptyOutDir', {
  cwd: root,
  stdio: 'inherit',
})

// 3. Copy manifest.json
cpSync(resolve(__dirname, 'manifest.json'), resolve(outDir, 'manifest.json'))
console.log('✓ Copied manifest.json')

// 4. Copy icons
cpSync(iconsDir, resolve(outDir, 'icons'), { recursive: true })
console.log('✓ Copied icons/')

console.log(`\n✅ Extension ready at: dist-extension/`)
console.log(
  '   Chrome:  chrome://extensions → Developer mode → Load unpacked → select dist-extension/',
)
console.log(
  '   Firefox: about:debugging → Load Temporary Add-on → select dist-extension/manifest.json',
)
