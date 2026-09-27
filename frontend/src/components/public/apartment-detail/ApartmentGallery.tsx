'use client';
import { useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { motion, useReducedMotionConfig } from 'framer-motion';

type GalleryImage = { src: string; alt: string };

export default function ApartmentGallery({ images, name }: { images: GalleryImage[]; name: string }) {
  const reduced = useReducedMotionConfig();
  const [selected, setSelected] = useState(0);
  const current = images[selected] ?? images[0];
  if (!current) return null;
  const multi = images.length > 1;
  function go(direction: 1 | -1) {
    setSelected(s => (s + direction + images.length) % images.length);
  }
  function onKeyDown(e: React.KeyboardEvent) {
    if (e.key === 'ArrowLeft') { e.preventDefault(); go(-1); }
    else if (e.key === 'ArrowRight') { e.preventDefault(); go(1); }
  }
  return <div
    className="apt-gallery"
    role="region"
    aria-roledescription="carousel"
    aria-label={`${name} photos`}
    tabIndex={multi ? 0 : undefined}
    onKeyDown={multi ? onKeyDown : undefined}
  >
    <div className="apt-main">
      <motion.div
        key={current.src}
        className="apt-main-swap"
        initial={reduced ? false : { opacity: 0.3 }}
        animate={{ opacity: 1 }}
        transition={{ duration: reduced ? 0 : 0.45 }}
      >
        <Image src={current.src} alt={current.alt} fill priority sizes="(max-width: 640px) 92vw, 62vw" style={{ objectFit: 'cover' }} />
      </motion.div>
      {multi && (
        <>
          <button type="button" className="apt-arrow apt-prev" aria-label="Previous apartment image" onClick={() => go(-1)}>
            <ChevronLeft size={22} aria-hidden="true" />
          </button>
          <button type="button" className="apt-arrow apt-next" aria-label="Next apartment image" onClick={() => go(1)}>
            <ChevronRight size={22} aria-hidden="true" />
          </button>
          <span className="apt-count" aria-hidden="true">{selected + 1} / {images.length}</span>
        </>
      )}
    </div>
    {multi && (
      <div className="apt-thumbs" role="group" aria-label={`Photos of ${name}`}>
        {images.map((image, i) => (
          <button
            key={image.src}
            type="button"
            className={i === selected ? 'apt-thumb is-selected' : 'apt-thumb'}
            aria-pressed={i === selected}
            aria-label={`View apartment image ${i + 1}`}
            onClick={() => setSelected(i)}
          >
            <Image src={image.src} alt="" fill sizes="140px" style={{ objectFit: 'cover' }} />
          </button>
        ))}
      </div>
    )}
  </div>;
}
