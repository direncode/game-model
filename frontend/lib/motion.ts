import type { Variants } from "framer-motion";

// Fade up from below, used for section entries
export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 40 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.8, ease: [0.22, 1, 0.36, 1] },
  },
};

// Fade in without movement, for subtle reveals
export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { duration: 0.6 } },
};

// Stagger children for lists/grids
export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.1, delayChildren: 0.2 },
  },
};

// Scale up from slightly smaller, for product shots
export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: {
    opacity: 1,
    scale: 1,
    transition: { duration: 1, ease: [0.22, 1, 0.36, 1] },
  },
};

// Viewport settings for useInView / whileInView
export const viewportOnce = { once: true, margin: "-100px" };
