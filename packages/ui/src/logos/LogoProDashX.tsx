import React from 'react';

interface LogoProps {
  size?: 'icon' | 'small' | 'medium' | 'large' | 'full';
  variant?: 'transparent' | 'dark' | 'white';
  className?: string;
  style?: React.CSSProperties;
}

const sizeMap = {
  icon: { width: 150 },
  small: { width: 300 },
  medium: { width: 600 },
  large: { width: 1000 },
  full: { width: undefined },
};

export function LogoProDashX({ size = 'medium', variant = 'transparent', className, style }: LogoProps) {
  const src = `/prodashx-${variant === 'transparent' ? 'transparent' : variant === 'dark' ? 'on-dark' : 'on-white'}.png`;
  const dimensions = sizeMap[size];

  return (
    <img
      src={src}
      alt="ProDashX by toMachina"
      width={dimensions.width}
      className={className}
      style={{ height: 'auto', ...style }}
    />
  );
}
