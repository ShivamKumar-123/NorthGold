import { Link } from 'react-router-dom';
import { ArrowLeft, Compass } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="mx-auto flex min-h-[70vh] max-w-lg flex-col items-center justify-center px-4 text-center">
      <span className="grid h-14 w-14 place-items-center rounded-2xl border border-border bg-white/[0.04] text-accent shadow-e1">
        <Compass size={24} />
      </span>
      <h1 className="mt-6 text-display-sm font-semibold text-3d">Nothing here</h1>
      <p className="mt-3 leading-relaxed text-text-muted">
        That address does not match a page on this demo.
      </p>
      <Link to="/" className="btn-primary mt-8 px-6 py-3.5">
        <ArrowLeft size={16} /> Back to the landing page
      </Link>
    </div>
  );
}
