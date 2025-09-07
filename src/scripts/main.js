const map = L.map('map', {
  scrollWheelZoom: false,
}).setView([56.2508, 14.7847], 10)

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap contributors',
}).addTo(map)

L.marker([56.2508, 14.7847]).addTo(map).bindPopup('Svängsta').openPopup()

// Enable scroll zoom only after user clicks the map
map.on('click', function () {
  map.scrollWheelZoom.enable()
})
