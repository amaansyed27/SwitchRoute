import { DocsArticle } from "@/components/docs/docs-article";

export default function DocsTemplate({ children }: { children: React.ReactNode }) {
  return <DocsArticle>{children}</DocsArticle>;
}
