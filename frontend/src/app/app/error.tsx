'use client';
export default function ErrorPage({reset}:{reset:()=>void}){return <div className="empty-state"><h1>Unable to load data</h1><p>Please try again. Your workspace changes are preserved for this session.</p><button className="button" onClick={reset}>Try again</button></div>;}
