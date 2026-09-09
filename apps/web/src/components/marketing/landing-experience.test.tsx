import { cleanup, render } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { LandingExperience } from "./landing-experience";

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

test("reveals intersecting sections once and disconnects on navigation", () => {
  let notify: IntersectionObserverCallback;
  const observe = vi.fn(), unobserve = vi.fn(), disconnect = vi.fn();
  vi.stubGlobal("matchMedia", () => ({ matches: false }));
  vi.stubGlobal("IntersectionObserver", class {
    constructor(callback: IntersectionObserverCallback) { notify = callback; }
    observe = observe; unobserve = unobserve; disconnect = disconnect;
  });
  const view = render(<><section data-reveal>Readable before hydration</section><LandingExperience/></>);
  const section = view.getByText("Readable before hydration");
  expect(observe).toHaveBeenCalledWith(section);
  const entry = { target: section, isIntersecting: false, boundingClientRect: section.getBoundingClientRect(), intersectionRect: section.getBoundingClientRect(), rootBounds: null, intersectionRatio: 0, time: 0 };
  notify!([entry], {} as IntersectionObserver);
  expect(section).not.toHaveAttribute("data-visible");
  notify!([{ ...entry, isIntersecting: true }], {} as IntersectionObserver);
  expect(section).toHaveAttribute("data-visible", "true");
  expect(unobserve).toHaveBeenCalledWith(section);
  view.unmount();
  expect(disconnect).toHaveBeenCalledOnce();
});

test("leaves sections readable without observers when motion is reduced", () => {
  vi.stubGlobal("matchMedia", () => ({ matches: true }));
  const observer = vi.fn();
  vi.stubGlobal("IntersectionObserver", observer);
  const view = render(<><section data-reveal>Content</section><LandingExperience/></>);
  expect(view.getByText("Content")).toBeVisible();
  expect(observer).not.toHaveBeenCalled();
});
