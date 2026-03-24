import { useEffect, useState } from 'react';

export type CustomerRequestResponsiveLayoutMode =
  | 'mobile'
  | 'tablet'
  | 'desktopCompact'
  | 'desktopWide';

const resolveLayoutMode = (width: number): CustomerRequestResponsiveLayoutMode => {
  if (width < 768) {
    return 'mobile';
  }

  if (width < 1280) {
    return 'tablet';
  }

  if (width < 1536) {
    return 'desktopCompact';
  }

  return 'desktopWide';
};

const readWindowWidth = (): number => {
  if (typeof window === 'undefined') {
    return 1536;
  }

  return Math.max(window.innerWidth || 0, 0);
};

export const useCustomerRequestResponsiveLayout = (): CustomerRequestResponsiveLayoutMode => {
  const [layoutMode, setLayoutMode] = useState<CustomerRequestResponsiveLayoutMode>(() =>
    resolveLayoutMode(readWindowWidth())
  );

  useEffect(() => {
    const handleResize = () => {
      setLayoutMode(resolveLayoutMode(readWindowWidth()));
    };

    handleResize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  return layoutMode;
};

export const resolveCustomerRequestResponsiveLayoutMode = (
  width: number
): CustomerRequestResponsiveLayoutMode => resolveLayoutMode(width);
