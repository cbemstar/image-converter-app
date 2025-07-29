import React from 'react';
import { colors, spacing } from '../core/reformately-css';

type CardProps = React.HTMLAttributes<HTMLDivElement>;

export function Card({ children, style, ...rest }: CardProps) {
  return (
    <div
      style={{
        padding: spacing.md,
        borderRadius: '6px',
        background: colors.background,
        boxShadow: `0 1px 2px rgba(0,0,0,0.1)`,
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  );
}
