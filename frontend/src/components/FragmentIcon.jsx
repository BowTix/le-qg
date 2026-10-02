import React from 'react';
import { Boxes } from 'lucide-react';

/**
 * FragmentIcon - Crafting currency icon for Fragments using Lucide Boxes.
 */
export default function FragmentIcon({ size = 16, className = '', color = 'currentColor', style = {} }) {
  return (
    <Boxes
      size={size}
      className={`fragment-icon ${className}`.trim()}
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
