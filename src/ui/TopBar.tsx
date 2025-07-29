import React from 'react';
import { spacing } from '../core/reformately-css';
import { Button } from './Button';

export function TopBar() {
  return (
    <header
      style={{
        display: 'flex',
        gap: spacing.sm,
        padding: spacing.md,
        borderBottom: '1px solid #e5e7eb',
      }}
    >
      <Button>Undo</Button>
      <Button>Redo</Button>
      <Button>Export</Button>
    </header>
  );
}
