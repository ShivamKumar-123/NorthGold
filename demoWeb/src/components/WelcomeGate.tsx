import WelcomeOverlay from '@/components/WelcomeOverlay';
import { useAuth } from '@/lib/auth';

/**
 * Feeds the welcome curtain the signed-in member's name, if there is one.
 *
 * Deliberately does NOT wait for the auth context to settle. `loading` flips
 * in a passive effect, which React runs after the browser has already painted
 * — gating on it meant the page appeared first and the curtain then dropped
 * over it, which reads as a glitch rather than an intro. The overlay mounts on
 * the very first render instead, and the name simply arrives in time for the
 * greeting, which does not play until about a second in.
 *
 * Split from the overlay so the overlay stays a pure presentational piece with
 * no dependency on the auth context — which is what lets the Next build mount
 * the same file from a different provider.
 */
export default function WelcomeGate() {
  const { user } = useAuth();
  return <WelcomeOverlay name={user?.first_name || undefined} />;
}
