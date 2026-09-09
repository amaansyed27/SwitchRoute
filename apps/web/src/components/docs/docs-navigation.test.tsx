import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vitest";
import { DocsNav } from "./docs-nav";
import { DocsArticle } from "./docs-article";

vi.mock("next/navigation", () => ({ usePathname: () => "/docs/routes" }));
afterEach(cleanup);

test("highlights the current guide and filters navigation with an empty state", () => {
  render(<DocsNav/>);
  expect(screen.getByRole("link", { name: "Routes & strategies" })).toHaveAttribute("aria-current", "page");
  fireEvent.change(screen.getByRole("searchbox", { name: "Find a guide" }), { target: { value: "Python" } });
  expect(screen.getByRole("link", { name: "Python SDK" })).toBeVisible();
  expect(screen.queryByRole("link", { name: "Routes & strategies" })).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole("searchbox"), { target: { value: "no-such-guide" } });
  expect(screen.getByRole("status")).toHaveTextContent("No guides match");
});

test("creates unique section links for the article headings", async () => {
  render(<DocsArticle><h1>Guide</h1><h2>Setup</h2><h2>Setup</h2></DocsArticle>);
  await waitFor(() => expect(screen.getAllByRole("link", { name: "Setup" })).toHaveLength(2));
  const headings = screen.getAllByRole("heading", { level: 2 });
  expect(headings[0].id).toBe("setup");
  expect(headings[1].id).toBe("setup-2");
  expect(screen.getAllByRole("link", { name: "Setup" })[1]).toHaveAttribute("href", "#setup-2");
});
