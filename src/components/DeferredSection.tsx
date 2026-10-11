import React, { useEffect, useRef, useState } from 'react';

interface DeferredSectionProps {
  children: React.ReactNode;
  estimatedHeight?: number;
  rootMargin?: string;
  className?: string;
}

/**
 * Keeps below-the-fold React.lazy chunks out of the initial render path.
 * The child element is created by React but is not reconciled until the
 * wrapper is near the viewport, so its dynamic import is deferred too.
 */
export const DeferredSection: React.FC<DeferredSectionProps> = ({
  children,
  estimatedHeight = 600,
  rootMargin = '800px 0px',
  className = '',
}) => {
  const hostRef = useRef<HTMLDivElement | null>(null);
  const [shouldRender, setShouldRender] = useState(false);

  useEffect(() => {
    if (shouldRender || !hostRef.current) return;

    const element = hostRef.current;
    if (!('IntersectionObserver' in window)) {
      setShouldRender(true);
      return;
    }

    const observer = new IntersectionObserver(
      entries => {
        if (entries.some(entry => entry.isIntersecting)) {
          setShouldRender(true);
          observer.disconnect();
        }
      },
      { rootMargin, threshold: 0.01 },
    );

    observer.observe(element);
    return () => observer.disconnect();
  }, [rootMargin, shouldRender]);

  return (
    <div
      ref={hostRef}
      className={className}
      style={{ containIntrinsicSize: `${Math.max(1, estimatedHeight)}px` }}
    >
      {shouldRender ? children : null}
    </div>
  );
};
