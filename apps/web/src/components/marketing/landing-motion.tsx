"use client";

import { useEffect } from "react";

const clamp = (value: number, min = 0, max = 1) => Math.min(max, Math.max(min, value));

export function LandingMotion() {
  useEffect(() => {
    const root = document.querySelector<HTMLElement>(".sr-site-v2");
    if (!root) return;

    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const revealNodes = Array.from(root.querySelectorAll<HTMLElement>("[data-reveal]"));
    const parallaxNodes = Array.from(root.querySelectorAll<HTMLElement>("[data-parallax]"));
    const demo = root.querySelector<HTMLElement>(".sr-v2-demo-wrap");

    if (reduceMotion) {
      revealNodes.forEach((node) => node.classList.add("is-revealed"));
      root.style.setProperty("--sr-scroll", "1");
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            (entry.target as HTMLElement).classList.add("is-revealed");
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.14, rootMargin: "0px 0px -8% 0px" },
    );

    revealNodes.forEach((node) => observer.observe(node));

    let frame = 0;
    const updateScrollEffects = () => {
      frame = 0;
      const scrollTop = window.scrollY;
      const maxScroll = Math.max(1, document.documentElement.scrollHeight - window.innerHeight);
      const progress = clamp(scrollTop / maxScroll);
      const heroProgress = clamp(scrollTop / Math.max(520, window.innerHeight * 0.92));

      root.style.setProperty("--sr-scroll", progress.toFixed(4));
      root.style.setProperty("--sr-hero-progress", heroProgress.toFixed(4));

      parallaxNodes.forEach((node) => {
        const rect = node.getBoundingClientRect();
        const center = rect.top + rect.height / 2;
        const viewportCenter = window.innerHeight / 2;
        const distance = clamp((center - viewportCenter) / window.innerHeight, -1, 1);
        node.style.setProperty("--sr-parallax", distance.toFixed(4));
      });
    };

    const requestScrollUpdate = () => {
      if (frame) return;
      frame = window.requestAnimationFrame(updateScrollEffects);
    };

    const onPointerMove = (event: PointerEvent) => {
      if (!demo || event.pointerType === "touch") return;
      const rect = demo.getBoundingClientRect();
      const x = clamp((event.clientX - rect.left) / rect.width);
      const y = clamp((event.clientY - rect.top) / rect.height);
      demo.style.setProperty("--sr-pointer-x", x.toFixed(4));
      demo.style.setProperty("--sr-pointer-y", y.toFixed(4));
      demo.style.setProperty("--sr-tilt-x", ((0.5 - y) * 4.5).toFixed(2));
      demo.style.setProperty("--sr-tilt-y", ((x - 0.5) * 6).toFixed(2));
    };

    const resetPointer = () => {
      if (!demo) return;
      demo.style.setProperty("--sr-pointer-x", "0.5");
      demo.style.setProperty("--sr-pointer-y", "0.5");
      demo.style.setProperty("--sr-tilt-x", "0");
      demo.style.setProperty("--sr-tilt-y", "0");
    };

    window.addEventListener("scroll", requestScrollUpdate, { passive: true });
    window.addEventListener("resize", requestScrollUpdate, { passive: true });
    demo?.addEventListener("pointermove", onPointerMove);
    demo?.addEventListener("pointerleave", resetPointer);
    updateScrollEffects();

    return () => {
      observer.disconnect();
      window.removeEventListener("scroll", requestScrollUpdate);
      window.removeEventListener("resize", requestScrollUpdate);
      demo?.removeEventListener("pointermove", onPointerMove);
      demo?.removeEventListener("pointerleave", resetPointer);
      if (frame) window.cancelAnimationFrame(frame);
    };
  }, []);

  return (
    <>
      <div className="sr-v2-scroll-progress" aria-hidden="true"><i /></div>
      <div className="sr-v2-film-grain" aria-hidden="true" />
    </>
  );
}
