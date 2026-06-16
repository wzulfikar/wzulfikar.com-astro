import type { Point, Size } from "./projection";

export type FrameRatio = "original" | "square" | "landscape" | "portrait" | "instagram" | "custom";

export type FrameEdge = "top" | "right" | "bottom" | "left";

export const FRAME_EDGES: FrameEdge[] = ["top", "right", "bottom", "left"];

export type CropRect = {
	x: number;
	y: number;
	width: number;
	height: number;
};

export const FRAME_RATIOS: Array<{
	value: FrameRatio;
	label: string;
	ratio: number | null;
}> = [
	{ value: "original", label: "Original", ratio: null },
	{ value: "square", label: "Square (1:1)", ratio: 1 },
	{ value: "landscape", label: "Landscape (16:9)", ratio: 16 / 9 },
	{ value: "portrait", label: "Portrait (9:16)", ratio: 9 / 16 },
	{ value: "instagram", label: "Instagram (4:5)", ratio: 4 / 5 },
	{ value: "custom", label: "Custom", ratio: null },
];

export function getCropRect(
	artboardSize: Size,
	frameRatio: FrameRatio,
	cropPosition: Point,
): CropRect {
	const ratio = FRAME_RATIOS.find(({ value }) => value === frameRatio)?.ratio;
	if (!ratio) return { x: 0, y: 0, ...artboardSize };

	const artboardRatio = artboardSize.width / artboardSize.height;
	let width = artboardSize.width;
	let height = artboardSize.height;

	if (artboardRatio > ratio) width = Math.floor(height * ratio);
	else height = Math.floor(width / ratio);

	// H.264 encoders are most reliable with even output dimensions.
	width -= width % 2;
	height -= height % 2;
	const availableX = artboardSize.width - width;
	const availableY = artboardSize.height - height;

	return {
		x: Math.round(availableX * cropPosition.x),
		y: Math.round(availableY * cropPosition.y),
		width,
		height,
	};
}

export function getAspectRatioLabel(width: number, height: number) {
	let left = width;
	let right = height;

	while (right !== 0) {
		[left, right] = [right, left % right];
	}

	const divisor = left;
	return `${width / divisor}:${height / divisor}`;
}

export function centerCropRect(
	width: number,
	height: number,
	current: CropRect,
	artboardSize: Size,
): CropRect {
	const nextWidth = Math.max(32, Math.min(artboardSize.width, Math.round(width / 2) * 2));
	const nextHeight = Math.max(32, Math.min(artboardSize.height, Math.round(height / 2) * 2));
	const centerX = current.x + current.width / 2;
	const centerY = current.y + current.height / 2;

	return {
		x: Math.round(Math.max(0, Math.min(artboardSize.width - nextWidth, centerX - nextWidth / 2))),
		y: Math.round(
			Math.max(0, Math.min(artboardSize.height - nextHeight, centerY - nextHeight / 2)),
		),
		width: nextWidth,
		height: nextHeight,
	};
}

export function resizeCropRect(
	rect: CropRect,
	edge: FrameEdge,
	delta: number,
	symmetric: boolean,
	artboardSize: Size,
): CropRect {
	const minSize = 32;
	let left = rect.x;
	let right = rect.x + rect.width;
	let top = rect.y;
	let bottom = rect.y + rect.height;
	let constrainedDelta = Math.round(delta);

	if (edge === "left") {
		constrainedDelta = symmetric
			? Math.max(
					Math.max(-left, right - artboardSize.width),
					Math.min((rect.width - minSize) / 2, constrainedDelta),
				)
			: Math.max(-left, Math.min(rect.width - minSize, constrainedDelta));
		left += constrainedDelta;
		if (symmetric) right -= constrainedDelta;
	} else if (edge === "right") {
		constrainedDelta = symmetric
			? Math.max(
					(minSize - rect.width) / 2,
					Math.min(Math.min(artboardSize.width - right, left), constrainedDelta),
				)
			: Math.max(minSize - rect.width, Math.min(artboardSize.width - right, constrainedDelta));
		right += constrainedDelta;
		if (symmetric) left -= constrainedDelta;
	} else if (edge === "top") {
		constrainedDelta = symmetric
			? Math.max(
					Math.max(-top, bottom - artboardSize.height),
					Math.min((rect.height - minSize) / 2, constrainedDelta),
				)
			: Math.max(-top, Math.min(rect.height - minSize, constrainedDelta));
		top += constrainedDelta;
		if (symmetric) bottom -= constrainedDelta;
	} else {
		constrainedDelta = symmetric
			? Math.max(
					(minSize - rect.height) / 2,
					Math.min(Math.min(artboardSize.height - bottom, top), constrainedDelta),
				)
			: Math.max(minSize - rect.height, Math.min(artboardSize.height - bottom, constrainedDelta));
		bottom += constrainedDelta;
		if (symmetric) top -= constrainedDelta;
	}

	left = Math.round(left);
	right = Math.round(right);
	top = Math.round(top);
	bottom = Math.round(bottom);

	if (!symmetric && (edge === "left" || edge === "right") && (right - left) % 2 !== 0) {
		if (edge === "left") left += 1;
		else right -= 1;
	}
	if (!symmetric && (edge === "top" || edge === "bottom") && (bottom - top) % 2 !== 0) {
		if (edge === "top") top += 1;
		else bottom -= 1;
	}

	return {
		x: left,
		y: top,
		width: right - left,
		height: bottom - top,
	};
}
