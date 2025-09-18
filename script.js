let map;
let directionsService;
let directionsRenderer;
let geocoder;
let appointments = [];
let homeLocation = "298 Milkwood Lane, Kidd's Beach, Eastern Cape, South Africa";
let currentLocation = null;
let locationStatus = 'unknown';
let optimizedRoute = null;
let autocomplete = null;
let selectedPlace = null;

function initMap() {
    const southAfrica = { lat: -28.8, lng: 24.8 };

    map = new google.maps.Map(document.getElementById('map'), {
        zoom: 5,
        center: southAfrica,
        mapTypeId: google.maps.MapTypeId.ROADMAP
    });

    directionsService = new google.maps.DirectionsService();
    directionsRenderer = new google.maps.DirectionsRenderer({
        draggable: false,
        suppressMarkers: false
    });
    directionsRenderer.setMap(map);

    geocoder = new google.maps.Geocoder();

    setupAutocomplete();
    getCurrentLocation();
    loadAppointments();
    updateAppointmentList();

    document.getElementById('address-input').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            addAppointment();
        }
    });
}

function setupAutocomplete() {
    const addressInput = document.getElementById('address-input');

    autocomplete = new google.maps.places.Autocomplete(addressInput, {
        componentRestrictions: { country: 'za' },
        fields: ['formatted_address', 'geometry', 'name'],
        types: ['establishment', 'geocode']
    });

    autocomplete.addListener('place_changed', () => {
        selectedPlace = autocomplete.getPlace();
        if (!selectedPlace.geometry) {
            selectedPlace = null;
        }
    });
}

function addAppointment() {
    const addressInput = document.getElementById('address-input');
    const address = addressInput.value.trim();

    if (!address) {
        alert('Please enter an address');
        return;
    }

    if (selectedPlace && selectedPlace.geometry) {
        const appointment = {
            id: Date.now(),
            address: selectedPlace.formatted_address,
            lat: selectedPlace.geometry.location.lat(),
            lng: selectedPlace.geometry.location.lng()
        };

        appointments.push(appointment);
        addressInput.value = '';
        selectedPlace = null;
        updateAppointmentList();
        saveAppointments();

        if (appointments.length === 1) {
            showSingleAppointment(appointment);
        }
    } else {
        geocoder.geocode({ address: address }, (results, status) => {
            if (status === 'OK') {
                const location = results[0];
                const appointment = {
                    id: Date.now(),
                    address: location.formatted_address,
                    lat: location.geometry.location.lat(),
                    lng: location.geometry.location.lng()
                };

                appointments.push(appointment);
                addressInput.value = '';
                selectedPlace = null;
                updateAppointmentList();
                saveAppointments();

                if (appointments.length === 1) {
                    showSingleAppointment(appointment);
                }
            } else {
                alert('Could not find this address. Please check the address and try again.');
            }
        });
    }
}

function deleteAppointment(id) {
    appointments = appointments.filter(apt => apt.id !== id);
    updateAppointmentList();
    saveAppointments();
    
    if (appointments.length === 0) {
        directionsRenderer.setDirections({ routes: [] });
    } else if (appointments.length === 1) {
        showSingleAppointment(appointments[0]);
    }
}

function updateAppointmentList() {
    const listElement = document.getElementById('appointment-list');
    const countElement = document.getElementById('appointment-count');
    
    countElement.textContent = appointments.length;
    
    if (appointments.length === 0) {
        listElement.innerHTML = '<p style="color: #666; font-style: italic;">No appointments added yet.</p>';
        document.getElementById('route-summary').style.display = 'none';
        return;
    }
    
    listElement.innerHTML = '';
    
    appointments.forEach((appointment, index) => {
        const item = document.createElement('div');
        item.className = 'appointment-item';
        item.draggable = true;
        const label = index + 1; // 1, 2, 3, 4...
        item.innerHTML = `
            <div class="appointment-address">${label}. ${appointment.address}</div>
            <button class="btn btn-danger btn-small" onclick="deleteAppointment(${appointment.id})">Delete</button>
        `;
        
        item.addEventListener('dragstart', (e) => {
            e.dataTransfer.setData('text/plain', index);
        });
        
        item.addEventListener('dragover', (e) => {
            e.preventDefault();
        });
        
        item.addEventListener('drop', (e) => {
            e.preventDefault();
            const draggedIndex = parseInt(e.dataTransfer.getData('text/plain'));
            const targetIndex = index;
            
            if (draggedIndex !== targetIndex) {
                const draggedItem = appointments.splice(draggedIndex, 1)[0];
                appointments.splice(targetIndex, 0, draggedItem);
                updateAppointmentList();
                saveAppointments();
            }
        });
        
        listElement.appendChild(item);
    });
}

function showSingleAppointment(appointment) {
    const startCoords = getStartLocation();
    const appointmentCoords = new google.maps.LatLng(appointment.lat, appointment.lng);
    
    const request = {
        origin: startCoords,
        destination: appointmentCoords,
        travelMode: google.maps.TravelMode.DRIVING,
        avoidTolls: true,
        optimizeWaypoints: false
    };

    directionsService.route(request, (result, status) => {
        if (status === 'OK') {
            directionsRenderer.setDirections(result);
            
            const route = result.routes[0];
            const leg = route.legs[0];
            
            document.getElementById('total-time').textContent = leg.duration.text;
            document.getElementById('total-distance').textContent = leg.distance.text;
            document.getElementById('route-summary').style.display = 'block';

            optimizedRoute = result;
            document.getElementById('navigation-buttons').style.display = 'block';
        }
    });
}

function getRouteOptions() {
    const routeType = document.getElementById('route-type').value;
    const baseOptions = {
        travelMode: google.maps.TravelMode.DRIVING,
        optimizeWaypoints: true
    };

    switch (routeType) {
        case 'shortest':
            return {
                ...baseOptions,
                avoidTolls: true,
                avoidHighways: false,
                provideRouteAlternatives: true
            };
        case 'fastest':
            return {
                ...baseOptions,
                avoidTolls: false,
                avoidHighways: false,
                provideRouteAlternatives: false
            };
        case 'avoid-traffic':
            return {
                ...baseOptions,
                avoidTolls: true,
                avoidHighways: true,
                provideRouteAlternatives: true
            };
        case 'balanced':
            return {
                ...baseOptions,
                avoidTolls: true,
                avoidHighways: false,
                provideRouteAlternatives: true
            };
        default:
            return {
                ...baseOptions,
                avoidTolls: true,
                avoidHighways: false
            };
    }
}

function optimizeRoute() {
    if (appointments.length === 0) {
        alert('Please add some appointments first');
        return;
    }

    if (appointments.length === 1) {
        showSingleAppointment(appointments[0]);
        return;
    }

    const startCoords = getStartLocation();
    const routeOptions = getRouteOptions();

    const waypoints = appointments.map(apt => ({
        location: new google.maps.LatLng(apt.lat, apt.lng),
        stopover: true
    }));

    const request = {
        origin: startCoords,
        destination: startCoords,
        waypoints: waypoints,
        ...routeOptions
    };

    directionsService.route(request, (result, status) => {
        if (status === 'OK') {
            directionsRenderer.setDirections(result);
            
            const route = result.routes[0];
            let totalDistance = 0;
            let totalDuration = 0;
            
            route.legs.forEach(leg => {
                totalDistance += leg.distance.value;
                totalDuration += leg.duration.value;
            });
            
            const hours = Math.floor(totalDuration / 3600);
            const minutes = Math.floor((totalDuration % 3600) / 60);
            const timeText = hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
            
            const distanceKm = (totalDistance / 1000).toFixed(1);
            
            document.getElementById('total-time').textContent = timeText;
            document.getElementById('total-distance').textContent = `${distanceKm} km`;
            document.getElementById('route-summary').style.display = 'block';

            optimizedRoute = result;
            document.getElementById('navigation-buttons').style.display = 'block';
            
            const optimizedOrder = result.routes[0].waypoint_order;
            const reorderedAppointments = optimizedOrder.map(index => appointments[index]);
            appointments = reorderedAppointments;
            updateAppointmentList();
            saveAppointments();
        } else {
            alert('Could not calculate route. Please try again.');
        }
    });
}

function openInGoogleMaps() {
    if (!optimizedRoute || appointments.length === 0) {
        alert('Please optimize a route first');
        return;
    }

    const startCoords = getStartLocation();
    let url = `https://www.google.com/maps/dir/`;

    if (currentLocation && locationStatus === 'found') {
        url += `${currentLocation.lat},${currentLocation.lng}/`;
    } else {
        url += `${encodeURIComponent(homeLocation)}/`;
    }

    if (appointments.length === 1) {
        url += `${appointments[0].lat},${appointments[0].lng}`;
    } else {
        const waypoints = optimizedRoute.routes[0].waypoint_order.map(index => appointments[index]);
        waypoints.forEach(apt => {
            url += `${apt.lat},${apt.lng}/`;
        });

        if (currentLocation && locationStatus === 'found') {
            url += `${currentLocation.lat},${currentLocation.lng}`;
        } else {
            url += `${encodeURIComponent(homeLocation)}`;
        }
    }

    url += '?travelmode=driving';
    window.open(url, '_blank');
}

function openInWaze() {
    if (!optimizedRoute || appointments.length === 0) {
        alert('Please optimize a route first');
        return;
    }

    if (appointments.length === 1) {
        const appointment = appointments[0];
        const wazeUrl = `https://waze.com/ul?ll=${appointment.lat},${appointment.lng}&navigate=yes`;
        window.open(wazeUrl, '_blank');
        return;
    }

    const startCoords = getStartLocation();
    let currentLat, currentLng;

    if (currentLocation && locationStatus === 'found') {
        currentLat = currentLocation.lat;
        currentLng = currentLocation.lng;
    } else {
        currentLat = -33.2739;
        currentLng = 27.0486;
    }

    const waypoints = optimizedRoute.routes[0].waypoint_order.map(index => appointments[index]);

    if (waypoints.length > 0) {
        const firstDestination = waypoints[0];
        const wazeUrl = `https://waze.com/ul?ll=${firstDestination.lat},${firstDestination.lng}&navigate=yes`;
        window.open(wazeUrl, '_blank');

        if (waypoints.length > 1) {
            setTimeout(() => {
                alert(`After reaching ${firstDestination.address}, you have ${waypoints.length - 1} more stops. Open Waze again for the next destination.`);
            }, 1000);
        }
    }
}

function clearAllAppointments() {
    if (appointments.length === 0) return;

    if (confirm('Are you sure you want to clear all appointments?')) {
        appointments = [];
        optimizedRoute = null;
        updateAppointmentList();
        saveAppointments();
        directionsRenderer.setDirections({ routes: [] });
        document.getElementById('navigation-buttons').style.display = 'none';
        document.getElementById('route-summary').style.display = 'none';
    }
}

function saveAppointments() {
    localStorage.setItem('barklegps_appointments', JSON.stringify(appointments));
}

function loadAppointments() {
    const saved = localStorage.getItem('barklegps_appointments');
    if (saved) {
        appointments = JSON.parse(saved);
    }
}

function getCurrentLocation() {
    updateLocationStatus('getting');
    
    if (!navigator.geolocation) {
        updateLocationStatus('unavailable');
        return;
    }

    const options = {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 300000
    };

    navigator.geolocation.getCurrentPosition(
        (position) => {
            currentLocation = {
                lat: position.coords.latitude,
                lng: position.coords.longitude
            };
            updateLocationStatus('found');
            
            if (map) {
                const userMarker = new google.maps.Marker({
                    position: currentLocation,
                    map: map,
                    title: 'Your Current Location',
                    icon: {
                        url: 'data:image/svg+xml;charset=UTF-8,' + encodeURIComponent(`
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <circle cx="12" cy="12" r="8" fill="#4285F4" stroke="#ffffff" stroke-width="2"/>
                                <circle cx="12" cy="12" r="3" fill="#ffffff"/>
                            </svg>
                        `),
                        scaledSize: new google.maps.Size(24, 24)
                    }
                });
            }
        },
        (error) => {
            console.warn('Location error:', error.message);
            updateLocationStatus('denied');
        },
        options
    );
}

function getStartLocation() {
    if (currentLocation && locationStatus === 'found') {
        return new google.maps.LatLng(currentLocation.lat, currentLocation.lng);
    }
    return new google.maps.LatLng(-33.2739, 27.0486);
}

function updateLocationStatus(status) {
    locationStatus = status;
    const statusElement = document.getElementById('location-status');
    if (!statusElement) return;
    
    const statusTexts = {
        'unknown': '📍 Location: Unknown',
        'getting': '📍 Location: Getting...',
        'found': '📍 Location: Using Current',
        'denied': '📍 Location: Using Default',
        'unavailable': '📍 Location: Using Default'
    };
    
    const statusColors = {
        'unknown': '#666',
        'getting': '#ff9500',
        'found': '#4CAF50',
        'denied': '#666',
        'unavailable': '#666'
    };
    
    statusElement.textContent = statusTexts[status] || statusTexts['unknown'];
    statusElement.style.color = statusColors[status] || statusColors['unknown'];
}

window.onerror = function(msg, url, lineNo, columnNo, error) {
    console.error('Error: ', msg, url, lineNo, columnNo, error);
    return false;
};