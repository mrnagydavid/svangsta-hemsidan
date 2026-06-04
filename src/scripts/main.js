let isBackButtonSetUp = false
setupBackButton()

function setupBackButton() {
  if (isBackButtonSetUp) return

  const backButton = document.querySelector('.back-button')
  if (!backButton) return

  backButton.addEventListener('click', (event) => {
    event.preventDefault()

    const referrer = document.referrer
    const currentHost = window.location.host
    console.log('referrer:', referrer, 'host:', currentHost)

    // Check if referrer is from the same site
    if (referrer) {
      try {
        const referrerUrl = new URL(referrer)

        if (referrerUrl.host === currentHost) {
          history.back()
          return
        }
      } catch (e) {
        // Invalid URL, fall through to default
      }
    }

    // Default: go to index.html
    window.location.href = './index.html'
  })

  isBackButtonSetUp = true
}

let isMapSetUp = false
setupMap()

// Menu markup for sub-pages. index.html keeps its own copy inline (static, for
// SEO); the two are intentionally not identical — this one adds a "Hem" link.
const MENU_HTML = `
  <div id="menu" aria-hidden="false">
    <button
      class="hamburger-btn"
      aria-label="Meny"
      aria-expanded="false"
      aria-controls="menu-drawer"
    >
      &#x11054;
    </button>
  </div>

  <nav id="menu-drawer" class="menu-nav">
    <div class="menu-header">
      <button
        class="close-btn"
        aria-label="Stäng meny"
        aria-expanded="false"
        aria-controls="menu-drawer"
      >
        &#x2715;
      </button>
      <div class="menu-header-text">
        <a href="index.html" class="menu-logo">Svängsta</a>
        <span class="menu-tagline">där historia och framtid möts</span>
      </div>
    </div>

    <ul>
      <li><a href="index.html">🏠 Hem</a></li>
      <li><a href="aktivitetspark.html">🎢 Aktivitetsparken Full Rulle 🏗️</a></li>
      <li><a href="evenemang.html">🗓️ Evenemang</a></li>
      <li><a href="gula-sidorna.html">🏪 Företag & Service</a></li>
      <li><a href="foreningar.html">🤝 Föreningsliv & Gemenskap</a></li>
      <li><a href="portratt.html">👋 Möt Svängsta</a></li>
    </ul>
  </nav>
`

// Sub-pages ship no inline menu — inject it here. index.html already has one,
// so the early return leaves its static markup untouched.
function injectMenu() {
  if (document.getElementById('menu')) return
  document.body.insertAdjacentHTML('beforeend', MENU_HTML)
}
injectMenu()

let isHamburgerMenuSetUp = false
setupHamburgerMenu()

// Floating "back to top" button — injected on every page; it only reveals
// itself on long pages once the user has scrolled past halfway (see thresholds
// in setupScrollToTop). Tapping it returns to the top, where the menu and back
// button live.
const SCROLL_TOP_HTML = `
  <button
    id="scroll-top"
    class="scroll-top-fab"
    type="button"
    aria-label="Till toppen"
  >
    <svg
      viewBox="0 0 24 24"
      width="33"
      height="33"
      fill="none"
      stroke="currentColor"
      stroke-width="2.5"
      stroke-linecap="round"
      stroke-linejoin="round"
      aria-hidden="true"
    >
      <path d="M12 19V5" />
      <path d="M5 12l7-7 7 7" />
    </svg>
  </button>
`

let isScrollToTopSetUp = false
setupScrollToTop()

function setupMap() {
  if (isMapSetUp) return
  if (!document.getElementById('map')) return

  const map = L.map('map', {
    dragging: false,
    tap: false,
    scrollWheelZoom: false,
    doubleClickZoom: false,
    boxZoom: false,
    keyboard: false,
    zoomControl: false,
    attributionControl: true,
  }).setView([56.2508, 14.7847], 10)

  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; OpenStreetMap contributors',
  }).addTo(map)

  L.marker([56.2508, 14.7847]).addTo(map).bindPopup('Svängsta').openPopup()

  let interactionEnabled = false

  map.on('click', () => {
    if (!interactionEnabled) {
      map.dragging.enable()
      map.tap?.enable()
      map.scrollWheelZoom.enable()
      map.doubleClickZoom.enable()
      map.boxZoom.enable()
      map.keyboard.enable()
      map.zoomControl.enable()
      interactionEnabled = true
    }
  })

  isMapSetUp = true
}

function setupHamburgerMenu() {
  if (isHamburgerMenuSetUp) return

  const menuDiv = document.getElementById('menu')
  if (!menuDiv) return

  let isOpen = false
  const menuDrawerDiv = document.getElementById('menu-drawer')
  const menuBtn = menuDiv.getElementsByClassName('hamburger-btn')[0]
  const closeMenuBtn = menuDrawerDiv.getElementsByClassName('close-btn')[0]

  menuBtn.addEventListener('click', (event) => {
    if (isOpen) return

    event.stopPropagation()
    openMenu()
  })

  closeMenuBtn.addEventListener('click', (event) => {
    if (!isOpen) return

    event.stopPropagation()
    closeMenu()
  })

  document.addEventListener('click', (event) => {
    if (!isOpen) return

    const { target } = event

    if (menuDiv.contains(target) || menuDrawerDiv.contains(target)) {
      return
    }

    closeMenu()
  })

  isHamburgerMenuSetUp = true

  function openMenu() {
    menuDrawerDiv.classList.add('open')
    menuDiv.classList.add('hide')
    isOpen = true
  }

  function closeMenu() {
    menuDrawerDiv.classList.remove('open')
    menuDiv.classList.remove('hide')
    isOpen = false
  }
}

function setupScrollToTop() {
  if (isScrollToTopSetUp) return

  document.body.insertAdjacentHTML('beforeend', SCROLL_TOP_HTML)
  const fab = document.getElementById('scroll-top')
  if (!fab) return

  // Show only on long pages (taller than MIN_SCREENS viewports) and only once
  // the user has scrolled past SHOW_AFTER_SCREENS viewports. These are absolute
  // screen counts, NOT a fraction of the page — so on a very long page (e.g. the
  // mobile events list) the button still appears after a couple of screens
  // rather than only at the halfway mark. Tweak these to taste.
  const MIN_SCREENS = 3 // page must be taller than ~3 screens
  const SHOW_AFTER_SCREENS = 2 // ...and you've scrolled past ~2 screens

  // Read scroll position/size from whichever element actually scrolls — the
  // window on most pages, but <body> on svangsta-dagen-2025 (overflow: scroll).
  function getScrollMetrics() {
    const doc = document.documentElement
    const { body } = document
    const scrollTop = Math.max(
      window.scrollY || 0,
      doc.scrollTop || 0,
      body.scrollTop || 0,
    )
    const clientHeight = window.innerHeight || doc.clientHeight
    const scrollHeight = Math.max(doc.scrollHeight, body.scrollHeight)
    return { scrollTop, clientHeight, scrollHeight }
  }

  function update() {
    const { scrollTop, clientHeight, scrollHeight } = getScrollMetrics()
    const isBig = scrollHeight > clientHeight * MIN_SCREENS
    const scrolledEnough = scrollTop > clientHeight * SHOW_AFTER_SCREENS
    fab.classList.toggle('visible', isBig && scrolledEnough)
  }

  let ticking = false
  function onScroll() {
    if (ticking) return
    ticking = true
    requestAnimationFrame(() => {
      update()
      ticking = false
    })
  }

  fab.addEventListener('click', () => {
    window.scrollTo({ top: 0, behavior: 'smooth' })
    // For pages where <body> is the scroll container, not the window
    document.body.scrollTo?.({ top: 0, behavior: 'smooth' })
  })

  // capture: true so we also catch scroll events fired on <body> (they don't
  // bubble, but the capture phase still reaches the window).
  window.addEventListener('scroll', onScroll, { passive: true, capture: true })
  window.addEventListener('resize', onScroll, { passive: true })

  update() // set initial state (e.g. if the page loads already scrolled)

  isScrollToTopSetUp = true
}
