export type Point = {
	x: number;
	y: number;
};

export type Size = {
	width: number;
	height: number;
};

export type CornerKey = "tl" | "tr" | "br" | "bl";
export type ProjectionCorners = Record<CornerKey, Point>;
export type ProjectionEdge = "top" | "right" | "bottom" | "left";

export type RotationGuide = {
	center: Point;
	edgeCenter: Point;
	handle: Point;
};

export const CORNER_KEYS: CornerKey[] = ["tl", "tr", "br", "bl"];

export const EDGE_CORNERS: Record<ProjectionEdge, [CornerKey, CornerKey]> = {
	top: ["tl", "tr"],
	right: ["tr", "br"],
	bottom: ["bl", "br"],
	left: ["tl", "bl"],
};

const OPPOSITE_EDGE: Record<ProjectionEdge, ProjectionEdge> = {
	top: "bottom",
	right: "left",
	bottom: "top",
	left: "right",
};

export function isPointInsidePolygon(point: Point, polygon: Point[]) {
	let inside = false;

	for (let index = 0, previous = polygon.length - 1; index < polygon.length; previous = index++) {
		const currentPoint = polygon[index];
		const previousPoint = polygon[previous];
		const crosses =
			currentPoint.y > point.y !== previousPoint.y > point.y &&
			point.x <
				((previousPoint.x - currentPoint.x) * (point.y - currentPoint.y)) /
					(previousPoint.y - currentPoint.y) +
					currentPoint.x;
		if (crosses) inside = !inside;
	}

	return inside;
}

export function getRotationGuide(corners: ProjectionCorners, offset: number): RotationGuide {
	const center = {
		x: CORNER_KEYS.reduce((sum, key) => sum + corners[key].x, 0) / CORNER_KEYS.length,
		y: CORNER_KEYS.reduce((sum, key) => sum + corners[key].y, 0) / CORNER_KEYS.length,
	};
	const edgeCenter = {
		x: (corners.bl.x + corners.br.x) / 2,
		y: (corners.bl.y + corners.br.y) / 2,
	};
	const edgeX = corners.br.x - corners.bl.x;
	const edgeY = corners.br.y - corners.bl.y;
	const edgeLength = Math.hypot(edgeX, edgeY) || 1;

	return {
		center,
		edgeCenter,
		handle: {
			x: edgeCenter.x + (-edgeY / edgeLength) * offset,
			y: edgeCenter.y + (edgeX / edgeLength) * offset,
		},
	};
}

export function scaleProjection(
	corners: ProjectionCorners,
	currentScale: number,
	nextScale: number,
): ProjectionCorners {
	const ratio = nextScale / currentScale;
	const points = CORNER_KEYS.map((key) => corners[key]);
	const center = {
		x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
		y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
	};

	return Object.fromEntries(
		CORNER_KEYS.map((key) => [
			key,
			{
				x: Math.round(center.x + (corners[key].x - center.x) * ratio),
				y: Math.round(center.y + (corners[key].y - center.y) * ratio),
			},
		]),
	) as ProjectionCorners;
}

export function moveProjection(
	corners: ProjectionCorners,
	desiredDelta: Point,
	artboardSize: Size,
): ProjectionCorners {
	const points = CORNER_KEYS.map((key) => corners[key]);
	const minX = Math.min(...points.map(({ x }) => x));
	const maxX = Math.max(...points.map(({ x }) => x));
	const minY = Math.min(...points.map(({ y }) => y));
	const maxY = Math.max(...points.map(({ y }) => y));
	const deltaX = Math.max(-minX, Math.min(artboardSize.width - maxX, desiredDelta.x));
	const deltaY = Math.max(-minY, Math.min(artboardSize.height - maxY, desiredDelta.y));

	return Object.fromEntries(
		CORNER_KEYS.map((key) => [
			key,
			{
				x: Math.round(corners[key].x + deltaX),
				y: Math.round(corners[key].y + deltaY),
			},
		]),
	) as ProjectionCorners;
}

export function moveProjectionEdge(
	corners: ProjectionCorners,
	edge: ProjectionEdge,
	delta: number,
	symmetric: boolean,
	artboardSize: Size,
): ProjectionCorners {
	const isHorizontalEdge = edge === "top" || edge === "bottom";
	const nextCorners = structuredClone(corners);
	const moveCorners = (targetEdge: ProjectionEdge, amount: number) => {
		for (const key of EDGE_CORNERS[targetEdge]) {
			if (isHorizontalEdge) nextCorners[key].y += amount;
			else nextCorners[key].x += amount;
		}
	};

	moveCorners(edge, delta);
	if (symmetric) moveCorners(OPPOSITE_EDGE[edge], -delta);

	const points = CORNER_KEYS.map((key) => nextCorners[key]);
	const minX = Math.min(...points.map(({ x }) => x));
	const maxX = Math.max(...points.map(({ x }) => x));
	const minY = Math.min(...points.map(({ y }) => y));
	const maxY = Math.max(...points.map(({ y }) => y));
	const correctionX = minX < 0 ? -minX : maxX > artboardSize.width ? artboardSize.width - maxX : 0;
	const correctionY =
		minY < 0 ? -minY : maxY > artboardSize.height ? artboardSize.height - maxY : 0;

	return Object.fromEntries(
		CORNER_KEYS.map((key) => [
			key,
			{
				x: Math.round(nextCorners[key].x + correctionX),
				y: Math.round(nextCorners[key].y + correctionY),
			},
		]),
	) as ProjectionCorners;
}

export function rotateProjection(
	corners: ProjectionCorners,
	center: Point,
	angle: number,
): ProjectionCorners {
	const cosine = Math.cos(angle);
	const sine = Math.sin(angle);

	return Object.fromEntries(
		CORNER_KEYS.map((key) => {
			const source = corners[key];
			const relativeX = source.x - center.x;
			const relativeY = source.y - center.y;
			return [
				key,
				{
					x: Math.round(center.x + relativeX * cosine - relativeY * sine),
					y: Math.round(center.y + relativeX * sine + relativeY * cosine),
				},
			];
		}),
	) as ProjectionCorners;
}

function solveLinearSystem(matrix: number[][], values: number[]) {
	const size = values.length;
	const augmented = matrix.map((row, index) => [...row, values[index]]);

	for (let column = 0; column < size; column += 1) {
		let pivot = column;
		for (let row = column + 1; row < size; row += 1) {
			if (Math.abs(augmented[row][column]) > Math.abs(augmented[pivot][column])) {
				pivot = row;
			}
		}

		[augmented[column], augmented[pivot]] = [augmented[pivot], augmented[column]];

		const divisor = augmented[column][column];
		if (Math.abs(divisor) < 1e-10) {
			throw new Error("The selected corners do not form a valid perspective transform.");
		}

		for (let cell = column; cell <= size; cell += 1) {
			augmented[column][cell] /= divisor;
		}

		for (let row = 0; row < size; row += 1) {
			if (row === column) continue;
			const factor = augmented[row][column];
			for (let cell = column; cell <= size; cell += 1) {
				augmented[row][cell] -= factor * augmented[column][cell];
			}
		}
	}

	return augmented.map((row) => row[size]);
}

export function getPerspectiveTransform(corners: ProjectionCorners, screenshotSize: Size) {
	const source: Point[] = [
		{ x: 0, y: 0 },
		{ x: screenshotSize.width, y: 0 },
		{ x: screenshotSize.width, y: screenshotSize.height },
		{ x: 0, y: screenshotSize.height },
	];
	const destination = CORNER_KEYS.map((key) => corners[key]);
	const matrix: number[][] = [];
	const values: number[] = [];

	source.forEach(({ x, y }, index) => {
		const { x: targetX, y: targetY } = destination[index];
		matrix.push([x, y, 1, 0, 0, 0, -x * targetX, -y * targetX]);
		values.push(targetX);
		matrix.push([0, 0, 0, x, y, 1, -x * targetY, -y * targetY]);
		values.push(targetY);
	});

	const [a, b, c, d, e, f, g, h] = solveLinearSystem(matrix, values);
	const cssMatrix = [a, d, 0, g, b, e, 0, h, 0, 0, 1, 0, c, f, 0, 1];

	return `matrix3d(${cssMatrix.map((value) => Number(value.toFixed(10))).join(",")})`;
}

export function getDestinationToTextureMatrix(corners: ProjectionCorners) {
	const source = CORNER_KEYS.map((key) => corners[key]);
	const destination: Point[] = [
		{ x: 0, y: 0 },
		{ x: 1, y: 0 },
		{ x: 1, y: 1 },
		{ x: 0, y: 1 },
	];
	const matrix: number[][] = [];
	const values: number[] = [];

	source.forEach(({ x, y }, index) => {
		const { x: targetX, y: targetY } = destination[index];
		matrix.push([x, y, 1, 0, 0, 0, -x * targetX, -y * targetX]);
		values.push(targetX);
		matrix.push([0, 0, 0, x, y, 1, -x * targetY, -y * targetY]);
		values.push(targetY);
	});

	const [a, b, c, d, e, f, g, h] = solveLinearSystem(matrix, values);
	return new Float32Array([a, d, g, b, e, h, c, f, 1]);
}
