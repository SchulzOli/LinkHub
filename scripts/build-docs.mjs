/**
 * Builds the LinkHub documentation website into site/.
 *
 * Sources (single source of truth, no copies):
 *   doc/site/*.md      guide pages with front matter
 *   doc/*.md           reference pages listed in REFERENCE_PAGES
 *   extension/screenshots/*.png, public/linkhub-mark.svg, public/privacy/
 *
 * Usage: node scripts/build-docs.mjs [--out site]
 */

import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

import { Marked } from 'marked'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const outArgIndex = process.argv.indexOf('--out')
const outDir = resolve(
  root,
  outArgIndex > -1 ? process.argv[outArgIndex + 1] : 'site',
)
const repoUrl = 'https://github.com/SchulzOli/LinkHub'

/** doc/*.md files published as reference pages. */
const REFERENCE_PAGES = [
  {
    file: 'doc/CHART_FEED.md',
    slug: 'charts',
    title: 'Charts',
    description: 'Chart nodes, group inheritance and the chart feed protocol.',
    section: 'Features',
    order: 3,
  },
  {
    file: 'doc/NEWS_FEED.md',
    slug: 'news-feeds',
    title: 'News feeds',
    description: 'RSS and Atom feed nodes and the local feed proxy.',
    section: 'Features',
    order: 4,
  },
  {
    file: 'doc/STORAGE.md',
    slug: 'storage',
    title: 'Storage',
    description: 'IndexedDB, localStorage, bundles, migrations.',
    section: 'Develop',
    order: 8,
  },
  {
    file: 'doc/CANVAS_ENGINE.md',
    slug: 'canvas-engine',
    title: 'Canvas engine',
    description: 'Camera, grid and the optional card effects.',
    section: 'Develop',
    order: 9,
  },
]

const SECTION_ORDER = ['Guide', 'Features', 'Develop']

// ── Markdown ─────────────────────────────────────────────────────

function parseFrontMatter(source) {
  const match = /^---\r?\n([\s\S]*?)\r?\n---\r?\n/.exec(source)

  if (!match) {
    return { data: {}, body: source }
  }

  const data = Object.fromEntries(
    match[1]
      .split(/\r?\n/)
      .map((line) => /^(\w+):\s*(.*)$/.exec(line))
      .filter(Boolean)
      .map(([, key, value]) => [key, value.trim()]),
  )

  return { data, body: source.slice(match[0].length) }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
}

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/<[^>]+>/g, '')
    .replace(/&[a-z]+;/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
}

/**
 * Maps a link written for GitHub (relative .md paths, ../src/…) to the site.
 * Page links go to the generated page; repo files go to GitHub.
 */
function rewriteHref(href, pagesByFile, sourceFile) {
  if (/^(https?:|mailto:|#)/.test(href)) {
    return href
  }

  const [path, hash] = href.split('#')
  const resolved = resolve(root, dirname(sourceFile), path)
  const relative = resolved.slice(root.length + 1).replaceAll('\\', '/')
  const page = pagesByFile.get(relative)

  if (page) {
    return `${page.slug}.html${hash ? `#${hash}` : ''}`
  }

  if (
    /\.html(#|$)/.test(href) ||
    href.startsWith('assets/') ||
    href === 'privacy/'
  ) {
    return href
  }

  return `${repoUrl}/blob/main/${relative}${hash ? `#${hash}` : ''}`
}

function renderMarkdown(body, pagesByFile, sourceFile) {
  const headings = []
  const marked = new Marked({ gfm: true })

  marked.use({
    renderer: {
      heading({ tokens, depth }) {
        const text = this.parser.parseInline(tokens)
        const id = slugify(text)

        if (depth === 2 || depth === 3) {
          headings.push({ depth, id, text: text.replace(/<[^>]+>/g, '') })
        }

        const anchor =
          depth > 1
            ? `<a class="anchor" href="#${id}" aria-hidden="true" tabindex="-1">#</a>`
            : ''

        return `<h${depth} id="${id}">${anchor}${text}</h${depth}>\n`
      },
      link({ href, title, tokens }) {
        const text = this.parser.parseInline(tokens)
        const target = rewriteHref(href, pagesByFile, sourceFile)
        const external = /^https?:/.test(target)

        return `<a href="${escapeHtml(target)}"${title ? ` title="${escapeHtml(title)}"` : ''}${external ? ' rel="noopener"' : ''}>${text}</a>`
      },
      image({ href, text }) {
        return `<figure><img src="${escapeHtml(href)}" alt="${escapeHtml(text)}" loading="lazy" width="1280" height="800" /><figcaption>${escapeHtml(text)}</figcaption></figure>`
      },
      table(token) {
        // Wrap tables so wide ones scroll instead of breaking the layout.
        const html = marked.Renderer.prototype.table.call(this, token)

        return `<div class="table-wrap">${html}</div>`
      },
    },
  })

  const html = marked.parse(body)

  return { html, headings }
}

// ── Pages ────────────────────────────────────────────────────────

function loadPages() {
  const guideDir = resolve(root, 'doc/site')
  const guides = readdirSync(guideDir)
    .filter((file) => file.endsWith('.md'))
    .map((file) => {
      const source = readFileSync(resolve(guideDir, file), 'utf8')
      const { data, body } = parseFrontMatter(source)

      return {
        file: `doc/site/${file}`,
        slug: file.replace(/\.md$/, ''),
        title: data.title,
        description: data.description ?? '',
        section: data.section ?? 'Guide',
        order: Number(data.order ?? 99),
        body,
      }
    })
  const references = REFERENCE_PAGES.map((page) => {
    const body = readFileSync(resolve(root, page.file), 'utf8')

    return { ...page, body }
  })

  return [...guides, ...references].sort((a, b) => a.order - b.order)
}

function navHtml(pages, current) {
  return SECTION_ORDER.map((section) => {
    const items = pages
      .filter((page) => page.section === section)
      .map(
        (page) =>
          `<li><a href="${page.slug}.html"${page.slug === current ? ' aria-current="page"' : ''}>${escapeHtml(page.title)}</a></li>`,
      )
      .join('')

    return items ? `<p class="nav-section">${section}</p><ul>${items}</ul>` : ''
  }).join('')
}

function tocHtml(headings) {
  const items = headings
    .filter((heading) => heading.depth === 2)
    .map(
      (heading) =>
        `<li><a href="#${heading.id}">${escapeHtml(heading.text)}</a></li>`,
    )
    .join('')

  return items
    ? `<nav class="toc" aria-label="On this page"><p>On this page</p><ul>${items}</ul></nav>`
    : ''
}

function layout({ title, description, body, nav, toc, slug, prev, next }) {
  const pager =
    prev || next
      ? `<nav class="pager" aria-label="Pages">${prev ? `<a class="prev" href="${prev.slug}.html"><span>Previous</span>${escapeHtml(prev.title)}</a>` : '<span></span>'}${next ? `<a class="next" href="${next.slug}.html"><span>Next</span>${escapeHtml(next.title)}</a>` : ''}</nav>`
      : ''
  const editLink = slug
    ? `<p class="edit"><a href="${repoUrl}/edit/main/${escapeHtml(slug)}" rel="noopener">Edit this page on GitHub</a></p>`
    : ''

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>${escapeHtml(title)} · LinkHub</title>
<meta name="description" content="${escapeHtml(description)}" />
<meta property="og:title" content="${escapeHtml(title)} · LinkHub" />
<meta property="og:description" content="${escapeHtml(description)}" />
<meta property="og:image" content="assets/screenshots/01-canvas-overview.png" />
<link rel="icon" type="image/svg+xml" href="assets/linkhub-mark.svg" />
<script>
  (() => {
    const stored = localStorage.getItem('linkhub-docs-theme')
    const dark = stored ? stored === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches
    document.documentElement.dataset.theme = dark ? 'dark' : 'light'
  })()
</script>
<link rel="stylesheet" href="assets/site.css" />
</head>
<body>
<a class="skip" href="#main">Skip to content</a>
<header class="topbar">
  <button class="menu-toggle" type="button" aria-controls="sidebar" aria-expanded="false" aria-label="Open navigation">
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
  </button>
  <a class="brand" href="index.html"><img src="assets/linkhub-mark.svg" alt="" width="28" height="28" /><span>LinkHub</span></a>
  <label class="search">
    <span class="visually-hidden">Search the docs</span>
    <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="11" cy="11" r="6" /><path d="m20 20-4.2-4.2" /></svg>
    <input id="search" type="search" placeholder="Search" autocomplete="off" />
    <ul id="search-results" class="search-results" role="listbox" hidden></ul>
  </label>
  <a class="topbar-link" href="${repoUrl}" rel="noopener">GitHub</a>
  <button class="theme-toggle" type="button" aria-label="Switch color theme">
    <svg data-icon="dark" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z" /></svg>
    <svg data-icon="light" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></svg>
  </button>
</header>
<div class="shell">
  <aside class="sidebar" id="sidebar"><nav aria-label="Documentation">${nav}</nav></aside>
  <main id="main">
    <article class="content">${body}${editLink}${pager}</article>
    ${toc}
  </main>
</div>
<footer class="footer">
  <p>LinkHub is open source under the MIT license. <a href="${repoUrl}" rel="noopener">Source</a> · <a href="privacy/">Privacy policy</a> · <a href="${repoUrl}/issues" rel="noopener">Feedback</a></p>
</footer>
<script src="assets/site.js" defer></script>
</body>
</html>
`
}

function homeBody(pages) {
  const cards = [
    [
      'getting-started',
      'Get started',
      'Install the extension or run it from source.',
    ],
    [
      'canvas',
      'Canvas and nodes',
      'Cards, groups, pictures, edit panels, shortcuts.',
    ],
    ['charts', 'Charts', 'Live time series over WebSocket or SSE.'],
    [
      'news-feeds',
      'News feeds',
      'Merge RSS and Atom feeds; filter and sort articles.',
    ],
    [
      'menu',
      'Menu and settings',
      'Options, themes, templates, statistics, data.',
    ],
    [
      'privacy',
      'Privacy and data',
      'What is stored and which requests are made.',
    ],
  ]
    .filter(([slug]) => pages.some((page) => page.slug === slug))
    .map(
      ([slug, title, text]) =>
        `<a class="card" href="${slug}.html"><strong>${title}</strong><span>${text}</span></a>`,
    )
    .join('')

  return `
<section class="hero">
  <p class="eyebrow">Your new tab, as a canvas</p>
  <h1>LinkHub</h1>
  <p class="lead">An infinite board for links, groups, pictures, live charts and news feeds. Local-first: no account, no cloud, no tracking.</p>
  <div class="hero-actions">
    <a class="button primary" href="getting-started.html">Get started</a>
    <a class="button" href="https://chromewebstore.google.com/detail/linkhub/dpbgplhiaobnegcbfedihimnoamlpgmd" rel="noopener">Chrome</a>
    <a class="button" href="https://microsoftedge.microsoft.com/addons/detail/linkhub/gkcpbfphinbaoplepknkinjfkdhljghp" rel="noopener">Edge</a>
    <a class="button" href="https://addons.mozilla.org/en-US/firefox/addon/link-hub/" rel="noopener">Firefox</a>
  </div>
</section>
<figure class="hero-shot"><img src="assets/screenshots/01-canvas-overview.png" alt="LinkHub canvas with five groups of link cards" width="1280" height="800" /></figure>
<h2 id="explore">Explore</h2>
<div class="cards">${cards}</div>
<h2 id="screenshots">Screenshots</h2>
<div class="gallery">
  ${[
    ['07-charts-and-news', 'Live charts and a merged news feed'],
    ['03-themes-customization', 'Six themes with live previews'],
    ['04-card-edit-styling', 'Edit panel for a link card'],
    ['06-template-library', 'Reusable templates'],
    ['08-local-statistics', 'Local statistics'],
    ['05-multiple-workspaces', 'Multiple workspaces'],
  ]
    .map(
      ([file, caption]) =>
        `<figure><a href="assets/screenshots/${file}.png"><img src="assets/screenshots/${file}.png" alt="${caption}" loading="lazy" width="1280" height="800" /></a><figcaption>${caption}</figcaption></figure>`,
    )
    .join('')}
</div>`
}

// ── Build ────────────────────────────────────────────────────────

function build() {
  const pages = loadPages()
  const pagesByFile = new Map(pages.map((page) => [page.file, page]))
  const searchIndex = []

  rmSync(outDir, { recursive: true, force: true })
  mkdirSync(resolve(outDir, 'assets'), { recursive: true })

  for (const [index, page] of pages.entries()) {
    const { html, headings } = renderMarkdown(page.body, pagesByFile, page.file)

    writeFileSync(
      resolve(outDir, `${page.slug}.html`),
      layout({
        title: page.title,
        description: page.description,
        body: html,
        nav: navHtml(pages, page.slug),
        toc: tocHtml(headings),
        slug: page.file,
        prev: pages[index - 1],
        next: pages[index + 1],
      }),
    )

    searchIndex.push({
      slug: page.slug,
      title: page.title,
      section: page.section,
      headings: headings.map(({ id, text }) => ({ id, text })),
      text: html
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .slice(0, 6000),
    })
  }

  writeFileSync(
    resolve(outDir, 'index.html'),
    layout({
      title: 'Documentation',
      description:
        'LinkHub turns your new tab into an infinite canvas for links, groups, charts and news feeds.',
      body: homeBody(pages),
      nav: navHtml(pages, ''),
      toc: '',
    }),
  )

  writeFileSync(
    resolve(outDir, 'search-index.json'),
    JSON.stringify(searchIndex),
  )

  const assetsSource = resolve(root, 'doc/site/assets')
  cpSync(assetsSource, resolve(outDir, 'assets'), { recursive: true })
  cpSync(
    resolve(root, 'extension/screenshots'),
    resolve(outDir, 'assets/screenshots'),
    { recursive: true },
  )
  cpSync(
    resolve(root, 'public/linkhub-mark.svg'),
    resolve(outDir, 'assets/linkhub-mark.svg'),
  )
  // The privacy page links ../linkhub-mark.svg; keep that path working.
  cpSync(
    resolve(root, 'public/linkhub-mark.svg'),
    resolve(outDir, 'linkhub-mark.svg'),
  )
  cpSync(resolve(root, 'public/privacy'), resolve(outDir, 'privacy'), {
    recursive: true,
  })
  // GitHub Pages: serve files as they are (no Jekyll).
  writeFileSync(resolve(outDir, '.nojekyll'), '')

  if (!existsSync(resolve(outDir, 'privacy/index.html'))) {
    throw new Error('privacy page missing from the site')
  }

  console.log(`✓ ${pages.length + 1} pages → ${outDir.slice(root.length + 1)}/`)
}

build()
