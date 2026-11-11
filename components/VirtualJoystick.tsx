"use client";

import React, { useRef, useState, useCallback, useEffect } from "react";

export type JoystickVector = {
  x: number; // -1 to 1 (left to right)
  y: number; // -1 to 1 (down/reverse to up/forward)
};

export interface VirtualJoystickProps {
  onMove: (vector: JoystickVector) => void;
  onStop?: () => void;
  size?: number; // Base diameter (default: 124px)
  maxRadius?: number; // Max knob movement distance (default: 42px)
}

export default function VirtualJoystick({
  onMove,
  onStop,
  size = 124,
  maxRadius = 42,
}: VirtualJoystickProps) {
  const baseRef = useRef<HTMLDivElement>(null);
  const knobRef = useRef<HTMLDivElement>(null);
  const activePointerId = useRef<number | null>(null);
  const baseCenter = useRef<{ x: number; y: number }>({ x: 0, y: 0 });
  const [isActive, setIsActive] = useState(false);

  const calculatePosition = useCallback(
    (clientX: number, clientY: number) => {
      const dx = clientX - baseCenter.current.x;
      const dy = clientY - baseCenter.current.y;
      const dist = Math.hypot(dx, dy);
      const angle = Math.atan2(dy, dx);

      // Clamp knob movement to maxRadius
      const clampedDist = Math.min(dist, maxRadius);
      const knobX = Math.cos(angle) * clampedDist;
      const knobY = Math.sin(angle) * clampedDist;

      // Update knob visual position directly via CSS transform for 60-120fps smoothness
      if (knobRef.current) {
        knobRef.current.style.transform = `translate3d(${knobX}px, ${knobY}px, 0)`;
      }

      // Calculate normalized vector values (-1.0 to +1.0)
      // Deadzone: under 8% radius counts as 0 to prevent jitter
      const deadzone = maxRadius * 0.08;
      if (dist < deadzone) {
        onMove({ x: 0, y: 0 });
        return;
      }

      const normalizedX = Math.max(-1, Math.min(1, knobX / maxRadius));
      // In screen coords, dy < 0 is UP (forward), so negate for intuitive +1 forward, -1 reverse
      const normalizedY = Math.max(-1, Math.min(1, -(knobY / maxRadius)));

      onMove({ x: normalizedX, y: normalizedY });
    },
    [maxRadius, onMove]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    if (activePointerId.current !== null) return;
    activePointerId.current = e.pointerId;

    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture fails in unsupported browser modes
    }

    if (baseRef.current) {
      const rect = baseRef.current.getBoundingClientRect();
      baseCenter.current = {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      };
    }

    if (knobRef.current) {
      knobRef.current.style.transition = "none";
    }

    setIsActive(true);
    calculatePosition(e.clientX, e.clientY);
  };

  const handlePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== activePointerId.current) return;
    calculatePosition(e.clientX, e.clientY);
  };

  const handlePointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.pointerId !== activePointerId.current) return;
    activePointerId.current = null;

    try {
      if (e.currentTarget.hasPointerCapture(e.pointerId)) {
        e.currentTarget.releasePointerCapture(e.pointerId);
      }
    } catch {
      // Ignore
    }

    if (knobRef.current) {
      knobRef.current.style.transition = "transform 0.16s cubic-bezier(0.18, 0.89, 0.32, 1.25)";
      knobRef.current.style.transform = "translate3d(0px, 0px, 0)";
    }

    setIsActive(false);
    onMove({ x: 0, y: 0 });
    onStop?.();
  };

  // Safety cleanup if unmounted while dragging
  useEffect(() => {
    return () => {
      onMove({ x: 0, y: 0 });
    };
  }, [onMove]);

  return (
    <div
      ref={baseRef}
      className={`virtual-joystick-base ${isActive ? "active" : ""}`}
      style={{
        width: `${size}px`,
        height: `${size}px`,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onContextMenu={(e) => e.preventDefault()}
      role="group"
      aria-label="Kontrol Analog Virtual"
    >
      {/* Direction Guide Indicators */}
      <span className="joy-guide joy-up">▲</span>
      <span className="joy-guide joy-down">▼</span>
      <span className="joy-guide joy-left">◀</span>
      <span className="joy-guide joy-right">▶</span>

      {/* Central Ring Guideline */}
      <div className="joy-center-ring" />

      {/* Movable Thumbstick Knob */}
      <div ref={knobRef} className="virtual-joystick-knob">
        <div className="joy-knob-core" />
      </div>
    </div>
  );
}
