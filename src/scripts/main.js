let isMapSetUp = false
setupMap()

let isHamburgerMenuSetUp = false
setupHamburgerMenu()

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
