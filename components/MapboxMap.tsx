'use client'

import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

interface MapboxMapProps {
  address: string
  businessName: string
  coords?: [number, number] // [lng, lat] - if provided, skips geocoding
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

export function MapboxMap({ address, businessName, coords: coordsProp, className = '' }: MapboxMapProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const animationExecutedRef = useRef<string | null>(null)
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

      mapboxgl.accessToken = MAPBOX_TOKEN
      const isMobile = 'ontouchstart' in window

      const map = new mapboxgl.Map({
        container: mapContainerRef.current,
        style: 'mapbox://styles/mapbox/standard',
        center: coords,
        zoom: 20,
        pitch: 70,
        bearing: -20,
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
        setIsLoaded(true)
        marker.addTo(map)

        if (animationExecutedRef.current !== coordsKey) {
          animationExecutedRef.current = coordsKey

          map.flyTo({
            center: coords,
            zoom: 20,
            pitch: 70,
            bearing: -20,
            duration: 4000,
            curve: 1.4,
            easing: (t) => (t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t),
          })

          const onFlyEnd = () => {
            if (cancelled) return
            if (map.getZoom() < 10) {
              map.once('moveend', onFlyEnd)
              return
            }

            dotEl.animate(
              [
                { transform: 'scale(0) translateY(-14px)', opacity: 0 },
                { transform: 'scale(1.45) translateY(0)', opacity: 1, offset: 0.52 },
                { transform: 'scale(0.80) translateY(0)', offset: 0.70 },
                { transform: 'scale(1.18) translateY(0)', offset: 0.85 },
                { transform: 'scale(0.95) translateY(0)', offset: 0.93 },
                { transform: 'scale(1) translateY(0)', opacity: 1 },
              ],
              { duration: 680, easing: 'ease-out', fill: 'forwards' }
            )

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
                bearing += step
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
      if (mapRef.current) {
        mapRef.current.stop()
        mapRef.current.remove()
        mapRef.current = null
      }
    }
  }, [address, businessName, coordsLng, coordsLat, coordsKey])

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
