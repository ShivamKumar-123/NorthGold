import { openSteps } from '@/lib/welcomeSignal';

/**
 * Reopens the four-steps panel.
 *
 * Its own component because the landing page is a server component in the
 * Next build, and a server component cannot carry an event handler. Keeping
 * the button here is what lets both builds share the same page markup.
 */
export default function OpenStepsButton({
  children,
  className = 'btn-ghost px-7 py-3.5 text-base',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <button type="button" onClick={openSteps} className={className}>
      {children}
    </button>
  );
}
