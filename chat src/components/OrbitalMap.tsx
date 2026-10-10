"use client";

import { useEffect, useRef } from "react";
import {
  Map as MapLibreMap,
  Marker,
  Popup,
  NavigationControl,
} from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

export default function OrbitalMap() {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const map = useRef<MapLibreMap | null>(null);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    const orbitalMap = new MapLibreMap({
      container: mapContainer.current,

      style: {
        version: 8,

        sources: {
          countries: {
            type: "geojson",
            data: "https://raw.githubusercontent.com/datasets/geo-countries/master/data/countries.geojson",
          },
        },

        layers: [
          {
            id: "space-background",
            type: "background",
            paint: {
              "background-color": "#06111a",
            },
          },

          {
            id: "land",
            type: "fill",
            source: "countries",
            paint: {
              "fill-color": "#0c202b",
              "fill-opacity": 1,
            },
          },

          {
            id: "country-borders",
            type: "line",
            source: "countries",
            paint: {
              "line-color": "#31505e",
              "line-width": 0.7,
              "line-opacity": 0.65,
            },
          },
        ],
      },

      center: [-105, 34],
      zoom: 3.3,
      pitch: 15,
      bearing: 0,

      attributionControl: false,
    });

    map.current = orbitalMap;

    orbitalMap.addControl(
      new NavigationControl({
        showCompass: true,
        showZoom: true,
      }),
      "bottom-right"
    );

    orbitalMap.on("load", () => {
      /*
       * DEMO TARGET LOCATIONS
       *
       * These are approximate geographic locations used only
       * for the Deck Tasker prototype.
       */
      const targets = [
        {
          id: "permian",
          name: "Permian Basin",
          team: "Oil & Gas",
          coordinates: [-102.1, 31.9] as [number, number],
          priority: 94,
        },
        {
          id: "san-juan",
          name: "San Juan Basin",
          team: "Science",
          coordinates: [-107.6, 36.7] as [number, number],
          priority: 87,
        },
        {
          id: "denver",
          name: "Denver-Julesburg Basin",
          team: "Impact",
          coordinates: [-104.7, 40.1] as [number, number],
          priority: 82,
        },
        {
          id: "bakersfield",
          name: "Bakersfield",
          team: "Waste",
          coordinates: [-119.0, 35.4] as [number, number],
          priority: 79,
        },
      ];

      /*
       * Add target markers.
       */
      targets.forEach((target) => {
        const marker = document.createElement("button");

        marker.type = "button";
        marker.title = target.name;

        // Target footprint
        marker.style.width = "18px";
        marker.style.height = "18px";
        marker.style.border = "1.5px solid rgba(103,232,249,0.85)";
        marker.style.background = "rgba(34,211,238,0.08)";
        marker.style.transform = "rotate(45deg)";
        marker.style.borderRadius = "2px";
        marker.style.boxShadow = "0 0 10px rgba(34,211,238,0.15)";
        marker.style.cursor = "pointer";

        const popup = new Popup({
          offset: 18,
          closeButton: false,
        }).setHTML(`
          <div style="
            background:#071018;
            color:white;
            padding:12px;
            min-width:170px;
            font-family:Arial,sans-serif;
          ">
            <div style="
              color:#67e8f9;
              font-size:10px;
              letter-spacing:1.5px;
              margin-bottom:6px;
            ">
              COLLECTION TARGET
            </div>

            <strong>${target.name}</strong>

            <div style="
              color:#94a3b8;
              font-size:12px;
              margin-top:6px;
            ">
              ${target.team}
            </div>

            <div style="
              color:#94a3b8;
              font-size:12px;
              margin-top:3px;
            ">
              Priority ${target.priority}
            </div>
          </div>
        `);

        new Marker({
          element: marker,
          anchor: "center",
        })
          .setLngLat(target.coordinates)
          .setPopup(popup)
          .addTo(orbitalMap);
      });

      /*
       * Simulated Tanager positions.
       *
       * These are NOT live orbital coordinates.
       * Later we can replace them with orbital propagation
       * or actual telemetry if appropriate data is available.
       */
     const tanager1Marker = addSatelliteMarker(
       orbitalMap,
       "TANAGER-1",
       [-100.5, 32.7],
       "COLLECTING",
       "Permian Basin"
     );

      addSatelliteMarker(
        orbitalMap,
        "TANAGER-2",
        [-111.0, 38.5],
        "TRANSIT",
        "San Juan Basin"
      );
    /*
     * Simulated Tanager-1 movement.
     *
     * Prototype only — these are not real orbital coordinates.
     */
    const tanager1Route: [number, number][] = [
      [-111, 29],
      [-106, 31],
      [-101, 33],
      [-96, 35],
      [-91, 37],
      [-86, 39],
    ];
let routeIndex = 2;
let segmentStartTime: number | null = null;

// Time to travel one route segment.
const segmentDuration = 12000;

const animateTanager1 = (timestamp: number) => {
  if (segmentStartTime === null) {
    segmentStartTime = timestamp;
  }

  const start = tanager1Route[routeIndex];
  const end = tanager1Route[routeIndex + 1];

  if (!end) {
    routeIndex = 0;
    segmentStartTime = timestamp;
    requestAnimationFrame(animateTanager1);
    return;
  }

  const elapsed = timestamp - segmentStartTime;

  // Always between 0 and 1.
  const progress = Math.min(elapsed / segmentDuration, 1);

  const smoothProgress =
    progress * progress * (3 - 2 * progress);

  const lng =
    start[0] + (end[0] - start[0]) * smoothProgress;

  const lat =
    start[1] + (end[1] - start[1]) * smoothProgress;

  tanager1Marker.setLngLat([lng, lat]);

  if (progress >= 1) {
    routeIndex += 1;
    segmentStartTime = timestamp;
  }

  requestAnimationFrame(animateTanager1);
};

requestAnimationFrame(animateTanager1);
      /*
       * Simulated Tanager-1 ground track.
       */
     /*
      * Tanager-1 ground track.
      *
      * Dim solid line = where the spacecraft has been.
      * Bright dashed line = projected path ahead.
      */
     orbitalMap.addSource("tanager-1-past-track", {
       type: "geojson",
       data: {
         type: "Feature",
         properties: {},
         geometry: {
           type: "LineString",
           coordinates: [
             [-121, 25],
             [-116, 27],
             [-111, 29],
             [-106, 31],
             [-101, 33],
           ],
         },
       },
     });

     orbitalMap.addLayer({
       id: "tanager-1-past-track-line",
       type: "line",
       source: "tanager-1-past-track",
       paint: {
         "line-color": "#67e8f9",
         "line-width": 1.25,
         "line-opacity": 0.18,
       },
     });

     orbitalMap.addSource("tanager-1-future-track", {
       type: "geojson",
       data: {
         type: "Feature",
         properties: {},
         geometry: {
           type: "LineString",
           coordinates: [
             [-101, 33],
             [-96, 35],
             [-91, 37],
             [-86, 39],
           ],
         },
       },
     });

     orbitalMap.addLayer({
       id: "tanager-1-future-track-line",
       type: "line",
       source: "tanager-1-future-track",
       paint: {
         "line-color": "#67e8f9",
         "line-width": 1.5,
         "line-opacity": 0.7,
         "line-dasharray": [2, 3],
       },
     });

      /*
       * Simulated collection footprint.
       */
      orbitalMap.addSource("active-collection", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [-103.4, 30.9],
                [-101.8, 30.9],
                [-101.2, 33.4],
                [-102.8, 33.4],
                [-103.4, 30.9],
              ],
            ],
          },
        },
      });

      /*
       * Tanager-2 upcoming collection footprint.
       * Outline only = scheduled, not currently collecting.
       */
      orbitalMap.addSource("upcoming-collection", {
        type: "geojson",
        data: {
          type: "Feature",
          properties: {},
          geometry: {
            type: "Polygon",
            coordinates: [
              [
                [-108.3, 35.9],
                [-107.3, 35.9],
                [-107.0, 37.4],
                [-108.0, 37.4],
                [-108.3, 35.9],
              ],
            ],
          },
        },
      });

      orbitalMap.addLayer({
        id: "upcoming-collection-fill",
        type: "fill",
        source: "upcoming-collection",
        paint: {
          "fill-color": "#67e8f9",
          "fill-opacity": 0.025,
        },
      });

      orbitalMap.addLayer({
        id: "upcoming-collection-border",
        type: "line",
        source: "upcoming-collection",
        paint: {
          "line-color": "#67e8f9",
          "line-width": 1.5,
          "line-opacity": 0.5,
          "line-dasharray": [3, 2],
        },
      });

      orbitalMap.addLayer({
        id: "active-collection-fill",
        type: "fill",
        source: "active-collection",
        paint: {
          "fill-color": "#22d3ee",
          "fill-opacity": 0.28,
        },
      });

      orbitalMap.addLayer({
        id: "active-collection-border",
        type: "line",
        source: "active-collection",
        paint: {
          "line-color": "#67e8f9",
          "line-width": 2,
          "line-opacity": 0.95,
        },
      });
    });

    return () => {
      orbitalMap.remove();
      map.current = null;
    };
  }, []);

  return (
    <div className="absolute inset-0">
      <div
        ref={mapContainer}
        className="h-full w-full"
        aria-label="Simulated Tanager orbital operations map"
      />

      {/* Prototype notice */}
      <div className="pointer-events-none absolute bottom-14 left-5 rounded-md border border-white/10 bg-[#071018]/80 px-3 py-2 backdrop-blur">
        <p className="text-[10px] tracking-widest text-slate-500">
          SIMULATED ORBITAL DATA
        </p>
      </div>
    </div>
  );
}

function addSatelliteMarker(
  map: MapLibreMap,
  name: string,
  coordinates: [number, number],
  status: string,
  target: string
) {
  const wrapper = document.createElement("button");

  wrapper.type = "button";
  wrapper.title = name;

  wrapper.style.display = "flex";
  wrapper.style.alignItems = "center";
  wrapper.style.gap = "7px";
  wrapper.style.padding = "5px 9px 5px 5px";
  wrapper.style.borderRadius = "8px";
  wrapper.style.border = "1px solid rgba(103,232,249,0.35)";
  wrapper.style.background = "rgba(7,16,24,0.92)";
  wrapper.style.color = "white";
  wrapper.style.cursor = "pointer";
  wrapper.style.boxShadow = "0 0 20px rgba(34,211,238,0.18)";

 const icon = document.createElement("span");
 icon.textContent = "✦";
 icon.style.display = "flex";
 icon.style.alignItems = "center";
 icon.style.justifyContent = "center";
 icon.style.width = "22px";
 icon.style.height = "22px";
 icon.style.borderRadius = "50%";
 icon.style.background = "rgba(34,211,238,0.12)";
 icon.style.border = "1px solid rgba(103,232,249,0.65)";
 icon.style.color = "#67e8f9";
 icon.style.fontSize = "13px";
 icon.style.boxShadow = "0 0 14px rgba(34,211,238,0.45)";

  const label = document.createElement("span");
  label.textContent = name;
  label.style.fontSize = "10px";
  label.style.fontWeight = "700";
  label.style.letterSpacing = "1px";

  wrapper.appendChild(icon);
  wrapper.appendChild(label);

  const popup = new Popup({
    offset: 20,
    closeButton: false,
  }).setHTML(`
    <div style="
      background:#071018;
      color:white;
      padding:14px;
      min-width:190px;
      font-family:Arial,sans-serif;
    ">
      <div style="
        color:#67e8f9;
        font-size:10px;
        letter-spacing:1.5px;
      ">
        ${name}
      </div>

      <div style="
        margin-top:8px;
        font-size:13px;
        font-weight:700;
      ">
        ${status}
      </div>

      <div style="
        margin-top:10px;
        color:#64748b;
        font-size:10px;
      ">
        ${status === "COLLECTING" ? "CURRENT TARGET" : "NEXT TARGET"}
      </div>

      <div style="
        margin-top:3px;
        color:#cbd5e1;
        font-size:12px;
      ">
        ${target}
      </div>
    </div>
  `);

 const satelliteMarker = new Marker({
   element: wrapper,
   anchor: "center",
 })
   .setLngLat(coordinates)
   .setPopup(popup)
   .addTo(map);

 return satelliteMarker;
 }