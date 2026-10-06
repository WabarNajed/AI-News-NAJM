"use client";
import { useEffect, useRef, useState } from "react";
import { scrollStep, type Direction } from "@/lib/scroll";

export function useAutoScroll(ready: boolean, section: string) {
  const [enabled, setEnabled] = useState(true);
  const [speed, setSpeed] = useState("normal");
  const [reduced, setReduced] = useState(false);
  const [status, setStatus] = useState("بانتظار المحتوى");
  const idleUntil = useRef(0);
  const config = useRef({ enabled, speed, reduced, ready, section });
  config.current = { enabled, speed, reduced, ready, section };

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const motion = () => { setReduced(media.matches); if (media.matches) setEnabled(false); };
    motion();
    media.addEventListener("change", motion);
    let frame = 0, last = 0, edgeUntil = 0, fraction = 0, previousStatus = "", previousReady = false, previousSection = "";
    let direction: Direction = 1;
    const interact = (event: Event) => {
      if (!event.isTrusted) return;
      if (event instanceof KeyboardEvent && ["Shift", "Control", "Alt", "Meta"].includes(event.key)) return;
      idleUntil.current = performance.now() + 6000;
      fraction = 0;
    };
    const visibility = () => {
      last = 0;
      if (!document.hidden) idleUntil.current = Math.max(idleUntil.current, performance.now() + 1500);
    };
    const events = ["wheel", "touchstart", "touchmove", "pointerdown", "keydown", "input", "change"] as const;
    for (const event of events) window.addEventListener(event, interact, { passive: true });
    document.addEventListener("visibilitychange", visibility);
    function tick(now: number) {
      const delta = Math.min(last ? now - last : 0, 64);
      last = now;
      const { enabled, speed, reduced, ready, section } = config.current;
      if (ready && (!previousReady || section !== previousSection)) {
        idleUntil.current = Math.max(idleUntil.current, now + 3000);
        edgeUntil = 0;
        fraction = 0;
      }
      previousReady = ready;
      previousSection = section;
      const scroller = document.scrollingElement;
      const max = scroller ? Math.max(0, scroller.scrollHeight - scroller.clientHeight) : 0;
      const label = !enabled ? reduced ? "تقليل الحركة · التشغيل اختياري" : "متوقف يدويًا"
        : document.hidden ? "متوقف في الخلفية"
        : !ready ? "بانتظار المحتوى"
        : max <= 1 ? "المحتوى ظاهر بالكامل؛ لا حاجة للتمرير"
        : now < idleUntil.current ? "مهلة للقراءة"
        : now < edgeUntil ? "استراحة عند الطرف"
        : direction === 1 ? "تمرير إلى الأسفل" : "تمرير إلى الأعلى";
      if (label !== previousStatus) { setStatus(label); previousStatus = label; }
      if (enabled && ready && !document.hidden && scroller && max > 1 && now >= idleUntil.current && now >= edgeUntil) {
        const rate = speed === "slow" ? 18 : speed === "fast" ? 90 : 42;
        fraction += rate * delta / 1000;
        if (fraction >= 1) {
          const distance = Math.floor(fraction);
          fraction -= distance;
          const step = scrollStep(scroller.scrollTop, max, direction, distance);
          scroller.scrollTo({ top: step.position, behavior: "instant" });
          direction = step.direction;
          if (step.boundary) { edgeUntil = now + 2500; fraction = 0; }
        }
      }
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(frame);
      media.removeEventListener("change", motion);
      document.removeEventListener("visibilitychange", visibility);
      for (const event of events) window.removeEventListener(event, interact);
    };
  }, []);
  return {
    enabled, speed, setSpeed, status, reduced,
    toggle: () => { idleUntil.current = performance.now() + 1200; setEnabled((value) => !value); },
  };
}
