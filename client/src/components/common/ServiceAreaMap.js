/**
 * ServiceAreaMap
 * Leaflet + OpenStreetMap map showing a freelancer's service area.
 * Renders a circle overlay for travel radius, or a simple pin for a fixed location.
 * Free, no API key — uses OpenStreetMap tiles.
 *
 * Usage:
 *   <ServiceAreaMap lat={37.9} lon={-122.0} radius={25} mode="at_client" address="Concord, CA" />
 */
import React, { useEffect, useRef } from 'react';
import './ServiceAreaMap.css';

// Leaflet must be imported lazily to avoid SSR issues
let L = null;

const MILES_TO_METERS = 1609.34;

const ServiceAreaMap = ({ lat, lon, radius = 25, mode = 'at_client', address = '' }) => {
  const containerRef = useRef(null);
  const mapRef = useRef(null);

  useEffect(() => {
    if (!lat || !lon || !containerRef.current) return;

    let cleanup = () => {};

    import('leaflet').then(leaflet => {
      import('leaflet/dist/leaflet.css').then(() => {
        L = leaflet.default;

        // Fix default marker icons (Webpack asset path issue)
        delete L.Icon.Default.prototype._getIconUrl;
        L.Icon.Default.mergeOptions({
          iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
          iconUrl:       'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
          shadowUrl:     'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
        });

        // Avoid re-initialising if already mounted
        if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; }

        const map = L.map(containerRef.current, { zoomControl: true, scrollWheelZoom: false }).setView([lat, lon], 11);
        mapRef.current = map;

        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>',
          maxZoom: 19,
        }).addTo(map);

        // Pin at centre
        const marker = L.marker([lat, lon]).addTo(map);
        if (address) marker.bindPopup(`<b>${address}</b>`).openPopup();

        // Circle for travel radius (at_client / flexible)
        if ((mode === 'at_client' || mode === 'flexible') && radius > 0) {
          L.circle([lat, lon], {
            radius: radius * MILES_TO_METERS,
            color: '#2563eb',
            fillColor: '#3b82f6',
            fillOpacity: 0.08,
            weight: 2,
          }).addTo(map);

          // Fit map to circle bounds
          const bounds = L.latLng(lat, lon).toBounds(radius * MILES_TO_METERS * 2);
          map.fitBounds(bounds, { padding: [20, 20] });
        }

        cleanup = () => { if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } };
      });
    });

    return () => cleanup();
  }, [lat, lon, radius, mode, address]);

  return (
    <div className="service-area-map-wrap">
      <div className="service-area-map-label">
        {mode === 'at_client' ? `🚗 Travels up to ${radius} miles from ${address || 'their location'}` :
         mode === 'at_freelancer' ? `📍 Fixed location${address ? ` — ${address}` : ''}` :
         `🔄 Flexible service area${radius > 0 ? ` (up to ${radius} miles)` : ''}`}
      </div>
      <div ref={containerRef} className="service-area-map" />
    </div>
  );
};

export default ServiceAreaMap;
