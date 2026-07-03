/* Shared framer-motion variants — keeps the app consistent and lazy-loads in one place. */
import type { Variants } from "framer-motion";

export const easeOut = [0.16, 1, 0.3, 1] as const;
export const easeSpring = [0.34, 1.56, 0.64, 1] as const;

export const fadeUp: Variants = {
  hidden: { opacity: 0, y: 24 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: easeOut } },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { duration: 0.5, ease: easeOut } },
};

export const stagger = (delay = 0.08): Variants => ({
  hidden: {},
  show: { transition: { staggerChildren: delay, delayChildren: 0.05 } },
});

export const scaleIn: Variants = {
  hidden: { opacity: 0, scale: 0.96 },
  show: { opacity: 1, scale: 1, transition: { duration: 0.5, ease: easeOut } },
};

export const slideIn: Variants = {
  hidden: { opacity: 0, x: -16 },
  show: { opacity: 1, x: 0, transition: { duration: 0.5, ease: easeOut } },
};

/* Reduced-motion friendly wrapper */
export const motionProps = {
  initial: "hidden" as const,
  animate: "show" as const,
  variants: fadeUp,
};
