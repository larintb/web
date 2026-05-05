'use client';

import { useEffect, useRef, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

interface Props {
  center?: [number, number];
  showPanorama?: boolean;
}

export default function MapboxInteractive({ 
  center = [-97.503669, 25.848049], 
  showPanorama = true 
}: Props) {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [isAnimating, setIsAnimating] = useState(true);
  const bearingRef = useRef(0);
  const animationRef = useRef<number | null>(null);
  const cancelledRef = useRef(false);

  useEffect(() => {
    if (!mapContainer.current) return;

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) {
      console.error('NEXT_PUBLIC_MAPBOX_TOKEN no está configurado');
      setIsAnimating(false);
      return;
    }

    cancelledRef.current = false;

    try {
      mapboxgl.accessToken = token;

      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/satellite-streets-v12',
        center: center,
        zoom: 2,
        pitch: 0,
        bearing: 0,
        antialias: true,
        doubleClickZoom: false,
        dragPan: false,
        dragRotate: false,
        scrollZoom: false,
        touchZoomRotate: false,
        touchPitch: false,
      });

      map.current.on('load', () => {
        if (!map.current || cancelledRef.current) return;

        const popup = new mapboxgl.Popup({
          offset: 25,
          closeButton: false,
          closeOnClick: false
        }).setHTML(
          `<div style="padding: 8px; text-align: center; font-family: Manrope, system-ui, sans-serif; background: white; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.15);">
            <p style="font-weight: bold; margin: 0; color: #171717; font-size: 14px;">🍗 Crispy Charles</p>
            <p style="margin: 4px 0 0 0; font-size: 12px; color: #888;">Tu ubicación</p>
          </div>`
        );

        new mapboxgl.Marker({ color: '#E63232', scale: 1.2 })
          .setLngLat(center)
          .setPopup(popup)
          .addTo(map.current);

        setIsAnimating(false);

        // FASE 1: Zoom suave desde el espacio → nivel drone
        map.current.flyTo({
          center: center,
          zoom: 17,
          pitch: 0,
          bearing: 0,
          duration: 5500,
          curve: 1.8,
          easing: (t: number) =>
            t < 0.5
              ? 0.5 * Math.pow(2 * t, 2.5)
              : 1 - 0.5 * Math.pow(2 * (1 - t), 2.5),
        });

        // FASE 2: Tiltar cámara al terminar el zoom
        map.current.once('moveend', () => {
          if (!map.current || cancelledRef.current) return;

          map.current.easeTo({
            pitch: 65,
            duration: 1800,
            easing: (t: number) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
          });

          // FASE 3: Panorámica 360 al terminar el tilt
          if (showPanorama) {
            map.current.once('pitchend', () => {
              if (!map.current || cancelledRef.current) return;

              let lastTime: number | null = null;

              const orbit = (time: number) => {
                if (cancelledRef.current || !map.current) return;

                if (lastTime !== null) {
                  const delta = time - lastTime;
                  bearingRef.current = (bearingRef.current + (20 * delta) / 1000) % 360;
                  map.current.setBearing(bearingRef.current);
                }

                lastTime = time;
                animationRef.current = requestAnimationFrame(orbit);
              };

              animationRef.current = requestAnimationFrame(orbit);
            });
          }
        });
      });

      map.current.on('error', (e) => {
        console.error('Error en Mapbox:', e);
        setIsAnimating(false);
      });

    } catch (error) {
      console.error('Error inicializando Mapbox:', error);
      setIsAnimating(false);
    }

    return () => {
      cancelledRef.current = true;
      if (animationRef.current !== null) {
        cancelAnimationFrame(animationRef.current);
      }
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, [center, showPanorama]);

  return (
    <div className="w-full h-full min-h-[300px] rounded-2xl overflow-hidden relative bg-gradient-to-br from-gray-900 to-blue-900">
      <div ref={mapContainer} className="w-full h-full" />
      
      {isAnimating && (
        <div className="absolute inset-0 flex items-center justify-center bg-black/20 backdrop-blur-sm pointer-events-none z-50">
          <div className="text-center">
            <div className="w-12 h-12 border-4 border-white/30 border-t-white rounded-full animate-spin mx-auto mb-3" />
            <p className="text-white font-semibold text-sm">Inicializando vista drone...</p>
            <p className="text-white/70 text-xs mt-1">Zoom espacio → ubicación → panorámica 360</p>
          </div>
        </div>
      )}

      <div className="absolute bottom-2 right-2 text-white/40 text-xs font-semibold pointer-events-none">
        Mapbox GL JS
      </div>
    </div>
  );
}
