import type { Metadata } from 'next';
import './globals.css';

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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet" />
      </head>
      <body className="min-h-screen bg-brand-black text-white">
        {children}
      </body>
    </html>
  );
}
