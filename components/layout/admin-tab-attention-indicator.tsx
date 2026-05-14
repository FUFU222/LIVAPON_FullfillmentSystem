'use client';

import { useEffect } from 'react';

const DEFAULT_ICON_HREF = '/icon';

function resolveIconLink(): HTMLLinkElement {
  const existing = document.querySelector<HTMLLinkElement>('link[rel~="icon"]');
  if (existing) {
    return existing;
  }

  const link = document.createElement('link');
  link.rel = 'icon';
  link.type = 'image/png';
  link.href = DEFAULT_ICON_HREF;
  document.head.appendChild(link);
  return link;
}

function drawAttentionIcon(baseHref: string, link: HTMLLinkElement, cancelled: () => boolean) {
  if (typeof window === 'undefined' || typeof window.Image === 'undefined') {
    return;
  }

  const image = new window.Image();
  image.decoding = 'async';

  image.onload = () => {
    if (cancelled()) {
      return;
    }

    const canvas = document.createElement('canvas');
    canvas.width = 64;
    canvas.height = 64;
    const context = canvas.getContext('2d');

    if (!context) {
      return;
    }

    context.drawImage(image, 0, 0, 64, 64);
    context.beginPath();
    context.arc(49, 15, 12, 0, Math.PI * 2);
    context.fillStyle = '#ffffff';
    context.fill();
    context.beginPath();
    context.arc(49, 15, 8, 0, Math.PI * 2);
    context.fillStyle = '#dc2626';
    context.fill();

    link.href = canvas.toDataURL('image/png');
  };

  image.onerror = () => {
    if (!cancelled()) {
      link.href = baseHref;
    }
  };

  image.src = baseHref;
}

export function AdminTabAttentionIndicator({ active }: { active: boolean }) {
  useEffect(() => {
    const link = resolveIconLink();
    const originalHref =
      link.dataset.livaponOriginalHref || link.getAttribute('href') || DEFAULT_ICON_HREF;
    link.dataset.livaponOriginalHref = originalHref;

    let isCancelled = false;

    if (!active) {
      link.href = originalHref;
      return () => {
        isCancelled = true;
      };
    }

    drawAttentionIcon(originalHref, link, () => isCancelled);

    return () => {
      isCancelled = true;
      link.href = originalHref;
    };
  }, [active]);

  return null;
}
