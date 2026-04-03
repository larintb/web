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
  const animationRef = useRef<NodeJS.Timeout | null>(null);

  useEffect(() => {
    if (!mapContainer.current) return;

    const token = process.env.NEXT_PUBLIC_MAPBOX_TOKEN;
    if (!token) {
      console.error('NEXT_PUBLIC_MAPBOX_TOKEN no está configurado');
      setIsAnimating(false);
      return;
    }

    try {
      mapboxgl.accessToken = token;

      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/satellite-v9',
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
        if (!map.current) return;

        // Marcador en la ubicación del negocio
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

        // ────────────────────────────────────────────────────
        // FASE 1: Zoom suave desde el espacio (flyTo)
        // ────────────────────────────────────────────────────
        map.current.flyTo({
          center: center,
          zoom: 13.5,
          duration: 6000, // 6 segundos para el zoom
          easing: (t: number) => {
            // Easing suave: aceleración inicial, luego desaceleración
            return t < 0.5 
              ? 0.5 * Math.pow(2 * t, 2.5) 
              : 1 - 0.5 * Math.pow(2 * (1 - t), 2.5);
          }
        });

        // ────────────────────────────────────────────────────
        // FASE 2: Tiltar cámara después del zoom (pitch)
        // ────────────────────────────────────────────────────
        setTimeout(() => {
          if (!map.current) return;

          map.current.easeTo({
            pitch: 60,
            duration: 2000,
            easing: (t: number) => {
              // Easing de entrada suave
              return t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t;
            }
          });
        }, 3000);

        // ────────────────────────────────────────────────────
        // FASE 3: Panorámica 360 continua (bearing)
        // ────────────────────────────────────────────────────
        if (showPanorama) {
          setTimeout(() => {
            if (!map.current) return;

            const rotatePanorama = () => {
              bearingRef.current = (bearingRef.current + 1) % 360;
              if (map.current) {
                map.current.setBearing(bearingRef.current);
              }
            };

            // Rotación continua
            animationRef.current = setInterval(rotatePanorama, 50);
          }, 5500);
        }

        setIsAnimating(false);
      });

      map.current.on('error', (e) => {
        console.error('Error en Mapbox:', e);
        setIsAnimating(false);
      });

    } catch (error) {
      console.error('Error inicializando Mapbox:', error);
      setIsAnimating(false);
    }

    // Cleanup
    return () => {
      if (animationRef.current) {
        clearInterval(animationRef.current);
      }
      if (map.current) {
        map.current.remove();
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
