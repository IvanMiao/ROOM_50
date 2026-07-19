export function validateSeatCount(scene) {
  const count = scene.seats.filter((seat) => seat.countsTowardCapacity).length;
  const accessibleSeatCount = scene.seats.filter(
    (seat) => seat.accessible && seat.kind === "wheelchair-position",
  ).length;
  const minimum = scene.thresholds.seatMinimum;
  const maximum = scene.thresholds.seatMaximum;
  const minimumAccessibleSeatCount = 1;
  const passed =
    count >= minimum &&
    count <= maximum &&
    accessibleSeatCount >= minimumAccessibleSeatCount;

  return Object.freeze({
    checkId: "seatCount",
    status: passed ? "pass" : "fail",
    severity: "warning",
    message: passed
      ? `${count} capacity seats are modeled, including ${accessibleSeatCount} accessible wheelchair position(s).`
      : `${count} capacity seats and ${accessibleSeatCount} accessible wheelchair positions are modeled; targets are ${minimum}–${maximum} seats and at least ${minimumAccessibleSeatCount} accessible position.`,
    measured: Object.freeze({
      count,
      accessibleSeatCount,
    }),
    required: Object.freeze({
      minimum,
      maximum,
      minimumAccessibleSeatCount,
    }),
    evidenceGeometry: Object.freeze([]),
    violationGeometry: Object.freeze([]),
  });
}
