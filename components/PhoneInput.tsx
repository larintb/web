'use client';

import { useState, useRef, useEffect } from 'react';

interface Country {
  code: string;  // ISO 2-letter
  flag: string;  // emoji
  name: string;
  dial: string;  // e.g. "+52"
  digitLen: number; // expected local digits (for formatting)
}

const COUNTRIES: Country[] = [
  { code: 'MX', flag: '🇲🇽', name: 'México',           dial: '+52',  digitLen: 10 },
  { code: 'US', flag: '🇺🇸', name: 'Estados Unidos',   dial: '+1',   digitLen: 10 },
  { code: 'CA', flag: '🇨🇦', name: 'Canadá',           dial: '+1',   digitLen: 10 },
  { code: 'GT', flag: '🇬🇹', name: 'Guatemala',         dial: '+502', digitLen: 8  },
  { code: 'BZ', flag: '🇧🇿', name: 'Belice',            dial: '+501', digitLen: 7  },
  { code: 'HN', flag: '🇭🇳', name: 'Honduras',          dial: '+504', digitLen: 8  },
  { code: 'SV', flag: '🇸🇻', name: 'El Salvador',       dial: '+503', digitLen: 8  },
  { code: 'NI', flag: '🇳🇮', name: 'Nicaragua',         dial: '+505', digitLen: 8  },
  { code: 'CR', flag: '🇨🇷', name: 'Costa Rica',        dial: '+506', digitLen: 8  },
  { code: 'PA', flag: '🇵🇦', name: 'Panamá',            dial: '+507', digitLen: 8  },
  { code: 'CO', flag: '🇨🇴', name: 'Colombia',          dial: '+57',  digitLen: 10 },
  { code: 'VE', flag: '🇻🇪', name: 'Venezuela',         dial: '+58',  digitLen: 10 },
  { code: 'EC', flag: '🇪🇨', name: 'Ecuador',           dial: '+593', digitLen: 9  },
  { code: 'PE', flag: '🇵🇪', name: 'Perú',              dial: '+51',  digitLen: 9  },
  { code: 'AR', flag: '🇦🇷', name: 'Argentina',         dial: '+54',  digitLen: 10 },
  { code: 'CL', flag: '🇨🇱', name: 'Chile',             dial: '+56',  digitLen: 9  },
  { code: 'UY', flag: '🇺🇾', name: 'Uruguay',           dial: '+598', digitLen: 9  },
  { code: 'PY', flag: '🇵🇾', name: 'Paraguay',          dial: '+595', digitLen: 9  },
  { code: 'BO', flag: '🇧🇴', name: 'Bolivia',           dial: '+591', digitLen: 8  },
  { code: 'BR', flag: '🇧🇷', name: 'Brasil',            dial: '+55',  digitLen: 11 },
  { code: 'ES', flag: '🇪🇸', name: 'España',            dial: '+34',  digitLen: 9  },
];

// Formatea dígitos locales con el patrón (XXX) XXX XXXX
function formatLocal(digits: string, maxLen: number): string {
  const d = digits.slice(0, maxLen);
  if (maxLen >= 10) {
    // Formato (XXX) XXX XXXX  o  (XXX) XXXX XXXX  para 11 dígitos
    if (d.length <= 3)  return d.length ? `(${d}` : '';
    if (d.length <= 6)  return `(${d.slice(0,3)}) ${d.slice(3)}`;
    if (d.length <= 10) return `(${d.slice(0,3)}) ${d.slice(3,6)} ${d.slice(6)}`;
    return `(${d.slice(0,3)}) ${d.slice(3,7)} ${d.slice(7)}`;
  }
  // Para países de 8-9 dígitos: XXXX XXXX o XXX XXXXXX
  if (d.length <= 4) return d;
  return `${d.slice(0,4)} ${d.slice(4)}`;
}

interface Props {
  value: string;       // número completo con lada, e.g. "+52 868 830 2741"
  onChange: (val: string) => void;
  placeholder?: string;
  className?: string;
}

export default function PhoneInput({ value, onChange, placeholder, className = '' }: Props) {
  const [country,   setCountry]   = useState<Country>(COUNTRIES[0]); // default MX
  const [localRaw,  setLocalRaw]  = useState('');   // solo dígitos locales
  const [open,      setOpen]      = useState(false);
  const [search,    setSearch]    = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Sincronizar state interno cuando value externo cambia (e.g. reset)
  useEffect(() => {
    if (!value) { setLocalRaw(''); return; }
    const match = COUNTRIES.find(c => value.startsWith(c.dial));
    if (match) {
      setCountry(match);
      const local = value.replace(match.dial, '').replace(/\D/g, '');
      setLocalRaw(local);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Cerrar dropdown al click fuera
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch('');
      }
    }
    document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, []);

  function handleLocalChange(e: React.ChangeEvent<HTMLInputElement>) {
    // Solo dígitos — strip cualquier otra cosa
    const digits = e.target.value.replace(/\D/g, '').slice(0, country.digitLen);
    setLocalRaw(digits);
    // Valor completo para el padre: "+52 868 830 2741"
    const formatted = formatLocal(digits, country.digitLen);
    onChange(digits.length ? `${country.dial} ${formatted}` : '');
  }

  function handleCountrySelect(c: Country) {
    setCountry(c);
    setLocalRaw('');
    onChange('');
    setOpen(false);
    setSearch('');
  }

  const filtered = COUNTRIES.filter(c =>
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    c.dial.includes(search)
  );

  const displayValue = formatLocal(localRaw, country.digitLen);

  return (
    <div className={`flex gap-2 ${className}`}>
      {/* Selector de país */}
      <div className="relative flex-shrink-0" ref={dropdownRef}>
        <button
          type="button"
          onClick={() => setOpen(o => !o)}
          className="h-full flex items-center gap-1.5 bg-white border border-brand-line hover:border-brand-red/50 rounded-xl px-3 py-3 transition-colors min-w-[80px]"
        >
          <span className="text-lg leading-none">{country.flag}</span>
          <span className="text-brand-ink text-sm font-semibold">{country.dial}</span>
          <span className="text-brand-muted text-xs">▾</span>
        </button>

        {open && (
          <div className="absolute top-full left-0 mt-1 w-64 bg-white border border-brand-line rounded-2xl shadow-2xl z-50 overflow-hidden">
            {/* Búsqueda */}
            <div className="p-2 border-b border-brand-line">
              <input
                autoFocus
                type="text"
                value={search}
                onChange={e => setSearch(e.target.value)}
                placeholder="Buscar país..."
                className="w-full bg-white rounded-lg px-3 py-2 text-sm text-brand-ink placeholder-brand-muted focus:outline-none border border-brand-line"
              />
            </div>
            {/* Lista */}
            <div className="max-h-52 overflow-y-auto">
              {filtered.map(c => (
                <button
                  key={c.code}
                  type="button"
                  onClick={() => handleCountrySelect(c)}
                  className={`w-full flex items-center gap-3 px-4 py-2.5 hover:bg-brand-red/5 transition-colors text-left ${country.code === c.code ? 'bg-brand-red/10' : ''}`}
                >
                  <span className="text-xl">{c.flag}</span>
                  <span className="text-brand-ink text-sm flex-1">{c.name}</span>
                  <span className="text-brand-muted text-xs font-mono">{c.dial}</span>
                </button>
              ))}
              {filtered.length === 0 && (
                <p className="text-center text-brand-muted text-sm py-4">Sin resultados</p>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Input del número */}
      <input
        type="tel"
        inputMode="numeric"
        value={displayValue}
        onChange={handleLocalChange}
        placeholder={placeholder ?? `(${country.digitLen === 10 ? '868' : '000'}) 000 0000`}
        className="flex-1 bg-white border border-brand-line rounded-xl px-4 py-3 text-brand-ink placeholder-brand-muted focus:outline-none focus:border-brand-red transition-colors font-mono"
      />
    </div>
  );
}
