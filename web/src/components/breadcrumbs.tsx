import Link from "next/link";
import { JsonLd } from "./jsonld";
import { breadcrumbLd } from "@/lib/seo";

export interface Crumb {
  name: string;
  path: string;
}

export function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <>
      <nav aria-label="현재 위치" className="text-xs text-ink-faint">
        <ol className="flex flex-wrap items-center gap-1">
          {crumbs.map((c, i) => (
            <li key={c.path} className="flex items-center gap-1">
              {i > 0 && <span aria-hidden>›</span>}
              {i === crumbs.length - 1 ? (
                <span className="text-ink-soft">{c.name}</span>
              ) : (
                <Link href={c.path} className="hover:text-ink">
                  {c.name}
                </Link>
              )}
            </li>
          ))}
        </ol>
      </nav>
      <JsonLd data={breadcrumbLd(crumbs)} />
    </>
  );
}
