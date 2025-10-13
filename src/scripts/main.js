setupMap()

function setupMap() {
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
}
