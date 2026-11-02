import React, { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { MapPin } from 'lucide-react';

// Custom Emerald Marker Icon
const createCustomIcon = (name) => {
  return L.divIcon({
    className: 'custom-leaflet-marker',
    html: `
      <div style="background-color: #059669; color: white; width: 36px; height: 36px; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.2), 0 2px 4px -2px rgba(0,0,0,0.2); border: 2.5px solid white; cursor: pointer;">
        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
      </div>
    `,
    iconSize: [36, 36],
    iconAnchor: [18, 36],
    popupAnchor: [0, -36],
  });
};

export const DestinationMap = ({
  coordinates = { lat: 11.1956, lng: 119.4075 },
  destinationName = 'Destination',
  locationName = 'Philippines',
  height = '400px',
  className = '',
}) => {
  const lat = coordinates?.lat || 11.1956;
  const lng = coordinates?.lng || 119.4075;

  return (
    <div className={`overflow-hidden rounded-xl border border-slate-200 shadow-sm relative z-10 ${className}`} style={{ height }}>
      <MapContainer
        center={[lat, lng]}
        zoom={11}
        scrollWheelZoom={false}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Marker position={[lat, lng]} icon={createCustomIcon(destinationName)}>
          <Popup>
            <div className="p-1">
              <h4 className="font-bold text-slate-900 text-sm">{destinationName}</h4>
              <p className="text-xs text-slate-600 mt-0.5">{locationName}</p>
            </div>
          </Popup>
        </Marker>
      </MapContainer>
    </div>
  );
};
