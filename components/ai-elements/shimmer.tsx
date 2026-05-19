"use client";

import { cn } from "@/lib/utils";
import type { MotionProps } from "motion/react";
import { motion } from "motion/react";
import type { CSSProperties, ElementType } from "react";
import { memo, useMemo } from "react";

type MotionHTMLProps = MotionProps & Record<string, unknown>;

// All motion components created at module level — never during render
const MOTION_ELEMENTS = {
  p:    motion.create("p"),
  span: motion.create("span"),
  div:  motion.create("div"),
  h1:   motion.create("h1"),
  h2:   motion.create("h2"),
  h3:   motion.create("h3"),
  h4:   motion.create("h4"),
  h5:   motion.create("h5"),
  h6:   motion.create("h6"),
} satisfies Record<string, React.ComponentType<MotionHTMLProps>>;

type MotionElement = keyof typeof MOTION_ELEMENTS;

export interface TextShimmerProps {
  children: string;
  as?: ElementType;
  className?: string;
  duration?: number;
  spread?: number;
}

const ShimmerComponent = ({
  children,
  as: Component = "p",
  className,
  duration = 2,
  spread = 2,
}: TextShimmerProps) => {
  const MotionComponent =
    MOTION_ELEMENTS[(Component as MotionElement)] ?? MOTION_ELEMENTS.p;

  const dynamicSpread = useMemo(
    () => (children?.length ?? 0) * spread,
    [children, spread]
  );

  return (
    <MotionComponent
      animate={{ backgroundPosition: "0% center" }}
      className={cn(
        "relative inline-block bg-size-[250%_100%,auto] bg-clip-text text-transparent",
        "[--bg:linear-gradient(90deg,#0000_calc(50%-var(--spread)),var(--color-background),#0000_calc(50%+var(--spread)))] [background-repeat:no-repeat,padding-box]",
        className
      )}
      initial={{ backgroundPosition: "100% center" }}
      style={
        {
          "--spread": `${dynamicSpread}px`,
          backgroundImage:
            "var(--bg), linear-gradient(var(--color-muted-foreground), var(--color-muted-foreground))",
        } as CSSProperties
      }
      transition={{
        duration,
        ease: "linear",
        repeat: Number.POSITIVE_INFINITY,
      }}
    >
      {children}
    </MotionComponent>
  );
};

export const Shimmer = memo(ShimmerComponent);
