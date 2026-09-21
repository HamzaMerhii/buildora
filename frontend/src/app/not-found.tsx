import Link from 'next/link';
import { SearchX } from 'lucide-react';
export default function NotFound(){return <main className="not-found" id="main-content"><SearchX size={45} style={{margin:'auto'}}/><h1>Record not found</h1><p>This page may have moved, or the record is no longer available.</p><Link href="/app/dashboard" className="button">Return to dashboard</Link></main>;}
