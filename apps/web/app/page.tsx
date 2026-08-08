/**
 * The front door.
 *
 * This used to be the scaffold page the repository was born with — "A solid
 * foundation, ready to build on", a list of engineering practices. Accurate on
 * day one and badly wrong now: the ERP has existed for months at
 * `/workspace/…`, and nothing anywhere pointed at it. Somebody signing in
 * landed on a page about version control and reasonably concluded the system
 * was not there.
 *
 * So `/` is not a page, it is a signpost. The workspace itself is static HTML
 * served from `public/workspace`, which is why this is a redirect rather than a
 * component: there is nothing to render here that is not already there.
 */
import { redirect } from "next/navigation";

/** The launchpad — "Canei Subirats — Plataforma de gestión". */
const WORKSPACE = "/workspace/index.html";

export default function Home() {
  redirect(WORKSPACE);
}
