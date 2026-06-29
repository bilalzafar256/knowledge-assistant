"use client";

/**
 * Custom cursor for the marketing surface only.
 *
 * The taste guidance treats custom cursors as a default AI-tell, so this is
 * deliberately conservative: it activates ONLY on fine-pointer + hover devices
 * (never touch), bails entirely under prefers-reduced-motion (restoring the
 * native cursor), and tracks the pointer with motion values so it never
 * re-renders the tree on move. A small dot leads, a larger ring lags behind and
 * grows over interactive targets.
 */

import { useEffect, useState } from "react";
import { motion, useMotionValue, useSpring, useReducedMotion } from "framer-motion";

export function CustomCursor() {
  const reduce = useReducedMotion();
  const [active, setActive] = useState(false); // over an interactive target
  const [down, setDown] = useState(false);

  const x = useMotionValue(-100);
  const y = useMotionValue(-100);
  const ringX = useSpring(x, { stiffness: 200, damping: 24, mass: 0.5 });
  const ringY = useSpring(y, { stiffness: 200, damping: 24, mass: 0.5 });
  const dotX = useSpring(x, { stiffness: 700, damping: 40, mass: 0.2 });
  const dotY = useSpring(y, { stiffness: 700, damping: 40, mass: 0.2 });

  useEffect(() => {
    if (reduce) return;
    // Visibility is handled in CSS (.mkt-cursor media query); the effect only
    // wires behaviour, and only on a real mouse. No setState in the effect body.
    const fine = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    if (!fine) return;

    document.documentElement.classList.add("mkt-cursor-none");

    const move = (e: PointerEvent) => {
      x.set(e.clientX);
      y.set(e.clientY);
    };
    const over = (e: PointerEvent) => {
      const t = e.target as HTMLElement | null;
      setActive(!!t?.closest?.("a, button, [role='button'], input, label, [data-cursor]"));
    };
    const onDown = () => setDown(true);
    const onUp = () => setDown(false);

    window.addEventListener("pointermove", move, { passive: true });
    window.addEventListener("pointerover", over, { passive: true });
    window.addEventListener("pointerdown", onDown, { passive: true });
    window.addEventListener("pointerup", onUp, { passive: true });

    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerover", over);
      window.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointerup", onUp);
      document.documentElement.classList.remove("mkt-cursor-none");
    };
  }, [reduce, x, y]);

  return (
    <div className="mkt-cursor" aria-hidden>
      {/* lagging ring */}
      <motion.div
        className="pointer-events-none fixed left-0 top-0 z-[100]"
        style={{ x: ringX, y: ringY }}
      >
        <motion.div
          className="-translate-x-1/2 -translate-y-1/2 rounded-full border border-[var(--accent)]"
          animate={{
            width: active ? 52 : 34,
            height: active ? 52 : 34,
            opacity: active ? 1 : 0.5,
            backgroundColor: active ? "rgba(52,211,153,0.08)" : "rgba(52,211,153,0)",
            scale: down ? 0.85 : 1,
          }}
          transition={{ type: "spring", stiffness: 320, damping: 24 }}
        />
      </motion.div>

      {/* leading dot */}
      <motion.div
        className="pointer-events-none fixed left-0 top-0 z-[100]"
        style={{ x: dotX, y: dotY }}
      >
        <motion.div
          className="-translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--accent)]"
          animate={{ width: active ? 5 : 7, height: active ? 5 : 7, scale: down ? 0.7 : 1 }}
          transition={{ type: "spring", stiffness: 500, damping: 28 }}
          style={{ boxShadow: "0 0 8px rgba(52,211,153,0.7)" }}
        />
      </motion.div>
    </div>
  );
}
