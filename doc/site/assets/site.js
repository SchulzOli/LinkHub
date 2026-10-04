// LinkHub documentation: theme toggle, mobile navigation, search, TOC.
;(() => {
  const root = document.documentElement
  const THEME_KEY = 'linkhub-docs-theme'

  // ── Theme ─────────────────────────────────────────────────
  document.querySelector('.theme-toggle')?.addEventListener('click', () => {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark'

    root.dataset.theme = next
    localStorage.setItem(THEME_KEY, next)
  })

  // ── Mobile navigation ─────────────────────────────────────
  const menuToggle = document.querySelector('.menu-toggle')

  const setNav = (open) => {
    document.body.classList.toggle('nav-open', open)
    menuToggle?.setAttribute('aria-expanded', String(open))
    menuToggle?.setAttribute(
      'aria-label',
      open ? 'Close navigation' : 'Open navigation',
    )
  }

  menuToggle?.addEventListener('click', () =>
    setNav(!document.body.classList.contains('nav-open')),
  )
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') {
      setNav(false)
    }
  })

  // ── Search ────────────────────────────────────────────────
  const input = document.getElementById('search')
  const list = document.getElementById('search-results')
  let index = null
  let active = -1

  const loadIndex = async () => {
    if (!index) {
      const response = await fetch('search-index.json')

      index = await response.json()
    }

    return index
  }

  const escape = (value) =>
    value.replace(/[&<>"]/g, (char) => `&#${char.charCodeAt(0)};`)

  const search = (pages, query) => {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean)
    const results = []

    for (const page of pages) {
      for (const heading of [{ id: '', text: page.title }, ...page.headings]) {
        const haystack = heading.text.toLowerCase()
        const titleHit = words.every((word) => haystack.includes(word))
        const bodyHit =
          heading.id === '' &&
          words.every((word) => page.text.toLowerCase().includes(word))

        if (titleHit || bodyHit) {
          results.push({
            href: `${page.slug}.html${heading.id ? `#${heading.id}` : ''}`,
            title: heading.text,
            meta: heading.id ? page.title : page.section,
            score: (titleHit ? 2 : 1) + (heading.id ? 0 : 1),
          })
        }
      }
    }

    return results.sort((a, b) => b.score - a.score).slice(0, 8)
  }

  const render = (results) => {
    active = -1
    list.hidden = results.length === 0
    list.innerHTML = results
      .map(
        (result, position) =>
          `<li><a id="result-${position}" role="option" href="${result.href}">${escape(result.title)}<small>${escape(result.meta)}</small></a></li>`,
      )
      .join('')
  }

  input?.addEventListener('input', async () => {
    const query = input.value.trim()

    render(query.length < 2 ? [] : search(await loadIndex(), query))
  })

  input?.addEventListener('keydown', (event) => {
    const links = [...list.querySelectorAll('a')]

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault()
      active =
        (active + (event.key === 'ArrowDown' ? 1 : -1) + links.length) %
        links.length
      links.forEach((link, position) =>
        link.setAttribute('aria-selected', String(position === active)),
      )
    } else if (event.key === 'Enter' && links.length > 0) {
      event.preventDefault()
      location.href = links[Math.max(active, 0)].href
    } else if (event.key === 'Escape') {
      input.value = ''
      render([])
    }
  })

  document.addEventListener('click', (event) => {
    if (!event.target.closest('.search')) {
      list.hidden = true
    }
  })

  // ── Table of contents highlight ───────────────────────────
  const tocLinks = [...document.querySelectorAll('.toc a')]

  if (tocLinks.length > 0 && 'IntersectionObserver' in window) {
    const byId = new Map(
      tocLinks.map((link) => [link.getAttribute('href').slice(1), link]),
    )
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            tocLinks.forEach((link) => link.classList.remove('active'))
            byId.get(entry.target.id)?.classList.add('active')
          }
        }
      },
      { rootMargin: '0px 0px -70% 0px' },
    )

    byId.forEach((_, id) => {
      const heading = document.getElementById(id)

      if (heading) {
        observer.observe(heading)
      }
    })
  }
})()
