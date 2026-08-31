import Link from "next/link";

export function Brand({ href = "/" }: { href?: string }) {
  return (
    <Link className="brand" href={href} aria-label="SwitchRoute home">
      <span className="brand-mark" aria-hidden="true" />
      SWITCHROUTE
    </Link>
  );
}
