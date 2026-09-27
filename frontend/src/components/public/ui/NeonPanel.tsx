import type { ReactNode } from 'react';
export default function NeonPanel({children,className=''}:{children:ReactNode;className?:string}) {return <div className={`neon-panel ${className}`}><i className="corner top-left"/><i className="corner top-right"/><i className="corner bottom-left"/><i className="corner bottom-right"/>{children}</div>;}
