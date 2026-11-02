import React from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline } from 'react-leaflet';
import L from 'leaflet';

// Create numbered marker icon for itinerary sequence
const createNumberedIcon = (number, color = '#059669') => {
  return L.divIcon({
    className: 'custom-itinerary-marker',
    html: `
      <div style="background-color: ${color}; color: white; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: bold; font-size: 13px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.25); border: 2.5px solid white;">
        ${number}
      </div>
    `,
    iconSize: [30, 30],
    iconAnchor: [15, 15],
    popupAnchor: [0, -15],
  });
};

export const ItineraryMap = ({ itinerary = [], height = '450px', className = '' }) => {
  // Extract all activity stops with valid coordinates
  const stops = [];
  let stopNumber = 1;

  itinerary.forEach((day) => {
    (day.activities || []).forEach((act) => {
      if (act.coordinates?.lat && act.coordinates?.lng) {
        stops.push({
          stopNumber,
          dayTitle: day.dayTitle,
          dayNumber: day.dayNumber,
          timeSlot: act.timeSlot,
          activityName: act.activityName,
          locationName: act.locationName,
          description: act.description,
          lat: Number(act.coordinates.lat),
          lng: Number(act.coordinates.lng),
        });
        stopNumber++;
      }
    });
  });

  const centerLat = stops.length > 0 ? stops[0].lat : 11.1956;
  const centerLng = stops.length > 0 ? stops[0].lng : 119.4075;
  const polylineCoords = stops.map((s) => [s.lat, s.lng]);

  return (
    <div className={`overflow-hidden rounded-xl border border-slate-200 shadow-sm relative z-10 ${className}`} style={{ height }}>
      <MapContainer
        center={[centerLat, centerLng]}
        zoom={stops.length > 1 ? 11 : 13}
        scrollWheelZoom={false}
        style={{ height: '100%', width: '100%' }}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {/* Route Polyline connecting activities */}
        {polylineCoords.length > 1 && (
          <Polyline
            positions={polylineCoords}
            color="#059669"
            weight={3.5}
            opacity={0.8}
            dashArray="6, 8"
          />
        )}

        {/* Numbered Activity Markers */}
        {stops.map((stop) => (
          <Marker
            key={`stop-${stop.stopNumber}-${stop.lat}-${stop.lng}`}
            position={[stop.lat, stop.lng]}
            icon={createNumberedIcon(stop.stopNumber)}
          >
            <Popup>
              <div className="p-1 max-w-[220px]">
                <div className="flex items-center gap-1.5 mb-1">
                  <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-bold text-emerald-800 uppercase">
                    Stop #{stop.stopNumber}
                  </span>
                  <span className="text-[11px] text-slate-500 font-medium">{stop.timeSlot}</span>
                </div>
                <h4 className="font-bold text-slate-900 text-sm">{stop.activityName}</h4>
                <p className="text-xs text-emerald-700 font-medium">{stop.locationName}</p>
                {stop.description && (
                  <p className="text-xs text-slate-600 mt-1 line-clamp-3">{stop.description}</p>
                )}
              </div>
            </Popup>
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
};
