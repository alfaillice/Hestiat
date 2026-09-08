import './globals.css';
import type { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Hestiat — Un hogar en cada viaje',
  description: 'Alojamientos extraordinarios, experiencias reales y un mundo por descubrir.'
};

export default function RootLayout({children}:{children:React.ReactNode}) {
  return <html lang="es"><body>{children}</body></html>;
}
