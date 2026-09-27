"use client";
import Image from "next/image";
import Link from "next/link";
import { motion, useTransform, type MotionValue } from "framer-motion";
import {
  apartmentDisplayName,
  formatApartmentArea,
  formatApartmentStatus,
  type PublicApartmentListItem,
} from "@/lib/api/public.api";
import ApartmentCard from "./ApartmentCard";
import NeonPanel from "@/components/public/ui/NeonPanel";

/** Number of showcase cards in the cinematic layout. No backend ranking. */
const SHOWCASE_COUNT = 3;

export default function ApartmentsPanel({
  progress,
  reduced,
  apartments,
  loading,
  failed,
  selectedId,
  onSelect,
}: {
  progress: MotionValue<number>;
  reduced: boolean;
  apartments: PublicApartmentListItem[];
  loading: boolean;
  failed: boolean;
  selectedId: string | null;
  onSelect: (id: string) => void;
}) {
  const showcase = apartments.slice(0, SHOWCASE_COUNT);
  const selected = showcase.find((a) => a.id === selectedId) ?? showcase[0];
  const y = useTransform(progress, [0.7, 0.77, 0.85, 0.895], ["10vh", "0vh", "0vh", "-8vh"]);
  const opacity = useTransform(progress, [0.695, 0.74, 0.855, 0.895], [0, 1, 1, 0]);
  const headClip = useTransform(
    progress,
    [0.71, 0.78],
    ["inset(0 100% 0 0)", "inset(0 0% 0 0)"],
  );
  const headOpacity = useTransform(progress, [0.705, 0.725], [0, 1]);
  const featScale = useTransform(progress, [0.71, 0.82, 0.895], [1.045, 1.01, 1]);
  const specs = selected
    ? [
        selected.bedrooms != null && `${selected.bedrooms} Beds`,
        selected.bathrooms != null && `${selected.bathrooms} Baths`,
        formatApartmentArea(selected.area_sqm),
      ]
        .filter(Boolean)
        .join(" · ")
    : "";
  const selectedName = selected ? apartmentDisplayName(selected.unit_number) : "";
  return (
    <motion.div
      className="apartments-motion"
      style={{ y: reduced ? 0 : y, opacity }}
    >
      <div className="apartments-layout">
        <motion.div
          className="apartments-copy"
          style={{
            clipPath: reduced ? undefined : headClip,
            opacity: headOpacity,
          }}
        >
          <p className="apartments-eyebrow">Residences</p>
          <h2>Featured Apartments</h2>
          <p>
            Explore thoughtfully designed residences shaped around modern
            living, comfort, and architectural quality.
          </p>
        </motion.div>
        <div className="apartments-stage">
          {loading && !selected && (
            <NeonPanel className="featured-frame">
              <p className="featured-loading" role="status">Loading featured residences…</p>
            </NeonPanel>
          )}
          {failed && !selected && (
            <NeonPanel className="featured-frame">
              <p className="featured-error" role="alert">Couldn&apos;t load featured residences right now.</p>
            </NeonPanel>
          )}
          {selected && (
          <Link
            className="featured-card-link"
            href={`/apartments/${selected.id}`}
            aria-label={`View details of ${selectedName}`}
          >
          <NeonPanel className="featured-frame">
            <motion.div
              className="featured-media"
              style={{ scale: reduced ? 1 : featScale }}
            >
              <motion.div
                key={selected.id}
                className="featured-swap"
                initial={reduced ? false : { opacity: 0.25 }}
                animate={{ opacity: 1 }}
                transition={{ duration: reduced ? 0 : 0.45 }}
              >
                {selected.primary_image && (
                  <Image
                    src={selected.primary_image}
                    alt={selectedName}
                    fill
                    priority={false}
                    sizes="(max-width: 640px) 90vw, 55vw"
                    style={{ objectFit: "cover" }}
                  />
                )}
              </motion.div>
            </motion.div>
            <div className="featured-meta">
              <div>
                <h3>{selectedName}</h3>
                {specs && <p>{specs}</p>}
              </div>
              {selected.status && (
                <span className="featured-side">
                  <span className="featured-status">{formatApartmentStatus(selected.status)}</span>
                </span>
              )}
            </div>
          </NeonPanel>
          </Link>
          )}
          <div
            className="apartments-thumbs"
            role="group"
            aria-label="Choose a featured apartment"
          >
            {showcase.map((apartment, index) => (
              <ApartmentCard
                key={apartment.id}
                apartment={apartment}
                index={index}
                selected={selected != null && apartment.id === selected.id}
                onSelect={onSelect}
                progress={progress}
                reduced={reduced}
              />
            ))}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
