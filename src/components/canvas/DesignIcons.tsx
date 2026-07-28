"use client";

// Shared icon set for the Tasarım Kanvası toolbar/layers/properties UI —
// same visual language as the rest of the dashboard (Sidebar.tsx etc.):
// 24x24 viewBox, stroke="currentColor", fill="none", round caps/joins.
// Kept as simple, unambiguous shapes rather than exact Heroicons paths —
// legible at 16-18px is what matters here, not icon-set fidelity.

import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

function Base({ children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" {...props}>
      {children}
    </svg>
  );
}

export function CursorIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M6 3l14 8-6.2 1.7L11.5 19 6 3z" strokeLinejoin="round" fill="currentColor" fillOpacity={0.15} />
    </Base>
  );
}

export function RectangleToolIcon(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="4" y="6" width="16" height="12" rx="1.2" />
    </Base>
  );
}

export function EllipseToolIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="12" cy="12" r="8" />
    </Base>
  );
}

export function FrameToolIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M7 2v4M7 18v4M2 7h4M18 7h4M2 17h4M18 17h4M7 6h11v11H7V6z" />
    </Base>
  );
}

export function LineToolIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="5.5" cy="18.5" r="1.4" fill="currentColor" stroke="none" />
      <path d="M6.5 17.5L17.5 6.5" />
      <circle cx="18.5" cy="5.5" r="1.4" fill="currentColor" stroke="none" />
    </Base>
  );
}

export function PenToolIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4 20l1-4.5L15.5 5 19 8.5 8.5 19 4 20z" />
      <path d="M13 7l4 4" />
    </Base>
  );
}

export function ImageToolIcon(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="3" y="4" width="18" height="16" rx="1.5" />
      <circle cx="8.5" cy="9.5" r="1.5" />
      <path d="M3 16l5-5 4 4 3-3 6 6" />
    </Base>
  );
}

export function EyeIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
      <circle cx="12" cy="12" r="2.6" />
    </Base>
  );
}

export function EyeOffIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M3 3l18 18" />
      <path d="M10.6 5.2A9.4 9.4 0 0112 5c6.5 0 10 7 10 7a15.6 15.6 0 01-4 4.5M6.3 6.5A15.7 15.7 0 002 12s3.5 7 10 7a10 10 0 004.2-.9" />
      <path d="M9.9 9.9a2.6 2.6 0 003.6 3.6" />
    </Base>
  );
}

export function LockIcon(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="5" y="11" width="14" height="9" rx="1.5" />
      <path d="M8 11V7.5a4 4 0 118 0V11" />
    </Base>
  );
}

export function UnlockIcon(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="5" y="11" width="14" height="9" rx="1.5" />
      <path d="M8 11V7.5a4 4 0 017.8-1.2" />
    </Base>
  );
}

export function TrashIcon(props: IconProps) {
  return (
    <Base {...props}>
      <path d="M4 7h16M9 7V5a1 1 0 011-1h4a1 1 0 011 1v2m3 0l-.8 12.1a2 2 0 01-2 1.9H8.8a2 2 0 01-2-1.9L6 7h12z" />
      <path d="M10 11v6M14 11v6" />
    </Base>
  );
}

export function DuplicateIcon(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="8" y="8" width="12" height="12" rx="1.5" />
      <path d="M4 16V5a1 1 0 011-1h11" />
    </Base>
  );
}

export function SearchIcon(props: IconProps) {
  return (
    <Base {...props}>
      <circle cx="10.5" cy="10.5" r="6.5" />
      <path d="M20 20l-4.5-4.5" />
    </Base>
  );
}

export function DotsVerticalIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" {...props}>
      <circle cx="12" cy="5" r="1.6" />
      <circle cx="12" cy="12" r="1.6" />
      <circle cx="12" cy="19" r="1.6" />
    </svg>
  );
}

export function GroupIcon(props: IconProps) {
  return (
    <Base {...props}>
      <rect x="3" y="3" width="10" height="10" rx="1" />
      <rect x="11" y="11" width="10" height="10" rx="1" />
    </Base>
  );
}
