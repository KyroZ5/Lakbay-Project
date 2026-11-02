import React, { useState, useEffect } from 'react';
import { externalApi } from '../../api/externalApi';
import { ChevronLeft, ChevronRight, Calendar as CalendarIcon, Users, CloudSun } from 'lucide-react';
import { Badge } from '../ui/badge';
import { formatDate } from '../../lib/utils';

export const WeatherCalendar = ({
  departures = [],
  destinationCoordinates,
  selectedDepartureId,
  onSelectDeparture,
}) => {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [forecasts, setForecasts] = useState({});
  const [currentWeather, setCurrentWeather] = useState(null);

  // Fetch destination forecast and current weather
  useEffect(() => {
    if (destinationCoordinates?.lat && destinationCoordinates?.lng) {
      externalApi
        .getForecast(destinationCoordinates.lat, destinationCoordinates.lng)
        .then((res) => {
          const list = res.data || [];
          const map = {};
          list.forEach((f) => {
            map[f.date] = f;
          });
          setForecasts(map);
        })
        .catch((err) => console.warn('Weather forecast load error:', err));

      externalApi
        .getWeather(destinationCoordinates.lat, destinationCoordinates.lng)
        .then((res) => {
          setCurrentWeather(res.data);
        })
        .catch((err) => console.warn('Current weather load error:', err));
    }
  }, [destinationCoordinates?.lat, destinationCoordinates?.lng]);

  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  // First day of current month
  const firstDay = new Date(year, month, 1).getDay();
  // Number of days in month
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const handlePrevMonth = () => {
    setCurrentMonth(new Date(year, month - 1, 1));
  };

  const handleNextMonth = () => {
    setCurrentMonth(new Date(year, month + 1, 1));
  };

  // Map departures by departureDate string (YYYY-MM-DD)
  const departuresByDate = {};
  departures.forEach((dep) => {
    if (dep.status === 'open' && dep.departureDate) {
      departuresByDate[dep.departureDate] = dep;
    }
  });

  const monthName = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  const weekDays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      {/* Calendar Header with Current Weather badge */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-5 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <CalendarIcon className="h-5 w-5 text-emerald-600" />
          <h3 className="font-bold text-slate-900 text-lg">{monthName}</h3>
        </div>

        {currentWeather && (
          <div className="flex items-center gap-2 rounded-full bg-emerald-50 px-3 py-1 border border-emerald-100 text-xs font-semibold text-emerald-800">
            <CloudSun className="h-4 w-4 text-emerald-600" />
            <span>Destination Live Weather: {currentWeather.temp}°C, {currentWeather.condition}</span>
          </div>
        )}

        <div className="flex items-center gap-1">
          <button
            onClick={handlePrevMonth}
            className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Previous month"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <button
            onClick={handleNextMonth}
            className="rounded-lg p-1.5 text-slate-600 hover:bg-slate-100 transition-colors cursor-pointer"
            aria-label="Next month"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>
      </div>

      {/* Days of week header */}
      <div className="grid grid-cols-7 gap-2 pt-4 pb-2 text-center text-xs font-bold uppercase tracking-wider text-slate-400">
        {weekDays.map((d) => (
          <div key={d}>{d}</div>
        ))}
      </div>

      {/* Calendar Grid */}
      <div className="grid grid-cols-7 gap-2">
        {/* Leading empty cells */}
        {Array.from({ length: firstDay }).map((_, idx) => (
          <div key={`empty-${idx}`} className="h-24 rounded-lg bg-slate-50/50" />
        ))}

        {/* Days of current month */}
        {Array.from({ length: daysInMonth }).map((_, dayIdx) => {
          const dayNumber = dayIdx + 1;
          const monthStr = String(month + 1).padStart(2, '0');
          const dayStr = String(dayNumber).padStart(2, '0');
          const dateKey = `${year}-${monthStr}-${dayStr}`;

          const departure = departuresByDate[dateKey];
          const forecast = forecasts[dateKey];
          const isSelected = departure && departure.id === selectedDepartureId;
          const hasRemainingSlots = departure && departure.remainingSlots > 0;
          const isDeadlinePassed = departure && Boolean(departure.isDeadlinePassed);

          return (
            <div
              key={dateKey}
              onClick={() => {
                if (departure && onSelectDeparture) {
                  onSelectDeparture(departure);
                }
              }}
              className={`min-h-[100px] rounded-xl p-2 flex flex-col justify-between transition-all border ${
                isSelected
                  ? 'border-emerald-600 bg-emerald-50/80 shadow-md ring-2 ring-emerald-500/20'
                  : isDeadlinePassed
                  ? 'border-red-200 bg-red-50/20 hover:border-red-400 cursor-pointer'
                  : departure && hasRemainingSlots
                  ? 'border-emerald-200 bg-emerald-50/20 hover:border-emerald-400 hover:bg-emerald-50/50 cursor-pointer'
                  : 'border-slate-100 bg-white text-slate-400'
              }`}
            >
              {/* Day Number and Weather icon */}
              <div className="flex items-center justify-between">
                <span
                  className={`text-xs font-bold ${
                    isSelected
                      ? 'text-emerald-700'
                      : isDeadlinePassed
                      ? 'text-red-700'
                      : departure
                      ? 'text-slate-900'
                      : 'text-slate-400'
                  }`}
                >
                  {dayNumber}
                </span>

                {/* Weather forecast badge if available for this date */}
                {forecast && (
                  <div
                    className="flex items-center text-[10px] text-slate-600 font-semibold"
                    title={`${forecast.condition}: ${forecast.temp}°C`}
                  >
                    <img src={forecast.iconUrl} alt={forecast.condition} className="w-5 h-5 -my-1" />
                    <span>{Math.round(forecast.temp)}°</span>
                  </div>
                )}
              </div>

              {/* Departure slot badge */}
              {departure ? (
                <div className="mt-1">
                  {isDeadlinePassed ? (
                    <span className="rounded bg-red-100 text-red-700 border border-red-200 px-1 py-0.5 text-[9px] font-bold text-center block">
                      Cutoff Passed
                    </span>
                  ) : hasRemainingSlots ? (
                    <div className="flex flex-col gap-1">
                      <span className="rounded bg-emerald-600 px-1.5 py-0.5 text-[10px] font-bold text-white text-center leading-tight">
                        {departure.remainingSlots} slots
                      </span>
                      <span className="text-[9px] text-emerald-800 font-medium text-center hidden sm:block">
                        Depart
                      </span>
                    </div>
                  ) : (
                    <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-600 text-center block">
                      Full
                    </span>
                  )}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {/* Legend & Instructions */}
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4 pt-4 border-t border-slate-100 text-xs text-slate-500">
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-emerald-600" />
            <span>Open Departure</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-red-400" />
            <span>Cutoff Passed</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="h-3 w-3 rounded-full bg-slate-200" />
            <span>Sold Out / Full</span>
          </div>
        </div>
        <p className="text-[11px] text-slate-400 italic">
          *Select an open date to lock in your departure schedule below.
        </p>
      </div>
    </div>
  );
};
