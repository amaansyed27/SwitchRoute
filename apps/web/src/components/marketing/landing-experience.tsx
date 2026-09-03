"use client";

import { useEffect } from "react";

export function LandingExperience() {
  useEffect(() => {
    const root = document.documentElement;
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
    const reveals = Array.from(document.querySelectorAll<HTMLElement>("[data-reveal]"));
    const parallax = Array.from(document.querySelectorAll<HTMLElement>("[data-parallax]"));

    if (reducedMotion.matches) {
      reveals.forEach((element) => { element.dataset.visible = "true"; });
      return;
    }

    const observer = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          (entry.target as HTMLElement).dataset.visible = "true";
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });

    reveals.forEach((element) => observer.observe(element));

    let frame = 0;
    const updateScroll = () => {
      frame = 0;
      const viewport = window.innerHeight || 1;
      const max = Math.max(document.documentElement.scrollHeight - viewport, 1);
      root.style.setProperty("--page-scroll", String(window.scrollY / max));

      parallax.forEach((element) => {
        const rect = element.getBoundingClientRect();
        const center = rect.top + rect.height / 2;
        const delta = (center - viewport / 2) / viewport;
        const speed = Number(element.dataset.parallax ?? "24");
        const offset = Math.max(-1.5, Math.min(1.5, delta)) * speed * -1;
        element.style.setProperty("--parallax-offset", `${offset.toFixed(2)}px`);
      });
    };

    const scheduleScroll = () => {
      if (!frame) frame = window.requestAnimationFrame(updateScroll);
    };

    const updatePointer = (event: PointerEvent) => {
      root.style.setProperty("--pointer-x", `${event.clientX}px`);
      root.style.setProperty("--pointer-y", `${event.clientY}px`);
    };

    updateScroll();
    window.addEventListener("scroll", scheduleScroll, { passive: true });
    window.addEventListener("resize", scheduleScroll);
    window.addEventListener("pointermove", updatePointer, { passive: true });

    return () => {
      observer.disconnect();
      if (frame) window.cancelAnimationFrame(frame);
      window.removeEventListener("scroll", scheduleScroll);
      window.removeEventListener("resize", scheduleScroll);
      window.removeEventListener("pointermove", updatePointer);
      parallax.forEach((element) => element.style.removeProperty("--parallax-offset"));
      root.style.removeProperty("--page-scroll");
      root.style.removeProperty("--pointer-x");
      root.style.removeProperty("--pointer-y");
    };
  }, []);

  return null;
}
