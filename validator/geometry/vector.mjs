import { EPSILON_M } from "./constants.mjs";

export function add(left, right) {
  return [left[0] + right[0], left[1] + right[1]];
}

export function subtract(left, right) {
  return [left[0] - right[0], left[1] - right[1]];
}

export function scale(vector, scalar) {
  return [vector[0] * scalar, vector[1] * scalar];
}

export function dot(left, right) {
  return left[0] * right[0] + left[1] * right[1];
}

export function cross(left, right) {
  return left[0] * right[1] - left[1] * right[0];
}

export function length(vector) {
  return Math.hypot(vector[0], vector[1]);
}

export function normalize(vector, epsilon = EPSILON_M) {
  const magnitude = length(vector);
  if (magnitude <= epsilon) throw new RangeError("Cannot normalize a zero-length vector.");
  return scale(vector, 1 / magnitude);
}

export function distance(left, right) {
  return length(subtract(left, right));
}

export function perpendicularLeft(vector) {
  return [-vector[1], vector[0]];
}

export function almostEqual(left, right, epsilon = EPSILON_M) {
  return Math.abs(left - right) <= epsilon;
}

export function pointsAlmostEqual(left, right, epsilon = EPSILON_M) {
  return almostEqual(left[0], right[0], epsilon) && almostEqual(left[1], right[1], epsilon);
}
