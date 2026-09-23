import type { ReactNode } from 'react';

/** Icon + text badge — tone class is never the only signal. */
export function Badge({
  tone,
  glyph,
  children,
  title,
}: {
  tone?: string;
  glyph: string;
  children: ReactNode;
  title?: string;
}) {
  return (
    <span className={`badge${tone ? ` ${tone}` : ''}`} title={title}>
      <span className="glyph" aria-hidden="true">
        {glyph}
      </span>
      {children}
    </span>
  );
}
