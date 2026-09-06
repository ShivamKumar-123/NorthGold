/**
 * Splits a phrase into per-word spans so GSAP can slide each one up from
 * behind a mask.
 *
 * Done in markup rather than with GSAP's SplitText because the split has to
 * exist in the server-rendered HTML: splitting after hydration reflows the
 * headline a frame late, which on a `text-balance` display heading is a
 * visible jump. Each word sits in an `overflow-hidden` box — that box is the
 * mask the word rises out of.
 *
 * Every word keeps a trailing space inside the inline-block, so selecting and
 * copying the headline still yields normal text.
 */
export default function SplitWords({
  text,
  className = '',
}: {
  text: string;
  className?: string;
}) {
  return (
    <>
      {text.split(' ').map((word, i) => (
        <span
          key={`${word}-${i}`}
          className="inline-block overflow-hidden align-bottom [padding-bottom:0.12em] [margin-bottom:-0.12em]"
        >
          <span className={`word inline-block ${className}`}>
            {word}
            {i < text.split(' ').length - 1 ? '\u00A0' : ''}
          </span>
        </span>
      ))}
    </>
  );
}
