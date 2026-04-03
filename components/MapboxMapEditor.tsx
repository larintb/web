'use client'

import { useEffect, useRef, useState } from 'react'
import mapboxgl from 'mapbox-gl'
import 'mapbox-gl/dist/mapbox-gl.css'

interface MapboxMapEditorProps {
  coords: [number, number] // [lng, lat]
  onCoordsChange?: (lng: number, lat: number) => void
  className?: string
}

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN ?? ''

export function MapboxMapEditor({ coords, onCoordsChange, className = '' }: MapboxMapEditorProps) {
  const mapContainerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<mapboxgl.Map | null>(null)
  const markerRef = useRef<mapboxgl.Marker | null>(null)
  const mapLoadedRef = useRef(false)
  const pendingCoordsRef = useRef<[number, number] | null>(null)
  const prevCoordsRef = useRef<[number, number]>(coords)
  const onCoordsChangeRef = useRef(onCoordsChange)
  onCoordsChangeRef.current = onCoordsChange
  const [isLoaded, setIsLoaded] = useState(false)
  const [isDragging, setIsDragging] = useState(false)

  // Initialize map once on mount
  useEffect(() => {
    if (!mapContainerRef.current || !MAPBOX_TOKEN) return

    const initialCoords = prevCoordsRef.current
    const isMobile = 'ontouchstart' in window

    mapboxgl.accessToken = MAPBOX_TOKEN

    const map = new mapboxgl.Map({
      container: mapContainerRef.current,
      style: 'mapbox://styles/mapbox/standard',
      center: initialCoords,
      zoom: 14,
      pitch: 0,
      bearing: 0,
      antialias: !isMobile,
      attributionControl: false,
    })

    map.addControl(new mapboxgl.NavigationControl(), 'top-right')

    // Marker wrapper (Mapbox applies translate here)
    const markerEl = document.createElement('div')
    markerEl.style.cssText = 'width:26px;height:26px;'

    // Inner dot (we animate this independently)
    const dotEl = document.createElement('div')
    dotEl.style.cssText = [
      'width:26px', 'height:26px',
      'background:#6366F1',
      'border:3px solid #fff',
      'border-radius:50%',
      'box-shadow:0 2px 14px rgba(99,102,241,0.55)',
      'cursor:grab',
      'transition:transform 0.15s ease,box-shadow 0.15s ease',
    ].join(';')
    markerEl.appendChild(dotEl)

    const marker = new mapboxgl.Marker({
      element: markerEl,
      anchor: 'center',
      draggable: true,
    })
      .setLngLat(initialCoords)
      .addTo(map)

    marker.on('dragstart', () => {
      dotEl.style.cursor = 'grabbing'
      dotEl.style.transform = 'scale(1.25)'
      dotEl.style.boxShadow = '0 4px 24px rgba(99,102,241,0.75)'
      setIsDragging(true)
    })

    marker.on('dragend', () => {
      dotEl.style.cursor = 'grab'
      dotEl.style.transform = 'scale(1)'
      dotEl.style.boxShadow = '0 2px 14px rgba(99,102,241,0.55)'
      setIsDragging(false)
      const lngLat = marker.getLngLat()
      onCoordsChangeRef.current?.(lngLat.lng, lngLat.lat)
    })

    markerRef.current = marker

    map.on('load', () => {
      map.setConfigProperty('basemap', 'lightPreset', 'dusk')
      mapLoadedRef.current = true
      setIsLoaded(true)

      const target = pendingCoordsRef.current ?? initialCoords
      pendingCoordsRef.current = null

      map.flyTo({
        center: target,
        zoom: 18,
        pitch: 65,
        bearing: -15,
        duration: 2500,
        curve: 1.2,
        easing: (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
      })
    })

    mapRef.current = map

    return () => {
      mapLoadedRef.current = false
      map.remove()
      mapRef.current = null
      markerRef.current = null
    }
  }, [])

  // Fly to new coords when address changes
  useEffect(() => {
    const [lng, lat] = coords
    const [prevLng, prevLat] = prevCoordsRef.current
    if (lng === prevLng && lat === prevLat) return
    prevCoordsRef.current = coords

    markerRef.current?.setLngLat(coords)

    if (!mapLoadedRef.current || !mapRef.current) {
      pendingCoordsRef.current = coords
      return
    }

    mapRef.current.flyTo({
      center: coords,
      zoom: 18,
      pitch: 65,
      bearing: -15,
      duration: 2500,
      curve: 1.2,
      easing: (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
    })
  }, [coords])

  return (
    <div className={`relative ${className}`}>
      <div
        ref={mapContainerRef}
        className="w-full h-full rounded-xl overflow-hidden"
      />

      {/* Loading overlay */}
      {!isLoaded && (
        <div className="absolute inset-0 rounded-xl flex items-center justify-center bg-gray-100">
          <div
            className="w-5 h-5 rounded-full border-2 border-transparent animate-spin"
            style={{ borderTopColor: '#6366F1', borderRightColor: '#6366F1' }}
          />
        </div>
      )}

      {/* Drag hint */}
      {isLoaded && (
        <div
          className="absolute bottom-3 left-1/2 -translate-x-1/2 px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap pointer-events-none transition-opacity duration-200"
          style={{
            backgroundColor: 'rgba(0,0,0,0.55)',
            color: '#fff',
            backdropFilter: 'blur(6px)',
            opacity: isDragging ? 0 : 1,
          }}
        >
          Arrastra el punto para ajustar
        </div>
      )}
    </div>
  )
}
