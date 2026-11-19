export function isPathPrefix(pathname: string, href: string): boolean {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

export function isRouteActive(pathname: string, href: string, allHrefs: string[]): boolean {
  if (!isPathPrefix(pathname, href)) return false;

  let longest = href;
  for (const candidate of allHrefs) {
    if (candidate.length > longest.length && isPathPrefix(pathname, candidate)) {
      longest = candidate;
    }
  }
  return longest === href;
}

export function isWithinSection(pathname: string, href: string): boolean {
  return isPathPrefix(pathname, href);
}
