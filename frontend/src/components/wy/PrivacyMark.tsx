'use client';

import Icon from './Icon';

interface PrivacyMarkProps {
  label?: string;
  className?: string;
}

export default function PrivacyMark({ label = 'Solo tú puedes verlo', className }: PrivacyMarkProps) {
  return (
    <span
      className={`privacy-mark${className ? ` ${className}` : ''}`}
      role="img"
      aria-label={label}
      data-tooltip={label}
      tabIndex={0}
    >
      <Icon name="lock" />
    </span>
  );
}
