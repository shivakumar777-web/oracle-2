import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[70vh] gap-6 px-6 text-center">
      <div className="text-6xl font-ui font-light text-gold/20">404</div>
      <div className="diamond-sep">
        <span /><span /><span />
      </div>
      <h1 className="font-ui text-lg tracking-[0.2em] uppercase text-cream/40">
        This page has not been churned
      </h1>
      <p className="font-body text-sm italic text-cream/25 max-w-sm">
        The knowledge you seek has not yet been extracted from the ocean.
        Return to the Oracle.
      </p>
      <Link href="/" className="btn-gold">
        Return to Oracle ✦
      </Link>
    </div>
  );
}
