/**
 * VECTOR MATHEMATICS
 * Core vector utilities used by algorithm modules
 */

export interface Vector2D {
  x: number;
  y: number;
}

export interface Vector3D extends Vector2D {
  z: number;
}

export const Vector = {
  add: (a: Vector2D, b: Vector2D): Vector2D => ({ x: a.x + b.x, y: a.y + b.y }),
  subtract: (a: Vector2D, b: Vector2D): Vector2D => ({ x: a.x - b.x, y: a.y - b.y }),
  multiply: (v: Vector2D, scalar: number): Vector2D => ({ x: v.x * scalar, y: v.y * scalar }),
  magnitude: (v: Vector2D): number => Math.sqrt(v.x * v.x + v.y * v.y),
  normalize: (v: Vector2D): Vector2D => {
    const mag = Vector.magnitude(v);
    return mag > 0 ? { x: v.x / mag, y: v.y / mag } : { x: 0, y: 0 };
  },
  dot: (a: Vector2D, b: Vector2D): number => a.x * b.x + a.y * b.y,
  distance: (a: Vector2D, b: Vector2D): number => Vector.magnitude(Vector.subtract(a, b)),
  angle: (v: Vector2D): number => Math.atan2(v.y, v.x),
  fromAngle: (angle: number, magnitude: number = 1): Vector2D => ({
    x: Math.cos(angle) * magnitude,
    y: Math.sin(angle) * magnitude
  }),
  rotate: (v: Vector2D, angle: number): Vector2D => ({
    x: v.x * Math.cos(angle) - v.y * Math.sin(angle),
    y: v.x * Math.sin(angle) + v.y * Math.cos(angle)
  }),
  lerp: (a: Vector2D, b: Vector2D, t: number): Vector2D => ({
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t
  })
};
