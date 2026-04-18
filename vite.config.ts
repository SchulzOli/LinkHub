import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Match the Firefox add-on minimum version and the Chromium equivalents for extension builds.
const extensionBuildTarget = ['chrome109', 'edge109', 'firefox109']

const vendorChunkGroups = [
  {
    name: 'react-vendor',
    test: /node_modules[\\/](?:react|react-dom)(?:[\\/]|$)/,
    priority: 50,
  },
  {
    name: 'validation-vendor',
    test: /node_modules[\\/]zod(?:[\\/]|$)/,
    priority: 40,
  },
  {
    name: 'workspace-vendor',
    test: /node_modules[\\/](?:zustand|idb)(?:[\\/]|$)/,
    priority: 30,
  },
  {
    name: 'import-export-vendor',
    test: /node_modules[\\/]jszip(?:[\\/]|$)/,
    priority: 20,
  },
  {
    name: 'vendor',
    test: /node_modules[\\/]/,
    priority: 10,
  },
]

export default defineConfig(({ mode }) => {
  const isExtensionBuild = mode === 'extension'

  return {
    build: {
      target: isExtensionBuild ? extensionBuildTarget : undefined,
      rolldownOptions: {
        output: {
          codeSplitting: {
            groups: vendorChunkGroups,
          },
        },
      },
    },
    plugins: [react()],
    server: {
      forwardConsole: {
        unhandledErrors: true,
        logLevels: ['warn', 'error'],
      },
    },
  }
})
