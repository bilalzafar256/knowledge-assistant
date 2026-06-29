"use client";

/**
 * Marketing motion primitives — the only place Framer Motion is imported for the
 * landing. Every primitive degrades to a static, fully-visible state under
 * `prefers-reduced-motion` (MOTION_INTENSITY 7 → reduced-motion is the floor).
 *
 * Continuous values (count-up, magnetic pull) use motion values, never React
 * state, so they animate off the render cycle and stay smooth on mobile.
 */

import {
  motion,
  useReducedMotion,
  useInView,
  useMotionValue,
  useSpring,
  animate,
  type Variants,
} from "framer-motion";
import { useEffect, useRef, type ReactNode } from "react";

const EASE = [0.16, 1, 0.3, 1] as const;

/* ── Reveal: a single block rises + fades as it enters the viewport ───────── */
export function Reveal({
  children,
  className,
  delay = 0,
  y = 26,
  as = "div",
}: {
  children: ReactNode;
  className?: string;
  delay?: number;
  y?: number;
  as?: "div" | "section" | "li" | "span" | "p";
}) {
  const reduce = useReducedMotion();
  const MotionTag = motion[as];
  return (
    <MotionTag
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, amount: 0.25 }}
      transition={{ duration: 0.7, delay, ease: EASE }}
    >
      {children}
    </MotionTag>
  );
}

/* ── Stagger: parent orchestrates a sequenced reveal of its children ───────── */
const staggerParent: Variants = {
  hidden: {},
  show: { transition: { staggerChildren: 0.08, delayChildren: 0.05 } },
};
const staggerChild: Variants = {
  hidden: { opacity: 0, y: 22 },
  show: { opacity: 1, y: 0, transition: { duration: 0.65, ease: EASE } },
};

export function Stagger({
  children,
  className,
  amount = 0.2,
}: {
  children: ReactNode;
  className?: string;
  amount?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      variants={reduce ? undefined : staggerParent}
      initial={reduce ? false : "hidden"}
      whileInView="show"
      viewport={{ once: true, amount }}
    >
      {children}
    </motion.div>
  );
}

export function StaggerItem({
  children,
  className,
}: {
  children: ReactNode;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div className={className} variants={reduce ? undefined : staggerChild}>
      {children}
    </motion.div>
  );
}

/* ── Counter: a metric counts up the first time it scrolls into view ───────── */
export function Counter({
  value,
  decimals = 0,
  suffix = "",
  prefix = "",
  className,
  duration = 1.4,
}: {
  value: number;
  decimals?: number;
  suffix?: string;
  prefix?: string;
  className?: string;
  duration?: number;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, amount: 0.6 });
  const mv = useMotionValue(0);

  useEffect(() => {
    if (!inView) return;
    if (reduce) {
      mv.set(value);
      return;
    }
    const controls = animate(mv, value, { duration, ease: EASE });
    return controls.stop;
  }, [inView, reduce, value, duration, mv]);

  useEffect(() => {
    return mv.on("change", (v) => {
      if (ref.current) ref.current.textContent = `${prefix}${v.toFixed(decimals)}${suffix}`;
    });
  }, [mv, decimals, suffix, prefix]);

  return (
    <span ref={ref} className={className}>
      {`${prefix}${(0).toFixed(decimals)}${suffix}`}
    </span>
  );
}

/* ── Magnetic: an element drifts toward the cursor, springs back on leave ──── */
export function Magnetic({
  children,
  className,
  strength = 0.35,
}: {
  children: ReactNode;
  className?: string;
  strength?: number;
}) {
  const reduce = useReducedMotion();
  const ref = useRef<HTMLDivElement>(null);
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, { stiffness: 180, damping: 15, mass: 0.3 });
  const sy = useSpring(y, { stiffness: 180, damping: 15, mass: 0.3 });

  if (reduce) return <div className={className}>{children}</div>;

  return (
    <motion.div
      ref={ref}
      className={className}
      style={{ x: sx, y: sy }}
      onPointerMove={(e) => {
        const el = ref.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        x.set((e.clientX - (r.left + r.width / 2)) * strength);
        y.set((e.clientY - (r.top + r.height / 2)) * strength);
      }}
      onPointerLeave={() => {
        x.set(0);
        y.set(0);
      }}
    >
      {children}
    </motion.div>
  );
}

export const ease = EASE;
