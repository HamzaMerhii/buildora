/** Normalized positions for the six-scene camera shot.
 * Hero hold ~0-10%, hero->services overlap ~10-18%, services hold ~18-32%,
 * services->about overlap ~32-40%, about hold ~40-50%, about->partners
 * overlap ~50-58%, partners hold ~58-68%, partners->apartments overlap
 * ~68-76%, apartments hold ~76-85%, apartments->final overlap ~85-92%,
 * final settle ~92-100%.
 */
export const TIMELINE = {
  heroTravel: [0, 0.1, 0.18],
  servicesTravel: [0.11, 0.18, 0.32, 0.4],
  aboutTravel: [0.33, 0.4, 0.5, 0.58],
  partnersTravel: [0.51, 0.58, 0.68, 0.76],
  apartmentsTravel: [0.69, 0.76, 0.85, 0.91],
  finalTravel: [0.84, 0.92, 1],
  stops: [0, 0.26, 0.49, 0.67, 0.84, 1],
  /** Overlap midpoints: below bound[i] the scene is i. */
  activeBounds: [0.145, 0.36, 0.54, 0.72, 0.885],
} as const;
export const CAMERA_EASE = [0.42, 0, 0.25, 1] as const;
