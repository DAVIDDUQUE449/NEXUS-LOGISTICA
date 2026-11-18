import type { Metadata, Viewport } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'NEXUS LOGISTICS OS',
  description: 'Plataforma Integral de Operaciones Logísticas',
  robots: { index: false, follow: false },
};
export const viewport: Viewport = { width: 'device-width', initialScale: 1, themeColor: '#6d3df5' };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es-CO" data-theme="nexus-aurora-light">
      <body>
        <a href="#contenido" className="sr-only">Saltar al contenido</a>
        {children}
      </body>
    </html>
  );
}
