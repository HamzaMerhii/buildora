import type { ComponentProps } from 'react';
export default function GlowButton({children,className='',...props}:ComponentProps<'button'>) {return <button {...props} className={`glow-button ${className}`}><span>{children}</span></button>;}
