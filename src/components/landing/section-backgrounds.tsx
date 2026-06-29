"use client";

/**
 * Content-driven section backgrounds. Each one depicts the concept of the
 * section it sits behind (retrieval, grounding, evaluation, fusion, etc.) rather
 * than being generic decoration, which is the bar the taste guidance sets for
 * motivated motion.
 *
 * All are SVG + Framer Motion, transform/opacity only, pointer-events-none, and
 * each pauses when scrolled out of view (useInView) and collapses to a static,
 * intentional-looking final state under prefers-reduced-motion.
 */

import { useRef } from "react";
import { motion, useReducedMotion, useInView } from "framer-motion";

const A = "#34d399"; // emerald accent
const LINE = "rgba(233,236,239,0.10)";
const REPEAT = { repeat: Infinity } as const;

function useLive(amount = 0.2) {
  const ref = useRef<SVGSVGElement>(null);
  const reduce = useReducedMotion();
  const inView = useInView(ref, { amount });
  return { ref, live: !reduce && inView };
}

/* ─── Hero: the retrieval loop ─────────────────────────────────────────────
   Query pulses from the left, chunk nodes scatter the field, the relevant ones
   light and draw trace-lines to a single grounded answer node on the right. */

const CHUNKS: [number, number][] = [
  [96, 70], [150, 50], [214, 86], [120, 128], [188, 138], [252, 150],
  [92, 198], [122, 268], [250, 270], [210, 322],
];
// the four "retrieved" chunks, in scan order (left to right), and their cue time
const RETRIEVED: { p: [number, number]; f: number }[] = [
  { p: [150, 50], f: 0.2 },
  { p: [188, 138], f: 0.3 },
  { p: [226, 206], f: 0.42 },
  { p: [210, 322], f: 0.52 },
];
const ANSWER: [number, number] = [316, 186];
const QUERY: [number, number] = [40, 186];

export function RetrievalField() {
  const { ref, live } = useLive(0.3);
  const T = (d: number, times: number[]) => ({ duration: 7, times, ease: "easeInOut" as const, ...REPEAT, delay: d });

  return (
    <svg ref={ref} viewBox="0 0 360 372" className="h-full w-full" aria-hidden>
      {/* dim, always-present chunks (the document field) */}
      {CHUNKS.map(([cx, cy], i) => (
        <circle key={i} cx={cx} cy={cy} r="3" fill="var(--text-faint)" opacity="0.5" />
      ))}

      {/* trace lines: retrieved chunk → answer */}
      {RETRIEVED.map(({ p, f }, i) => (
        <motion.line
          key={`l${i}`}
          x1={p[0]} y1={p[1]} x2={ANSWER[0]} y2={ANSWER[1]}
          stroke={A} strokeWidth="1"
          initial={{ pathLength: live ? 0 : 1, opacity: live ? 0 : 0.35 }}
          animate={live ? { pathLength: [0, 0, 1, 1, 0], opacity: [0, 0, 0.5, 0.5, 0] } : { pathLength: 1, opacity: 0.35 }}
          transition={live ? T(0, [0, f + 0.04, f + 0.16, 0.82, 0.92]) : { duration: 0.6 }}
        />
      ))}

      {/* retrieved chunks light up as the scan passes */}
      {RETRIEVED.map(({ p, f }, i) => (
        <motion.circle
          key={`r${i}`}
          cx={p[0]} cy={p[1]} r="4.5" fill={A}
          initial={{ opacity: live ? 0.25 : 0.95, scale: 1 }}
          animate={live ? { opacity: [0.25, 0.25, 1, 1, 0.3], scale: [1, 1, 1.7, 1.4, 1] } : { opacity: 0.95, scale: 1.2 }}
          transition={live ? T(0, [0, f - 0.06, f, f + 0.2, 1]) : { duration: 0.6 }}
          style={{ transformOrigin: `${p[0]}px ${p[1]}px`, filter: "drop-shadow(0 0 4px rgba(52,211,153,0.7))" }}
        />
      ))}

      {/* scan line sweeping the field */}
      {live && (
        <motion.line
          x1="0" y1="20" x2="0" y2="352" stroke={A} strokeWidth="1"
          initial={{ x: 70, opacity: 0 }}
          animate={{ x: [70, 70, 268, 268, 70], opacity: [0, 0.5, 0.5, 0, 0] }}
          transition={{ duration: 7, times: [0, 0.05, 0.55, 0.6, 1], ...REPEAT, ease: "easeInOut" }}
        />
      )}

      {/* query origin + pulse */}
      <circle cx={QUERY[0]} cy={QUERY[1]} r="5" fill={A} />
      {live && (
        <motion.circle
          cx={QUERY[0]} cy={QUERY[1]} r="5" fill="none" stroke={A} strokeWidth="1.5"
          initial={{ scale: 0.4, opacity: 0.7 }}
          animate={{ scale: [0.4, 3.2, 3.2], opacity: [0.7, 0, 0] }}
          transition={{ duration: 7, times: [0, 0.16, 1], ...REPEAT, ease: "easeOut" }}
          style={{ transformOrigin: `${QUERY[0]}px ${QUERY[1]}px` }}
        />
      )}

      {/* the grounded answer node */}
      <motion.circle
        cx={ANSWER[0]} cy={ANSWER[1]} r="9" fill="none" stroke={A} strokeWidth="1.5"
        initial={{ opacity: live ? 0.3 : 0.9, scale: 1 }}
        animate={live ? { opacity: [0.3, 0.3, 1, 0.6], scale: [1, 1, 1.5, 1] } : { opacity: 0.9, scale: 1.1 }}
        transition={live ? { duration: 7, times: [0, 0.5, 0.66, 1], ...REPEAT, ease: "easeInOut" } : { duration: 0.6 }}
        style={{ transformOrigin: `${ANSWER[0]}px ${ANSWER[1]}px` }}
      />
      <circle cx={ANSWER[0]} cy={ANSWER[1]} r="3.5" fill={A} style={{ filter: "drop-shadow(0 0 6px rgba(52,211,153,0.8))" }} />
    </svg>
  );
}

/* ─── Problem: grounded vs invented ────────────────────────────────────────
   Facts anchored to a source line stay put; a few "invented" tokens rise off
   the line and dissolve. */

const ANCHORS = [120, 300, 480, 660, 840, 1020];
const GHOSTS = [
  { x: 230, dur: 7, delay: 0 },
  { x: 560, dur: 9, delay: 1.5 },
  { x: 760, dur: 8, delay: 3 },
  { x: 980, dur: 10, delay: 0.8 },
];

export function HallucinationDrift() {
  const { ref, live } = useLive();
  return (
    <svg ref={ref} viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice" className="h-full w-full" aria-hidden>
      <line x1="60" y1="300" x2="1140" y2="300" stroke={LINE} strokeWidth="1" />
      {ANCHORS.map((x, i) => (
        <g key={i}>
          <line x1={x} y1="300" x2={x} y2="268" stroke={A} strokeWidth="1" opacity="0.4" />
          <motion.circle
            cx={x} cy="262" r="4" fill={A}
            initial={{ opacity: 0.7 }}
            animate={live ? { opacity: [0.5, 0.9, 0.5] } : { opacity: 0.7 }}
            transition={live ? { duration: 3, delay: i * 0.4, ...REPEAT, ease: "easeInOut" } : undefined}
          />
        </g>
      ))}
      {GHOSTS.map((g, i) => (
        <motion.rect
          key={i} x={g.x} y="288" width="26" height="10" rx="2" fill="var(--text-faint)"
          initial={{ opacity: live ? 0 : 0.15, y: 0 }}
          animate={live ? { y: [0, -150], opacity: [0, 0.5, 0] } : { opacity: 0.15 }}
          transition={live ? { duration: g.dur, delay: g.delay, ...REPEAT, ease: "easeOut" } : undefined}
        />
      ))}
    </svg>
  );
}

/* ─── Evaluation: questions crossing the judge gate ────────────────────────
   Question dots stream right through a judge bar and come out graded. */

const JUDGE_X = 600;
const QDOTS = Array.from({ length: 9 }, (_, i) => ({ y: 70 + i * 32, delay: i * 0.6, dur: 6 + (i % 3) }));

export function JudgeStream() {
  const { ref, live } = useLive();
  return (
    <svg ref={ref} viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice" className="h-full w-full" aria-hidden>
      <line x1={JUDGE_X} y1="40" x2={JUDGE_X} y2="360" stroke={A} strokeWidth="1.5" opacity="0.35" />
      {QDOTS.map((d, i) => (
        <motion.circle
          key={i} cy={d.y} r="3.5"
          initial={{ cx: -20, fill: "var(--text-faint)", opacity: live ? 0 : 0.4 }}
          animate={live
            ? { cx: [-20, 1220], fill: ["#5b626c", "#5b626c", A, A], opacity: [0, 0.8, 0.8, 0] }
            : { cx: 900, fill: A, opacity: 0.4 }}
          transition={live ? { duration: d.dur, delay: d.delay, ...REPEAT, ease: "linear", times: [0, 0.48, 0.54, 1] } : undefined}
        />
      ))}
    </svg>
  );
}

/* ─── Six decisions: an interconnected system ──────────────────────────────
   A node mesh with signal pulses travelling along the edges. */

const NODES: [number, number][] = [
  [160, 110], [430, 80], [720, 130], [1010, 100],
  [300, 300], [600, 260], [880, 310], [1080, 280],
];
const EDGES: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [0, 4], [1, 5], [4, 5], [5, 6], [2, 6], [6, 7], [3, 7],
];
const PULSES = [0, 3, 6, 8];

export function NodeWeb() {
  const { ref, live } = useLive();
  return (
    <svg ref={ref} viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice" className="h-full w-full" aria-hidden>
      {EDGES.map(([a, b], i) => (
        <line key={i} x1={NODES[a]![0]} y1={NODES[a]![1]} x2={NODES[b]![0]} y2={NODES[b]![1]} stroke={LINE} strokeWidth="1" />
      ))}
      {PULSES.map((e, i) => {
        const [a, b] = EDGES[e]!;
        const [x1, y1] = NODES[a]!;
        const [x2, y2] = NODES[b]!;
        return (
          <motion.circle
            key={i} r="3" fill={A}
            initial={{ cx: x1, cy: y1, opacity: live ? 0 : 0.4 }}
            animate={live ? { cx: [x1, x2], cy: [y1, y2], opacity: [0, 0.9, 0] } : { cx: (x1 + x2) / 2, cy: (y1 + y2) / 2, opacity: 0.4 }}
            transition={live ? { duration: 3.5, delay: i * 0.9, ...REPEAT, ease: "easeInOut" } : undefined}
            style={{ filter: "drop-shadow(0 0 4px rgba(52,211,153,0.7))" }}
          />
        );
      })}
      {NODES.map(([cx, cy], i) => (
        <motion.circle
          key={i} cx={cx} cy={cy} r="4" fill="var(--text-faint)"
          initial={{ opacity: 0.6 }}
          animate={live ? { opacity: [0.4, 0.8, 0.4] } : { opacity: 0.6 }}
          transition={live ? { duration: 4, delay: i * 0.5, ...REPEAT, ease: "easeInOut" } : undefined}
        />
      ))}
    </svg>
  );
}

/* ─── Postgres: vector + lexical, fused by rank ────────────────────────────
   Two lanes flow in from the left and converge into a single ranked stream. */

const VEC_Y = 150;
const LEX_Y = 250;
const MID_Y = 200;
const FLOW = Array.from({ length: 6 }, (_, i) => i);

export function FusionStreams() {
  const { ref, live } = useLive();
  const lane = (laneY: number, delayBase: number, key: string) =>
    FLOW.map((i) => (
      <motion.circle
        key={`${key}${i}`} r="3.5" fill={A}
        initial={{ cx: -20, cy: laneY, opacity: live ? 0 : 0.35 }}
        animate={live
          ? { cx: [-20, 560, 760, 1220], cy: [laneY, laneY, MID_Y, MID_Y], opacity: [0, 0.7, 0.9, 0] }
          : { cx: 900, cy: MID_Y, opacity: 0.35 }}
        transition={live ? { duration: 7, delay: delayBase + i * 1.1, ...REPEAT, ease: "easeInOut", times: [0, 0.5, 0.66, 1] } : undefined}
      />
    ));
  return (
    <svg ref={ref} viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice" className="h-full w-full" aria-hidden>
      <line x1="0" y1={VEC_Y} x2="560" y2={VEC_Y} stroke={LINE} strokeWidth="1" />
      <line x1="0" y1={LEX_Y} x2="560" y2={LEX_Y} stroke={LINE} strokeWidth="1" />
      <path d={`M560 ${VEC_Y} Q680 ${VEC_Y} 760 ${MID_Y} L1200 ${MID_Y}`} fill="none" stroke={LINE} strokeWidth="1" />
      <path d={`M560 ${LEX_Y} Q680 ${LEX_Y} 760 ${MID_Y}`} fill="none" stroke={LINE} strokeWidth="1" />
      {lane(VEC_Y, 0, "v")}
      {lane(LEX_Y, 0.55, "l")}
    </svg>
  );
}

/* ─── Telegram: commits landing on a branch that merges into dev ───────────── */

const COMMITS = [120, 280, 440, 760, 920, 1080];
const MERGE_X = 600;
const MAIN_Y = 280;
const BRANCH_Y = 150;

export function CommitGraph() {
  const { ref, live } = useLive();
  return (
    <svg ref={ref} viewBox="0 0 1200 400" preserveAspectRatio="xMidYMid slice" className="h-full w-full" aria-hidden>
      <line x1="60" y1={MAIN_Y} x2="1140" y2={MAIN_Y} stroke={LINE} strokeWidth="1" />
      {/* feature branch arcs up off main and merges back at MERGE_X */}
      <motion.path
        d={`M440 ${MAIN_Y} C500 ${BRANCH_Y}, 540 ${BRANCH_Y}, ${MERGE_X} ${BRANCH_Y} L740 ${BRANCH_Y} C800 ${BRANCH_Y}, 840 ${MAIN_Y}, 900 ${MAIN_Y}`}
        fill="none" stroke={A} strokeWidth="1.5"
        initial={{ pathLength: live ? 0 : 1, opacity: 0.5 }}
        animate={live ? { pathLength: [0, 1, 1, 0] } : { pathLength: 1 }}
        transition={live ? { duration: 8, times: [0, 0.4, 0.85, 1], ...REPEAT, ease: "easeInOut" } : undefined}
      />
      {COMMITS.map((x, i) => (
        <motion.circle
          key={i} cx={x} cy={MAIN_Y} r="5" fill="var(--text-faint)"
          initial={{ opacity: live ? 0 : 0.6, scale: live ? 0 : 1 }}
          animate={live ? { opacity: [0, 1, 1, 0.4], scale: [0, 1.4, 1, 1] } : { opacity: 0.6, scale: 1 }}
          transition={live ? { duration: 6, delay: i * 0.7, ...REPEAT, ease: "easeOut" } : undefined}
          style={{ transformOrigin: `${x}px ${MAIN_Y}px` }}
        />
      ))}
      {/* the merge / PR node */}
      <motion.circle
        cx={900} cy={MAIN_Y} r="7" fill={A}
        initial={{ opacity: live ? 0.3 : 0.9, scale: 1 }}
        animate={live ? { opacity: [0.3, 0.3, 1, 0.5], scale: [1, 1, 1.6, 1] } : { opacity: 0.9, scale: 1.1 }}
        transition={live ? { duration: 8, times: [0, 0.75, 0.85, 1], ...REPEAT, ease: "easeInOut" } : undefined}
        style={{ transformOrigin: `900px ${MAIN_Y}px`, filter: "drop-shadow(0 0 6px rgba(52,211,153,0.8))" }}
      />
    </svg>
  );
}
