import type { Metadata } from 'next';
import localFont from 'next/font/local';
import { WorkspaceProvider } from '@/components/features/WorkspaceProvider';
import './globals.css';
const inter=localFont({src:'../../public/fonts/inter-latin.woff2',variable:'--font-inter',display:'swap'});
export const metadata:Metadata={title:{default:'Buildora',template:'%s | Buildora'},description:'Construction operations and thoughtfully engineered residences across Lebanon.'};
export default function RootLayout({children}:{children:React.ReactNode}){return <html lang="en"><body className={inter.variable}><a className="skip-link" href="#main-content">Skip to content</a><WorkspaceProvider>{children}</WorkspaceProvider></body></html>;}
