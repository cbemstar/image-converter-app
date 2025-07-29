import React from 'react';
import { colors, spacing } from '../core/reformately-css';

type ButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement>;

export function Button({ children, style, ...rest }: ButtonProps) {
  return (
    <button
      style={{
        background: colors.brand,
        color: colors.foreground,
        padding: `${spacing.sm} ${spacing.md}`,
        border: 'none',
        borderRadius: '4px',
        cursor: 'pointer',
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  );
}
