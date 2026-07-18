export function validateSeatCount(scene) {
  const count = scene.seats.filter((seat) => seat.countsTowardCapacity).length;
  const accessibleSeatCount = scene.seats.filter(
    (seat) => seat.accessible && seat.kind === "wheelchair-position",
  ).length;
  const minimum = scene.thresholds.seatMinimum;
  const maximum = scene.thresholds.seatMaximum;
  const passed = count >= minimum && count <= maximum;

  return Object.freeze({
    checkId: "seatCount",
    status: passed ? "pass" : "fail",
    severity: "warning",
    message: passed
      ? `${count} capacity seats are modeled, including ${accessibleSeatCount} accessible wheelchair position(s).`
      : `${count} capacity seats are modeled; the target range is ${minimum}–${maximum}.`,
    measured: Object.freeze({
      count,
      accessibleSeatCount,
    }),
    required: Object.freeze({
      minimum,
      maximum,
      minimumAccessibleSeatCount: 1,
    }),
    evidenceGeometry: Object.freeze([]),
    violationGeometry: Object.freeze([]),
  });
}
