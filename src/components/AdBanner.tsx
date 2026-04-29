'use client';

import { useEffect, useRef, useState } from 'react';

type AdBannerProps = {
  dataAdSlot: string;
  dataAdFormat?: string;
  dataFullWidthResponsive?: boolean;
};

export default function AdBanner({ 
  dataAdSlot, 
  dataAdFormat = 'auto', 
  dataFullWidthResponsive = true 
}: AdBannerProps) {
  const adRef = useRef<HTMLModElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    // Only try to load ad if container has width > 0 
    // to prevent "No slot size for availableWidth=0"
    const timer = setTimeout(() => {
      if (containerRef.current && containerRef.current.offsetWidth > 0) {
        setIsReady(true);
      }
    }, 150);

    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!isReady) return;

    try {
      if (adRef.current && !adRef.current.hasAttribute('data-adsbygoogle-status')) {
        // @ts-ignore
        if (window.adsbygoogle) {
          // @ts-ignore
          window.adsbygoogle.push({});
        }
      }
    } catch (err: any) {
      if (!err.message?.includes('already have ads')) {
        console.error('AdSense Error:', err?.message || String(err));
      }
    }
  }, [isReady]);

  return (
    <div ref={containerRef} className="w-full overflow-hidden flex justify-center items-center my-4 min-h-[50px] min-w-[300px]">
      <ins
        ref={adRef}
        className="adsbygoogle"
        style={{ display: 'block', minWidth: '300px', width: '100%' }}
        data-ad-client="ca-pub-7509073601077347"
        data-ad-slot={dataAdSlot}
        data-ad-format={dataAdFormat}
        data-full-width-responsive={dataFullWidthResponsive.toString()}
      />
    </div>
  );
}
