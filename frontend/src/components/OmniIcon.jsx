import React from 'react';
import { Aperture } from 'lucide-react';

/**
 * OmniIcon - Currency icon for Omnia ("Omnis") using Lucide Aperture.
 */
export default function OmniIcon({ size = 16, className = '', color = 'currentColor', style = {} }) {
  return (
    <Aperture
      size={size}
      className={`omni-icon ${className}`.trim()}
      style={{
        display: 'inline-block',
        verticalAlign: '-0.15em',
        flexShrink: 0,
        color,
        ...style
      }}
      aria-hidden="true"
    />
  );
}
