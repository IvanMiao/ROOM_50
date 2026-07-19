import { objectsPenetrate3d, obbInsideShell } from "../geometry/collision.mjs";
import { EPSILON_M } from "../geometry/constants.mjs";
import { obbPolygon } from "../geometry/obb.mjs";
import { hasOverlapExemption } from "../input/normalize.mjs";

function shellPolygon(shell) {
  return [
    [shell.minX, shell.minZ],
    [shell.maxX, shell.minZ],
    [shell.maxX, shell.maxZ],
    [shell.minX, shell.maxZ],
  ];
}

function objectInsideShell(object, shell) {
  const insideHorizontal = obbInsideShell(object, shell);
  const insideVertical =
    object.minY >= shell.minY - EPSILON_M && object.maxY <= shell.maxY + EPSILON_M;
  return insideHorizontal && insideVertical;
}

function plural(count, singular, pluralForm = `${singular}s`) {
  return count === 1 ? singular : pluralForm;
}

export function validateBoundary(scene) {
  const outsideObjects = scene.objects.filter((object) => !objectInsideShell(object, scene.shell));
  const intersections = [];

  for (let leftIndex = 0; leftIndex < scene.objects.length; leftIndex += 1) {
    const left = scene.objects[leftIndex];
    for (let rightIndex = leftIndex + 1; rightIndex < scene.objects.length; rightIndex += 1) {
      const right = scene.objects[rightIndex];
      if (hasOverlapExemption(scene, left.id, right.id)) continue;
      if (objectsPenetrate3d(left, right)) {
        intersections.push(Object.freeze({ objectIds: Object.freeze([left.id, right.id]) }));
      }
    }
  }

  const outsideObjectIds = outsideObjects.map((object) => object.id);
  const failed = outsideObjectIds.length > 0 || intersections.length > 0;
  const message = failed
    ? `${outsideObjectIds.length} ${plural(outsideObjectIds.length, "object")} outside the shell; ${intersections.length} unintended ${plural(intersections.length, "intersection")}.`
    : `All ${scene.objects.length} modeled ${plural(scene.objects.length, "object")} are inside the shell with no unintended intersections.`;
  const violationGeometry = [
    ...outsideObjects.map((object) =>
      Object.freeze({
        id: `boundary-outside-${object.id}`,
        type: "polygon",
        points: obbPolygon(object),
        objectIds: Object.freeze([object.id]),
        label: `Object “${object.id}” outside shell`,
      }),
    ),
    ...intersections.flatMap(({ objectIds }) =>
      objectIds.map((objectId) => {
        const object = scene.objectById.get(objectId);
        return Object.freeze({
          id: `boundary-intersection-${objectIds[0]}-${objectIds[1]}-${objectId}`,
          type: "polygon",
          points: obbPolygon(object),
          objectIds,
          label: `Intersection between “${objectIds[0]}” and “${objectIds[1]}”`,
        });
      }),
    ),
  ];

  return Object.freeze({
    checkId: "boundary",
    status: failed ? "fail" : "pass",
    severity: "error",
    message,
    measured: Object.freeze({
      outsideObjectIds: Object.freeze(outsideObjectIds),
      intersections: Object.freeze(intersections),
    }),
    required: Object.freeze({
      shellLengthM: scene.shell.lengthM,
      shellWidthM: scene.shell.widthM,
      shellClearHeightM: scene.shell.clearHeightM,
      outsideObjectCount: 0,
      unintendedIntersectionCount: 0,
    }),
    evidenceGeometry: Object.freeze([
      Object.freeze({
        id: "boundary-shell",
        type: "polygon",
        points: shellPolygon(scene.shell),
        label: "10 m × 5 m shell boundary",
      }),
    ]),
    violationGeometry: Object.freeze(violationGeometry),
  });
}
