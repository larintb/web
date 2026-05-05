'use client'

import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'

export interface StreetLabel {
  name: string
  coords: [number, number] // [lng, lat] where to pin the label
  rotation?: number        // degrees clockwise from East — 0 = E-W street, 90 = N-S street
}

interface MapboxMapProps {
  address: string
  businessName: string
  coords?: [number, number] // [lng, lat] - if provided, skips geocoding
  streetLabels?: StreetLabel[] // optional: manual street/avenue labels to overlay
  className?: string
}

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ''



async function geocodeAddress(address: string): Promise<[number, number] | null> {
  if (!MAPBOX_TOKEN) return null

  try {
    const query = encodeURIComponent(address)
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${query}.json?access_token=${MAPBOX_TOKEN}&limit=1`
    const res = await fetch(url)
    const data = await res.json()
    const feature = data.features?.[0]
    if (!feature) return null
    return feature.center as [number, number]
  } catch {
    return null
  }
}

export function MapboxMap({ address, businessName, coords: coordsProp, streetLabels, className = '' }: MapboxMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const animationExecutedRef = useRef<string | null>(null)
  const poiMarkersRef = useRef<mapboxgl.Marker[]>([])
  const [isLoaded, setIsLoaded] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const coordsLng = coordsProp?.[0]
  const coordsLat = coordsProp?.[1]
  const coordsKey = coordsLng !== undefined && coordsLat !== undefined ? `${coordsLng},${coordsLat}` : address

  useEffect(() => {
    if (!address?.trim()) {
      setError(null)
      setIsLoaded(false)
      return
    }

    if (!MAPBOX_TOKEN) {
      setError('Token de Mapbox no configurado')
      setIsLoaded(false)
      return
    }

    let cancelled = false
    let droneFrame: number | null = null

    const initMap = async () => {
      const coords: [number, number] | null =
        coordsLng !== undefined && coordsLat !== undefined
          ? [coordsLng, coordsLat]
          : await geocodeAddress(address)

      if (cancelled) return

      if (!coords || !mapContainerRef.current) {
        setError('No se pudo cargar el mapa para esta direccion')
        setIsLoaded(false)
        return
      }

      setError(null)
      setIsLoaded(false)

      if (mapRef.current) {
        mapRef.current.remove()
        mapRef.current = null
      }
      poiMarkersRef.current = []

      mapboxgl.accessToken = MAPBOX_TOKEN
      const isMobile = 'ontouchstart' in window

      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: 'mapbox://styles/mapbox/standard',
        center: coords,
        zoom: 14,
        pitch: 0,
        bearing: 0,
        antialias: !isMobile,
        attributionControl: true,
      })

      map.addControl(new mapboxgl.NavigationControl(), 'top-right')
      map.addControl(new mapboxgl.FullscreenControl())

      const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(`
        <div style="padding:6px 4px; max-width:180px;">
          <strong style="font-size:14px;">${businessName}</strong>
          <p style="margin:4px 0 8px; font-size:12px; color:#555;">${address}</p>
          <a
            href="https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}"
            target="_blank"
            rel="noopener noreferrer"
            style="font-size:12px; color:#1976d2; text-decoration:underline;"
          >Como llegar</a>
        </div>
      `)

      const markerEl = document.createElement('div')
      markerEl.style.cssText = 'width:22px;height:22px;'

      const dotEl = document.createElement('div')
      dotEl.style.cssText = [
        'width:22px',
        'height:22px',
        'background:#6366F1',
        'border:3px solid #fff',
        'border-radius:50%',
        'box-shadow:0 2px 14px rgba(99,102,241,0.55)',
        'cursor:pointer',
        'opacity:1',
        'transform:scale(1)',
      ].join(';')
      markerEl.appendChild(dotEl)

      const marker = new mapboxgl.Marker({ element: markerEl, anchor: 'center' })
        .setLngLat(coords)
        .setPopup(popup)

      map.on('load', () => {
        if (cancelled) return

        map.setConfigProperty('basemap', 'lightPreset', 'dusk')
        map.setConfigProperty('basemap', 'showPointOfInterestLabels', true)
        map.setConfigProperty('basemap', 'showRoadLabels', true)

        setIsLoaded(true)
        marker.addTo(map)

        // Pulsing halo rings — GPU-accelerated, no JS loop needed
        map.addSource('biz-halo', {
          type: 'geojson',
          data: { type: 'Feature', geometry: { type: 'Point', coordinates: coords }, properties: {} },
        })

        map.addLayer({
          id: 'biz-halo-outer',
          type: 'circle',
          source: 'biz-halo',
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 14, 22, 18, 90],
            'circle-color': '#6366F1',
            'circle-opacity': ['interpolate', ['linear'], ['zoom'], 14, 0, 15.5, 0.06, 18, 0.09],
            'circle-stroke-width': 1.5,
            'circle-stroke-color': '#6366F1',
            'circle-stroke-opacity': ['interpolate', ['linear'], ['zoom'], 14, 0, 16, 0.3, 18, 0.45],
            'circle-blur': 0.55,
          },
        })

        map.addLayer({
          id: 'biz-halo-inner',
          type: 'circle',
          source: 'biz-halo',
          paint: {
            'circle-radius': ['interpolate', ['linear'], ['zoom'], 14, 10, 18, 38],
            'circle-color': '#6366F1',
            'circle-opacity': ['interpolate', ['linear'], ['zoom'], 14, 0, 16, 0.12, 18, 0.18],
            'circle-blur': 0.3,
          },
        })

        if (animationExecutedRef.current !== coordsKey) {
          animationExecutedRef.current = coordsKey

          map.flyTo({
            center: coords,
            zoom: 16.5,
            pitch: 50,
            bearing: -20,
            duration: 4000,
            curve: 1.2,
            easing: (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
          })

          // ── Street pins con label — visibles desde que empieza el vuelo ─
          if (streetLabels && streetLabels.length > 0 && !cancelled) {
            streetLabels.forEach((sl, i) => {
              const wrapper = document.createElement('div')
              wrapper.style.cssText = [
                'display:flex', 'flex-direction:column', 'align-items:center',
                'pointer-events:none',
                'opacity:0', 'transform:scale(0.6)',
                'transform-origin:top center',
                'transition:opacity 0.4s ease, transform 0.4s ease',
                'will-change:opacity,transform',
              ].join(';')

              const dot = document.createElement('div')
              dot.style.cssText = [
                'width:11px', 'height:11px',
                'background:#facc15',
                'border:2.5px solid rgba(255,255,255,0.95)',
                'border-radius:50%',
                'box-shadow:0 0 10px rgba(250,204,21,0.65)',
              ].join(';')

              const label = document.createElement('span')
              label.textContent = sl.name
              label.style.cssText = [
                'margin-top:4px',
                'white-space:nowrap',
                'font-size:11px',
                'font-weight:700',
                'letter-spacing:0.12em',
                'text-transform:uppercase',
                'color:#fff',
                'font-family:system-ui,sans-serif',
                'text-shadow:0 1px 5px rgba(0,0,0,0.95)',
                'background:rgba(0,0,0,0.45)',
                'padding:2px 6px',
                'border-radius:5px',
              ].join(';')

              wrapper.appendChild(dot)
              wrapper.appendChild(label)

              const pinMarker = new mapboxgl.Marker({ element: wrapper, anchor: 'top' })
                .setLngLat(sl.coords)
                .addTo(map)

              poiMarkersRef.current.push(pinMarker)

              setTimeout(() => {
                if (cancelled) return
                wrapper.style.opacity = '1'
                wrapper.style.transform = 'scale(1)'
              }, 600 + i * 180)
            })
          }

          const onFlyEnd = () => {
            if (cancelled) return

            // ── Auto-detect street labels (solo si no hay manuales) ───
            if (!streetLabels || streetLabels.length === 0) {
              const center = map.project(coords)
              const pad = isMobile ? 130 : 220
              const roads = map.queryRenderedFeatures(
                [[center.x - pad, center.y - pad], [center.x + pad, center.y + pad]]
              ).filter(f => f.geometry.type === 'LineString' && f.properties?.name)

              const unique = Array.from(
                new Map(roads.map(f => [String(f.properties?.name), f])).values()
              ).slice(0, isMobile ? 2 : 3)

              if (unique.length > 0) {
                const lineGeoJSON: GeoJSON.FeatureCollection = {
                  type: 'FeatureCollection',
                  features: unique.map(f => ({
                    type: 'Feature',
                    geometry: f.geometry,
                    properties: { name: String(f.properties?.name) },
                  })),
                }
                map.addSource('street-lines', { type: 'geojson', data: lineGeoJSON })
                map.addLayer({
                  id: 'street-line-glow',
                  type: 'line',
                  source: 'street-lines',
                  paint: { 'line-color': '#facc15', 'line-width': isMobile ? 2 : 3, 'line-opacity': 0, 'line-blur': 2 },
                })
                map.addLayer({
                  id: 'street-line-label',
                  type: 'symbol',
                  source: 'street-lines',
                  layout: {
                    'symbol-placement': 'line',
                    'text-field': ['get', 'name'],
                    'text-font': ['DIN Pro Bold', 'Arial Unicode MS Bold'],
                    'text-size': isMobile ? 11 : 13,
                    'text-max-angle': 30,
                    'text-pitch-alignment': 'map',
                    'text-rotation-alignment': 'map',
                    'text-padding': 12,
                    'text-letter-spacing': 0.06,
                  },
                  paint: { 'text-color': '#facc15', 'text-halo-color': 'rgba(0,0,0,0.85)', 'text-halo-width': 2, 'text-opacity': 0 },
                })
                setTimeout(() => {
                  if (cancelled) return
                  map.setPaintProperty('street-line-glow', 'line-opacity', 0.35)
                  map.setPaintProperty('street-line-label', 'text-opacity', 1)
                }, 300)
              }
            }

            // ── Nearby POI pins via Geocoding API ────────────────────
            const POI_CATEGORIES: { query: string; color: string }[] = [
              { query: 'hospital',  color: '#f472b6' },
              { query: 'pharmacy',  color: '#34d399' },
              { query: 'school',    color: '#fbbf24' },
              { query: 'restaurant',color: '#f97316' },
              { query: 'supermarket', color: '#60a5fa' },
            ]

            const maxPerCat = isMobile ? 1 : 2
            const seen = new Set<string>()
            let pinIndex = 0

            const addPoiMarker = (name: string, lngLat: [number, number], color: string) => {
              if (cancelled || seen.has(name)) return
              seen.add(name)

              const el = document.createElement('div')
              el.style.cssText = [
                'display:flex', 'flex-direction:column', 'align-items:center',
                'pointer-events:none',
                'opacity:0', 'transform:translateY(6px) scale(0.7)',
                'transform-origin:top center',
                'transition:opacity 0.45s ease, transform 0.45s ease',
                'will-change:opacity,transform',
              ].join(';')

              const dot = document.createElement('div')
              dot.style.cssText = [
                'width:9px', 'height:9px',
                `background:${color}`,
                'border:1.5px solid rgba(255,255,255,0.9)',
                'border-radius:50%',
                `box-shadow:0 0 7px ${color}99`,
              ].join(';')

              const lbl = document.createElement('span')
              lbl.textContent = name.length > 18 ? name.slice(0, 17) + '…' : name
              lbl.style.cssText = [
                'margin-top:3px', 'white-space:nowrap',
                'font-size:9px', 'font-weight:700',
                'letter-spacing:0.04em', 'color:#fff',
                'font-family:system-ui,sans-serif',
                'text-shadow:0 1px 4px rgba(0,0,0,0.9)',
                'background:rgba(0,0,0,0.4)',
                'padding:1px 5px', 'border-radius:4px',
              ].join(';')

              el.appendChild(dot)
              el.appendChild(lbl)

              const m = new mapboxgl.Marker({ element: el, anchor: 'top' })
                .setLngLat(lngLat)
                .addTo(map)
              poiMarkersRef.current.push(m)

              const idx = pinIndex++
              setTimeout(() => {
                if (cancelled) return
                el.style.opacity = '1'
                el.style.transform = 'translateY(0) scale(1)'
              }, idx * 100 + 200)
            }

            POI_CATEGORIES.forEach(({ query, color }) => {
              fetch(
                `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json` +
                `?proximity=${coords[0]},${coords[1]}&types=poi&limit=${maxPerCat}&access_token=${MAPBOX_TOKEN}`
              )
                .then(r => r.json())
                .then(data => {
                  if (cancelled) return
                  for (const f of (data.features ?? [])) {
                    const name = String(f.text ?? f.place_name ?? '').trim()
                    if (!name) continue
                    addPoiMarker(name, f.center as [number, number], color)
                  }
                })
                .catch(() => null)
            })

            const ORBIT_THROTTLE_MS = isMobile ? 33 : 16
            let lastTime: number | null = null
            let lastSetTime: number | null = null
            let bearing = map.getBearing()
            let totalRotated = 0

            const orbit = (time: number) => {
              if (cancelled) return

              if (lastTime !== null) {
                const delta = time - lastTime
                const step = (15 * delta) / 1000
                bearing -= step
                totalRotated += step

                if (totalRotated >= 360) return

                if (lastSetTime === null || time - lastSetTime >= ORBIT_THROTTLE_MS) {
                  map.setBearing(bearing)
                  lastSetTime = time
                }
              }

              lastTime = time
              droneFrame = requestAnimationFrame(orbit)
            }

            droneFrame = requestAnimationFrame(orbit)
          }

          map.once('moveend', onFlyEnd)
        }
      })

      mapRef.current = map
    }

    initMap()

    return () => {
      cancelled = true
      if (droneFrame !== null) cancelAnimationFrame(droneFrame)
      poiMarkersRef.current.forEach((m) => m.remove())
      poiMarkersRef.current = []
      if (mapRef.current) {
        mapRef.current.stop()
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, businessName, coordsLng, coordsLat, coordsKey, streetLabels])

  if (!address?.trim()) {
    return (
      <div className={`${className} h-64 rounded-lg p-6 text-center flex flex-col justify-center bg-gray-50 border-2 border-dashed border-gray-300`}>
        <svg className="w-12 h-12 mx-auto text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
        </svg>
        <p className="text-gray-500">No hay direccion para mostrar</p>
      </div>
    )
  }

  if (error) {
    return (
      <div className={`${className} h-64 rounded-lg p-6 text-center flex flex-col justify-center bg-gray-50 border-2 border-dashed border-gray-300`}>
        <svg className="w-12 h-12 mx-auto text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
        </svg>
        <h3 className="text-lg font-semibold text-gray-900 mb-1">{businessName}</h3>
        <p className="text-sm text-gray-600 mb-4">{address}</p>
        <a
          href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(address)}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-block px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg transition-colors text-sm"
        >
          Ver en mapa
        </a>
      </div>
    )
  }

  return (
    <div className={`relative ${className}`}>
      <div
        ref={mapContainerRef}
        className="w-full h-full min-h-[300px] rounded-lg overflow-hidden"
      />
      {!isLoaded && (
        <div className="absolute inset-0 rounded-lg flex items-center justify-center bg-gray-100">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto mb-2" />
            <p className="text-sm text-gray-600">Cargando mapa...</p>
          </div>
        </div>
      )}
    </div>
  )
}
