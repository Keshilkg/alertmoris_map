<script>
// Main application state
let hazardZones = [];
let currentZone = null;
let isDrawing = false;
let map = null;
let drawnCircle = null;
let circleCenter = null;

// Initialize the application
function init() {
    initializeMap();
    setupEventListeners();
    loadFromLocalStorage();
    renderZonesList();
}

// Initialize Leaflet map
function initializeMap() {
    // Center on Mauritius
    map = L.map('adminMap').setView([-20.3484, 57.5522], 10);

    // Add OpenStreetMap tiles
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors'
    }).addTo(map);

    // Map click handler for placing zones
    map.on('click', function(e) {
        if (isDrawing) {
            placeZoneCenter(e.latlng);
        }
    });

    // Mouse wheel to adjust radius while drawing
    map.on('wheel', function(e) {
        if (isDrawing && drawnCircle) {
            adjustRadiusWithWheel(e);
        }
    });
}

// Set up all event listeners
function setupEventListeners() {
    // Drawing controls
    document.getElementById('startDrawing').addEventListener('click', startDrawing);
    document.getElementById('saveZone').addEventListener('click', saveZone);
    document.getElementById('cancelDrawing').addEventListener('click', cancelDrawing);

    // Radius slider
    const radiusSlider = document.getElementById('zoneRadius');
    const radiusValue = document.getElementById('radiusValue');
    radiusSlider.addEventListener('input', function() {
        radiusValue.textContent = this.value + ' meters';
        if (drawnCircle) {
            drawnCircle.setRadius(parseInt(this.value));
        }
    });

    // Color options
    document.querySelectorAll('.color-option').forEach(option => {
        option.addEventListener('click', function() {
            document.querySelectorAll('.color-option').forEach(opt => opt.classList.remove('selected'));
            this.classList.add('selected');
            if (drawnCircle) {
                updateCircleStyle();
            }
        });
    });

    // Data management
    document.getElementById('exportJson').addEventListener('click', exportToJson);
    document.getElementById('importJson').addEventListener('click', triggerFileInput);
    document.getElementById('fileInput').addEventListener('change', importFromJson);
    document.getElementById('clearAll').addEventListener('click', clearAllZones);
}

// Start drawing mode
function startDrawing() {
    isDrawing = true;
    document.getElementById('startDrawing').disabled = true;
    document.getElementById('saveZone').disabled = false;
    document.getElementById('cancelDrawing').disabled = false;
    document.getElementById('drawingInstructions').style.display = 'block';
    
    // Change cursor to crosshair
    map.getContainer().style.cursor = 'crosshair';
}

// Place zone center on map
function placeZoneCenter(latlng) {
    circleCenter = latlng;
    
    // Remove existing circle if any
    if (drawnCircle) {
        map.removeLayer(drawnCircle);
    }
    
    // Create new circle
    const radius = parseInt(document.getElementById('zoneRadius').value);
    const color = getSelectedColor();
    
    drawnCircle = L.circle(latlng, {
        color: color,
        fillColor: color,
        fillOpacity: 0.3,
        radius: radius
    }).addTo(map);
    
    // Add popup with basic info
    drawnCircle.bindPopup('New Hazard Zone<br>Click and drag to move').openPopup();
    
    // Make circle draggable
    drawnCircle.dragging.enable();
}

// Adjust radius with mouse wheel
function adjustRadiusWithWheel(e) {
    e.originalEvent.preventDefault();
    const delta = e.originalEvent.deltaY > 0 ? -500 : 500;
    const newRadius = Math.max(500, drawnCircle.getRadius() + delta);
    
    drawnCircle.setRadius(newRadius);
    document.getElementById('zoneRadius').value = newRadius;
    document.getElementById('radiusValue').textContent = newRadius + ' meters';
}

// Update circle visual style
function updateCircleStyle() {
    if (drawnCircle) {
        const color = getSelectedColor();
        drawnCircle.setStyle({
            color: color,
            fillColor: color
        });
    }
}

// Get selected color from severity
function getSelectedColor() {
    const selected = document.querySelector('.color-option.selected');
    return selected.getAttribute('data-color');
}

// Get selected severity
function getSelectedSeverity() {
    const selected = document.querySelector('.color-option.selected');
    return selected.getAttribute('data-severity');
}

// Save the current zone
function saveZone() {
    if (!drawnCircle || !circleCenter) {
        alert('Please place a zone on the map first!');
        return;
    }

    const zoneName = document.getElementById('zoneName').value.trim();
    if (!zoneName) {
        alert('Please enter a zone name!');
        return;
    }

    const zone = {
        id: 'zone_' + Date.now(),
        name: zoneName,
        type: document.getElementById('hazardType').value,
        severity: getSelectedSeverity(),
        color: getSelectedColor(),
        center: {
            lat: circleCenter.lat,
            lng: circleCenter.lng
        },
        radius: drawnCircle.getRadius(),
        description: document.getElementById('zoneDescription').value,
        createdAt: new Date().toISOString()
    };

    hazardZones.push(zone);
    saveToLocalStorage();
    renderZonesList();
    resetDrawing();
    
    alert('Hazard zone saved successfully!');
}

// Cancel drawing mode
function cancelDrawing() {
    resetDrawing();
}

// Reset drawing state
function resetDrawing() {
    isDrawing = false;
    circleCenter = null;
    
    if (drawnCircle) {
        map.removeLayer(drawnCircle);
        drawnCircle = null;
    }
    
    document.getElementById('startDrawing').disabled = false;
    document.getElementById('saveZone').disabled = true;
    document.getElementById('cancelDrawing').disabled = true;
    document.getElementById('drawingInstructions').style.display = 'none';
    
    // Reset cursor
    map.getContainer().style.cursor = '';
    
    // Clear form
    document.getElementById('zoneName').value = '';
    document.getElementById('zoneDescription').value = '';
}

// Render zones list in sidebar
function renderZonesList() {
    const container = document.getElementById('zonesContainer');
    container.innerHTML = '';

    if (hazardZones.length === 0) {
        container.innerHTML = '<p style="text-align: center; color: #7f8c8d; padding: 20px;">No hazard zones added yet</p>';
        return;
    }

    hazardZones.forEach(zone => {
        const zoneElement = document.createElement('div');
        zoneElement.className = `zone-item ${zone.severity}`;
        zoneElement.innerHTML = `
            <div class="zone-name">${zone.name}</div>
            <div class="zone-details">
                ${zone.type} • ${zone.severity} severity<br>
                Radius: ${zone.radius}m
            </div>
            <div class="zone-actions">
                <button onclick="viewZoneOnMap('${zone.id}')" style="background: #3498db; color: white;">View</button>
                <button onclick="editZone('${zone.id}')" style="background: #f39c12; color: white;">Edit</button>
                <button onclick="deleteZone('${zone.id}')" style="background: #e74c3c; color: white;">Delete</button>
            </div>
        `;
        container.appendChild(zoneElement);
    });
}

// View zone on map
function viewZoneOnMap(zoneId) {
    const zone = hazardZones.find(z => z.id === zoneId);
    if (zone) {
        map.setView([zone.center.lat, zone.center.lng], 12);
    }
}

// Edit zone
function editZone(zoneId) {
    const zone = hazardZones.find(z => z.id === zoneId);
    if (zone) {
        // Populate form with zone data
        document.getElementById('zoneName').value = zone.name;
        document.getElementById('hazardType').value = zone.type;
        document.getElementById('zoneDescription').value = zone.description;
        document.getElementById('zoneRadius').value = zone.radius;
        document.getElementById('radiusValue').textContent = zone.radius + ' meters';
        
        // Select correct color
        document.querySelectorAll('.color-option').forEach(opt => {
            opt.classList.remove('selected');
            if (opt.getAttribute('data-severity') === zone.severity) {
                opt.classList.add('selected');
            }
        });
        
        // Remove zone from list
        hazardZones = hazardZones.filter(z => z.id !== zoneId);
        renderZonesList();
        
        // Start drawing mode with existing circle
        startDrawing();
        placeZoneCenter(L.latLng(zone.center.lat, zone.center.lng));
    }
}

// Delete zone
function deleteZone(zoneId) {
    if (confirm('Are you sure you want to delete this hazard zone?')) {
        hazardZones = hazardZones.filter(z => z.id !== zoneId);
        saveToLocalStorage();
        renderZonesList();
    }
}

// Export to JSON
function exportToJson() {
    const data = {
        lastUpdated: new Date().toISOString(),
        hazardZones: hazardZones
    };
    
    const dataStr = JSON.stringify(data, null, 2);
    const dataBlob = new Blob([dataStr], {type: 'application/json'});
    
    const link = document.createElement('a');
    link.href = URL.createObjectURL(dataBlob);
    link.download = 'hazard-zones.json';
    link.click();
}

// Trigger file input for import
function triggerFileInput() {
    document.getElementById('fileInput').click();
}

// Import from JSON file
function importFromJson(event) {
    const file = event.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const data = JSON.parse(e.target.result);
            if (data.hazardZones && Array.isArray(data.hazardZones)) {
                hazardZones = data.hazardZones;
                saveToLocalStorage();
                renderZonesList();
                alert(`Successfully imported ${hazardZones.length} hazard zones!`);
            } else {
                alert('Invalid JSON format: missing hazardZones array');
            }
        } catch (error) {
            alert('Error parsing JSON file: ' + error.message);
        }
    };
    reader.readAsText(file);
    
    // Reset file input
    event.target.value = '';
}

// Clear all zones
function clearAllZones() {
    if (confirm('Are you sure you want to delete ALL hazard zones? This cannot be undone.')) {
        hazardZones = [];
        saveToLocalStorage();
        renderZonesList();
    }
}

// Local storage functions
function saveToLocalStorage() {
    localStorage.setItem('hazardZones', JSON.stringify(hazardZones));
}

function loadFromLocalStorage() {
    const stored = localStorage.getItem('hazardZones');
    if (stored) {
        hazardZones = JSON.parse(stored);
    }
}

// Initialize the app when page loads
document.addEventListener('DOMContentLoaded', init);
</script>
