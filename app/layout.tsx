import type { Metadata } from 'next';
import { Bebas_Neue, Manrope } from 'next/font/google';
import './globals.css';

const manrope = Manrope({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-manrope',
});

const bebasNeue = Bebas_Neue({
  subsets: ['latin'],
  weight: '400',
  variable: '--font-bebas-neue',
});

export const metadata: Metadata = {
  title: 'Crispy Charles | Menú',
  description: 'Tiras de pollo frito que crujen de sabor. Haz tu pedido en línea.',
  icons: { icon: '/favicon.ico' },
  openGraph: {
    title: 'Crispy Charles',
    description: 'Sabor que cruje 🔥',
    type: 'website',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body className={`${manrope.variable} ${bebasNeue.variable} min-h-screen bg-brand-paper text-brand-ink`}>
        {children}
      </body>
    </html>
  );
}
