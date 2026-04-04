"use client";

import { motion, useInView, useSpring, useMotionValue, useTransform, type Variants } from "framer-motion";
import { useRef, useEffect, useState, type ReactNode } from "react";

// ============================================
// ANIMATION VARIANTS
// ============================================

export const fadeInUp: Variants = {
  hidden: { opacity: 0, y: 20 },
  visible: { opacity: 1, y: 0 },
};

export const fadeIn: Variants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1 },
};

export const fadeInScale: Variants = {
  hidden: { opacity: 0, scale: 0.95 },
  visible: { opacity: 1, scale: 1 },
};

export const slideInLeft: Variants = {
  hidden: { opacity: 0, x: -30 },
  visible: { opacity: 1, x: 0 },
};

export const slideInRight: Variants = {
  hidden: { opacity: 0, x: 30 },
  visible: { opacity: 1, x: 0 },
};

export const staggerContainer: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.1,
    },
  },
};

export const staggerContainerFast: Variants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.05,
    },
  },
};

// ============================================
// MOTION WRAPPER — Scroll-triggered fade in
// ============================================

interface MotionSectionProps {
  children: ReactNode;
  className?: string;
  variants?: Variants;
  delay?: number;
}

export function MotionSection({ children, className, variants = fadeInUp, delay = 0 }: MotionSectionProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-60px" });

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      variants={variants}
      transition={{ duration: 0.5, ease: [0.25, 0.1, 0.25, 1], delay }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ============================================
// STAGGER GROUP — Children animate in sequence
// ============================================

interface StaggerGroupProps {
  children: ReactNode;
  className?: string;
  fast?: boolean;
}

export function StaggerGroup({ children, className, fast }: StaggerGroupProps) {
  const ref = useRef<HTMLDivElement>(null);
  const isInView = useInView(ref, { once: true, margin: "-40px" });

  return (
    <motion.div
      ref={ref}
      initial="hidden"
      animate={isInView ? "visible" : "hidden"}
      variants={fast ? staggerContainerFast : staggerContainer}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ============================================
// STAGGER ITEM — Used inside StaggerGroup
// ============================================

interface StaggerItemProps {
  children: ReactNode;
  className?: string;
}

export function StaggerItem({ children, className }: StaggerItemProps) {
  return (
    <motion.div
      variants={fadeInUp}
      transition={{ duration: 0.4, ease: [0.25, 0.1, 0.25, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ============================================
// ANIMATED COUNTER — Counts up to target value
// ============================================

interface AnimatedCounterProps {
  value: number;
  duration?: number;
  suffix?: string;
  prefix?: string;
  className?: string;
}

export function AnimatedCounter({ value, duration = 1.2, suffix = "", prefix = "", className }: AnimatedCounterProps) {
  const ref = useRef<HTMLSpanElement>(null);
  const isInView = useInView(ref, { once: true });
  const motionValue = useMotionValue(0);
  const springValue = useSpring(motionValue, { duration: duration * 1000, bounce: 0 });
  const display = useTransform(springValue, (v) => `${prefix}${Math.round(v).toLocaleString()}${suffix}`);

  useEffect(() => {
    if (isInView) {
      motionValue.set(value);
    }
  }, [isInView, value, motionValue]);

  return <motion.span ref={ref} className={className}>{display}</motion.span>;
}

// ============================================
// HOVER SCALE — Subtle scale on hover
// ============================================

interface HoverScaleProps {
  children: ReactNode;
  className?: string;
  scale?: number;
}

export function HoverScale({ children, className, scale = 1.02 }: HoverScaleProps) {
  return (
    <motion.div
      whileHover={{ scale, transition: { duration: 0.2 } }}
      whileTap={{ scale: 0.98 }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ============================================
// PAGE TRANSITION — Wrap page content
// ============================================

interface PageTransitionProps {
  children: ReactNode;
  className?: string;
}

export function PageTransition({ children, className }: PageTransitionProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.25, 0.1, 0.25, 1] }}
      className={className}
    >
      {children}
    </motion.div>
  );
}

// ============================================
// PARALLAX — Subtle parallax scroll effect
// ============================================

interface ParallaxProps {
  children: ReactNode;
  className?: string;
  speed?: number;
}

export function Parallax({ children, className, speed = 0.3 }: ParallaxProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState(0);

  useEffect(() => {
    function handleScroll() {
      if (!ref.current) return;
      const rect = ref.current.getBoundingClientRect();
      const scrollProgress = (window.innerHeight - rect.top) / (window.innerHeight + rect.height);
      setOffset((scrollProgress - 0.5) * 100 * speed);
    }
    window.addEventListener("scroll", handleScroll, { passive: true });
    handleScroll();
    return () => window.removeEventListener("scroll", handleScroll);
  }, [speed]);

  return (
    <div ref={ref} className={className}>
      <div style={{ transform: `translateY(${offset}px)`, transition: "transform 0.1s linear" }}>
        {children}
      </div>
    </div>
  );
}

// ============================================
// GLOW FOLLOW — Cursor-following glow effect
// ============================================

interface GlowCardProps {
  children: ReactNode;
  className?: string;
}

export function GlowCard({ children, className }: GlowCardProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [mousePos, setMousePos] = useState({ x: 0, y: 0 });
  const [isHovered, setIsHovered] = useState(false);

  function handleMouseMove(e: React.MouseEvent) {
    if (!ref.current) return;
    const rect = ref.current.getBoundingClientRect();
    setMousePos({ x: e.clientX - rect.left, y: e.clientY - rect.top });
  }

  return (
    <div
      ref={ref}
      className={`relative overflow-hidden ${className ?? ""}`}
      onMouseMove={handleMouseMove}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {isHovered && (
        <div
          className="absolute pointer-events-none z-0 transition-opacity duration-300"
          style={{
            width: 300,
            height: 300,
            left: mousePos.x - 150,
            top: mousePos.y - 150,
            background: "radial-gradient(circle, rgba(124, 58, 237, 0.08), transparent 70%)",
            opacity: 1,
          }}
        />
      )}
      <div className="relative z-10">{children}</div>
    </div>
  );
}

// Re-export motion for direct use
export { motion };
