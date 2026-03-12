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
  large: { width: 965 },
  full: { width: undefined },
};

export function LogoToMachina({ size = 'medium', variant = 'transparent', className, style }: LogoProps) {
  const src = `/tomachina-${variant === 'transparent' ? 'transparent' : variant === 'dark' ? 'on-dark' : 'on-white'}.png`;
  const dimensions = sizeMap[size];

  return (
    <img
      src={src}
      alt="toMachina - The Machine"
      width={dimensions.width}
      className={className}
      style={{ height: 'auto', ...style }}
    />
  );
}
