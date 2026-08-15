'use client';

import { useEffect, useState } from 'react';
import { API_URL } from '@/lib/api';
import { useAuth } from '@/lib/auth';

/**
 * `/snapshots/:filename` is behind the same JwtAuthGuard as every other
 * endpoint (README Section 20 Rule 5), so a plain <img src="..."> can't
 * authenticate - browsers don't send custom headers for image requests.
 * Fetch it with the token instead and render as a blob URL.
 */
export function SnapshotImage({
  filename,
  alt,
  className,
}: {
  filename: string;
  alt: string;
  className?: string;
}) {
  const { token } = useAuth();
  const [src, setSrc] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    let objectUrl: string | null = null;
    let cancelled = false;

    fetch(`${API_URL}/snapshots/${filename}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.blob() : Promise.reject(new Error('snapshot not found'))))
      .then((blob) => {
        if (cancelled) return;
        objectUrl = URL.createObjectURL(blob);
        setSrc(objectUrl);
      })
      .catch(() => setSrc(null));

    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [token, filename]);

  if (!src) {
    return <div className={`${className ?? ''} animate-pulse rounded bg-slate-700`} />;
  }

  // eslint-disable-next-line @next/next/no-img-element -- blob: URL, next/image can't optimize it
  return <img src={src} alt={alt} className={className} />;
}
