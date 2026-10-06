"use client";
import { useEffect, useRef, useState } from "react";
import { scrollStep, type Direction } from "@/lib/scroll";
export function useAutoScroll() {
  const [enabled, setEnabled] = useState(true);
  const [speed, setSpeed] = useState("normal");
  const [reduced, setReduced] = useState(false);
  const [status, setStatus] = useState("مهلة للقراءة");
  const direction = useRef<Direction>(1);
  const idleUntil = useRef(0);
  const config = useRef({ enabled, speed, reduced });
  config.current = { enabled, speed, reduced };
  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const motion = () => {
      setReduced(media.matches);
      if (media.matches) setEnabled(false);
    };
    motion();
    media.addEventListener("change", motion);
    let frame = 0,
      last = 0,
      edgeUntil = 0,
      fraction = 0,
      previousStatus = "";
    idleUntil.current = performance.now() + 10000;
    const interact = () => {
      idleUntil.current = performance.now() + 10000;
      fraction = 0;
    };
    const visibility = () => {
      last = 0;
      interact();
    };
    const events = [
      "wheel",
      "touchstart",
      "touchmove",
      "pointerdown",
      "keydown",
      "focusin",
    ] as const;
    for (const e of events)
      window.addEventListener(e, interact, { passive: true });
    document.addEventListener("visibilitychange", visibility);
    function tick(now: number) {
      const delta = Math.min(last ? now - last : 0, 50);
      last = now;
      const { enabled, speed, reduced } = config.current;
      const focused = document.activeElement?.matches(
        'input,select,textarea,button,a,[contenteditable="true"]',
      );
      const paused =
        !enabled ||
        reduced ||
        document.hidden ||
        focused ||
        now < idleUntil.current ||
        now < edgeUntil;
      const label = !enabled
        ? "متوقف يدويًا"
        : reduced
          ? "تقليل الحركة مفعّل"
          : document.hidden
            ? "متوقف في الخلفية"
            : focused || now < idleUntil.current
              ? "مهلة للقراءة"
              : now < edgeUntil
                ? "استراحة عند الطرف"
                : direction.current === 1
                  ? "تمرير إلى الأسفل"
                  : "تمرير إلى الأعلى";
      if (label !== previousStatus) {
        setStatus(label);
        previousStatus = label;
      }
      if (!paused) {
        const max = Math.max(
          0,
          document.documentElement.scrollHeight - window.innerHeight,
        );
        const rate = speed === "slow" ? 16 : speed === "fast" ? 64 : 32;
        fraction += (rate * delta) / 1000;
        if (fraction >= 1 && max > 0) {
          const distance = Math.floor(fraction);
          fraction -= distance;
          const step = scrollStep(
            window.scrollY,
            max,
            direction.current,
            distance,
          );
          window.scrollTo({ top: step.position, behavior: "instant" });
          direction.current = step.direction;
          if (step.boundary) edgeUntil = now + 3000;
        }
      }
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      media.removeEventListener("change", motion);
      document.removeEventListener("visibilitychange", visibility);
      for (const e of events) window.removeEventListener(e, interact);
    };
  }, []);
  return {
    enabled,
    speed,
    setSpeed,
    status,
    reduced,
    toggle: () => {
      idleUntil.current = performance.now() + 1000;
      setEnabled((v) => !v);
    },
  };
}
