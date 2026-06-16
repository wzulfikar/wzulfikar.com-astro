import { ChevronDownIcon, HomeIcon, RotateCwIcon } from "lucide-react";
import { domToPng } from "modern-screenshot";
import { useEffect, useMemo, useRef, useState } from "react";

import flintRecordingImage from "./images/flint-mockup-recording.png";
import flintRecordingVideo from "./images/flint-mockup-weather.mp4";
import handCutout from "./images/hand-cutout.png";
import {
	type CropRect,
	centerCropRect,
	FRAME_EDGES,
	FRAME_RATIOS,
	type FrameEdge,
	type FrameRatio,
	getAspectRatioLabel,
	getCropRect,
	resizeCropRect,
} from "./lib/frame-ratio";
import { isEditableTarget } from "./lib/helper";
import { useHistoryState } from "./lib/history";
import {
	CORNER_KEYS,
	type CornerKey,
	EDGE_CORNERS,
	getDestinationToTextureMatrix,
	getPerspectiveTransform,
	getRotationGuide,
	isPointInsidePolygon,
	moveProjection as moveProjectionCorners,
	moveProjectionEdge,
	type Point,
	type ProjectionCorners,
	type ProjectionEdge,
	rotateProjection,
	scaleProjection as scaleProjectionCorners,
} from "./lib/projection";
import { exportCompositeVideo } from "./lib/video-export";

const DEFAULT_ARTBOARD_SIZE = { width: handCutout.width, height: handCutout.height };
// The default screenshot is the still PNG; the "Show video" toggle swaps in the
// bundled mp4 example. Astro resolves an `.mp4` import to a bare URL string with
// no intrinsic size, so the video's dimensions are loaded on demand when toggled.
const EXAMPLE_VIDEO_SRC = flintRecordingVideo as unknown as string;
const EXAMPLE_VIDEO_NAME = "flint-mockup-weather.mp4";
const EXAMPLE_VIDEO_SIZE = { width: 496, height: 1080 };
const EXAMPLE_IMAGE_NAME = "flint-mockup-recording.png";
const DEFAULT_SCREENSHOT_SIZE = {
	width: flintRecordingImage.width,
	height: flintRecordingImage.height,
};

type MediaKind = "image" | "video";

type Settings = {
	corners: ProjectionCorners;
	projectionScale: number;
	cornerRadius: number;
	opacity: number;
	brightness: number;
	contrast: number;
	saturation: number;
	bgBrightness: number;
	bgContrast: number;
	bgSaturation: number;
	screenshotAbove: boolean;
};

type EditorState = {
	settings: Settings;
	frameRatio: FrameRatio;
	cropPosition: Point;
	customCropRect: CropRect;
};

// Corners measured from the transparent screen hole in hand-cutout.png
// (1280×811). Pixel coordinates in the source PNG's own space.
const DEFAULT_SETTINGS: Settings = {
	corners: {
		tl: { x: 384, y: 125 },
		tr: { x: 626, y: 59 },
		br: { x: 800, y: 599 },
		bl: { x: 567, y: 685 },
	},
	projectionScale: 1,
	cornerRadius: 0,
	opacity: 0.88,
	brightness: 0.78,
	contrast: 1.08,
	saturation: 0.86,
	bgBrightness: 1,
	bgContrast: 1,
	bgSaturation: 1,
	screenshotAbove: false,
};

const createInitialEditorState = (): EditorState => ({
	settings: structuredClone(DEFAULT_SETTINGS),
	frameRatio: "original",
	cropPosition: { x: 0.5, y: 0.5 },
	customCropRect: {
		x: 0,
		y: 0,
		...DEFAULT_ARTBOARD_SIZE,
	},
});

function loadImage(src: string) {
	const image = new Image();
	image.src = src;
	return image.decode().then(() => image);
}

function loadVideo(src: string) {
	return new Promise<HTMLVideoElement>((resolve, reject) => {
		const video = document.createElement("video");
		video.src = src;
		video.preload = "auto";
		video.muted = true;
		video.playsInline = true;
		video.loop = false;
		video.addEventListener("loadeddata", () => resolve(video), { once: true });
		video.addEventListener("error", () => reject(new Error("Could not load the selected video.")), {
			once: true,
		});
		video.load();
	});
}

function createShader(gl: WebGLRenderingContext, type: number, source: string) {
	const shader = gl.createShader(type);
	if (!shader) throw new Error("Could not create WebGL shader.");
	gl.shaderSource(shader, source);
	gl.compileShader(shader);
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		throw new Error(gl.getShaderInfoLog(shader) ?? "Could not compile WebGL shader.");
	}
	return shader;
}

function createVideoCompositor({
	canvas,
	background,
	screenshot,
	screenshotSize,
	settings,
	artboardSize,
}: {
	canvas: HTMLCanvasElement;
	background: HTMLImageElement;
	screenshot: TexImageSource;
	screenshotSize: { width: number; height: number };
	settings: Settings;
	artboardSize: { width: number; height: number };
}) {
	const gl = canvas.getContext("webgl", {
		alpha: true,
		antialias: true,
		preserveDrawingBuffer: true,
	});
	if (!gl) throw new Error("WebGL is required to export video.");

	const vertexShader = createShader(
		gl,
		gl.VERTEX_SHADER,
		`
      attribute vec2 a_position;
      void main() {
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `,
	);
	const fragmentShader = createShader(
		gl,
		gl.FRAGMENT_SHADER,
		`
      precision highp float;
      uniform sampler2D u_texture;
      uniform vec2 u_canvasSize;
      uniform mat3 u_destinationToTexture;
      uniform float u_mode;
      uniform float u_opacity;
      uniform float u_brightness;
      uniform float u_contrast;
      uniform float u_saturation;
      uniform float u_bgBrightness;
      uniform float u_bgContrast;
      uniform float u_bgSaturation;
      uniform vec2 u_textureSize;
      uniform float u_cornerRadius;

      void main() {
        vec2 pixel = vec2(gl_FragCoord.x, u_canvasSize.y - gl_FragCoord.y);
        vec2 uv;

        if (u_mode < 0.5) {
          uv = pixel / u_canvasSize;
        } else {
          vec3 mapped = u_destinationToTexture * vec3(pixel, 1.0);
          uv = mapped.xy / mapped.z;
          if (uv.x < 0.0 || uv.x > 1.0 || uv.y < 0.0 || uv.y > 1.0) {
            discard;
          }
          if (u_cornerRadius > 0.0) {
            vec2 sourcePixel = uv * u_textureSize;
            vec2 halfSize = u_textureSize * 0.5;
            vec2 roundedDistance =
              abs(sourcePixel - halfSize) - (halfSize - vec2(u_cornerRadius));
            float distanceToRoundedRect =
              length(max(roundedDistance, 0.0)) +
              min(max(roundedDistance.x, roundedDistance.y), 0.0) -
              u_cornerRadius;
            if (distanceToRoundedRect > 0.0) {
              discard;
            }
          }
        }

        vec4 color = texture2D(u_texture, uv);
        if (u_mode > 0.5) {
          color.rgb *= u_brightness;
          color.rgb = (color.rgb - 0.5) * u_contrast + 0.5;
          float luminance = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
          color.rgb = mix(vec3(luminance), color.rgb, u_saturation);
          color.a *= u_opacity;
        } else {
          color.rgb *= u_bgBrightness;
          color.rgb = (color.rgb - 0.5) * u_bgContrast + 0.5;
          float bgLuminance = dot(color.rgb, vec3(0.2126, 0.7152, 0.0722));
          color.rgb = mix(vec3(bgLuminance), color.rgb, u_bgSaturation);
        }
        gl_FragColor = color;
      }
    `,
	);
	const program = gl.createProgram();
	if (!program) throw new Error("Could not create WebGL program.");
	gl.attachShader(program, vertexShader);
	gl.attachShader(program, fragmentShader);
	gl.linkProgram(program);
	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		throw new Error(gl.getProgramInfoLog(program) ?? "Could not link WebGL program.");
	}

	const positionBuffer = gl.createBuffer();
	gl.bindBuffer(gl.ARRAY_BUFFER, positionBuffer);
	gl.bufferData(
		gl.ARRAY_BUFFER,
		new Float32Array([-1, -1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1]),
		gl.STATIC_DRAW,
	);
	// biome-ignore lint/correctness/useHookAtTopLevel: gl.useProgram is a WebGL API call, not a React hook
	gl.useProgram(program);
	const positionLocation = gl.getAttribLocation(program, "a_position");
	gl.enableVertexAttribArray(positionLocation);
	gl.vertexAttribPointer(positionLocation, 2, gl.FLOAT, false, 0, 0);

	const canvasSizeLocation = gl.getUniformLocation(program, "u_canvasSize");
	const matrixLocation = gl.getUniformLocation(program, "u_destinationToTexture");
	const modeLocation = gl.getUniformLocation(program, "u_mode");
	const opacityLocation = gl.getUniformLocation(program, "u_opacity");
	const brightnessLocation = gl.getUniformLocation(program, "u_brightness");
	const contrastLocation = gl.getUniformLocation(program, "u_contrast");
	const saturationLocation = gl.getUniformLocation(program, "u_saturation");
	const bgBrightnessLocation = gl.getUniformLocation(program, "u_bgBrightness");
	const bgContrastLocation = gl.getUniformLocation(program, "u_bgContrast");
	const bgSaturationLocation = gl.getUniformLocation(program, "u_bgSaturation");
	const textureSizeLocation = gl.getUniformLocation(program, "u_textureSize");
	const cornerRadiusLocation = gl.getUniformLocation(program, "u_cornerRadius");
	gl.uniform2f(canvasSizeLocation, artboardSize.width, artboardSize.height);
	gl.uniformMatrix3fv(matrixLocation, false, getDestinationToTextureMatrix(settings.corners));
	gl.uniform1f(opacityLocation, settings.opacity);
	gl.uniform1f(brightnessLocation, settings.brightness);
	gl.uniform1f(contrastLocation, settings.contrast);
	gl.uniform1f(saturationLocation, settings.saturation);
	gl.uniform1f(bgBrightnessLocation, settings.bgBrightness);
	gl.uniform1f(bgContrastLocation, settings.bgContrast);
	gl.uniform1f(bgSaturationLocation, settings.bgSaturation);
	gl.uniform2f(textureSizeLocation, screenshotSize.width, screenshotSize.height);
	gl.uniform1f(cornerRadiusLocation, settings.cornerRadius);

	const createTexture = (source: TexImageSource) => {
		const texture = gl.createTexture();
		gl.bindTexture(gl.TEXTURE_2D, texture);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
		gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
		gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
		return texture;
	};

	const backgroundTexture = createTexture(background);
	const screenshotTexture = createTexture(screenshot);
	gl.viewport(0, 0, canvas.width, canvas.height);
	gl.enable(gl.BLEND);
	gl.blendFunc(gl.SRC_ALPHA, gl.ONE_MINUS_SRC_ALPHA);

	const drawTexture = (texture: WebGLTexture, mode: number, source?: TexImageSource) => {
		gl.bindTexture(gl.TEXTURE_2D, texture);
		if (source) {
			gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, source);
		}
		gl.uniform1f(modeLocation, mode);
		gl.drawArrays(gl.TRIANGLES, 0, 6);
	};

	return () => {
		gl.clearColor(0, 0, 0, 0);
		gl.clear(gl.COLOR_BUFFER_BIT);
		if (settings.screenshotAbove) {
			drawTexture(backgroundTexture, 0);
			drawTexture(screenshotTexture, 1, screenshot);
		} else {
			drawTexture(screenshotTexture, 1, screenshot);
			drawTexture(backgroundTexture, 0);
		}
	};
}

function readSettingsFromUrl(): Settings {
	if (typeof window === "undefined") return DEFAULT_SETTINGS;

	const params = new URLSearchParams(window.location.search);
	const corners = structuredClone(DEFAULT_SETTINGS.corners);

	for (const key of CORNER_KEYS) {
		const x = Number(params.get(`${key}x`));
		const y = Number(params.get(`${key}y`));
		if (Number.isFinite(x) && params.has(`${key}x`)) corners[key].x = x;
		if (Number.isFinite(y) && params.has(`${key}y`)) corners[key].y = y;
	}

	const readNumber = (key: string, fallback: number) => {
		const value = Number(params.get(key));
		return Number.isFinite(value) && params.has(key) ? value : fallback;
	};

	return {
		corners,
		projectionScale: readNumber("scale", DEFAULT_SETTINGS.projectionScale),
		cornerRadius: readNumber("radius", DEFAULT_SETTINGS.cornerRadius),
		opacity: readNumber("opacity", DEFAULT_SETTINGS.opacity),
		brightness: readNumber("brightness", DEFAULT_SETTINGS.brightness),
		contrast: readNumber("contrast", DEFAULT_SETTINGS.contrast),
		saturation: readNumber("saturation", DEFAULT_SETTINGS.saturation),
		bgBrightness: readNumber("bgBrightness", DEFAULT_SETTINGS.bgBrightness),
		bgContrast: readNumber("bgContrast", DEFAULT_SETTINGS.bgContrast),
		bgSaturation: readNumber("bgSaturation", DEFAULT_SETTINGS.bgSaturation),
		screenshotAbove: params.get("layer") === "above",
	};
}

function settingsToParams(settings: Settings) {
	const params = new URLSearchParams();

	for (const key of CORNER_KEYS) {
		params.set(`${key}x`, String(Math.round(settings.corners[key].x)));
		params.set(`${key}y`, String(Math.round(settings.corners[key].y)));
	}

	params.set("opacity", settings.opacity.toFixed(2));
	params.set("scale", settings.projectionScale.toFixed(2));
	params.set("radius", settings.cornerRadius.toFixed(0));
	params.set("brightness", settings.brightness.toFixed(2));
	params.set("contrast", settings.contrast.toFixed(2));
	params.set("saturation", settings.saturation.toFixed(2));
	params.set("bgBrightness", settings.bgBrightness.toFixed(2));
	params.set("bgContrast", settings.bgContrast.toFixed(2));
	params.set("bgSaturation", settings.bgSaturation.toFixed(2));
	params.set("layer", settings.screenshotAbove ? "above" : "below");
	return params;
}

export default function CutoutPage() {
	const [
		{ settings, frameRatio, cropPosition, customCropRect },
		{
			setState: setEditorState,
			resetState: resetEditorState,
			beginTransaction: beginHistoryTransaction,
			endTransaction: endHistoryTransaction,
			undo,
			redo,
		},
	] = useHistoryState<EditorState>(createInitialEditorState);
	const [screenshotSrc, setScreenshotSrc] = useState(flintRecordingImage.src);
	const [screenshotName, setScreenshotName] = useState(EXAMPLE_IMAGE_NAME);
	const [screenshotSize, setScreenshotSize] = useState(DEFAULT_SCREENSHOT_SIZE);
	const [mediaKind, setMediaKind] = useState<MediaKind>("image");
	const [showVideo, setShowVideo] = useState(false);
	const [backgroundSrc, setBackgroundSrc] = useState(handCutout.src);
	const [backgroundName, setBackgroundName] = useState("hand-cutout.png");
	const [artboardSize, setArtboardSize] = useState(DEFAULT_ARTBOARD_SIZE);
	const [cropBadgeEditor, setCropBadgeEditor] = useState<"ratio" | "dimensions" | null>(null);
	const [cropBadgeDraft, setCropBadgeDraft] = useState("");
	const [showGuides, setShowGuides] = useState(false);
	// Which layer the adjustment sliders target. "background" = the mockup PNG,
	// "image" = the projected screenshot/recording. UI-only, not persisted.
	const [adjustTarget, setAdjustTarget] = useState<"background" | "image">("background");
	const [copied, setCopied] = useState<"url" | "params" | null>(null);
	const [isDownloading, setIsDownloading] = useState(false);
	// Pill feedback: render progress (0–1) for video, and a brief "Done √" flash.
	const [dlProgress, setDlProgress] = useState<number | null>(null);
	const [dlDone, setDlDone] = useState(false);
	const dlDoneTimer = useRef<number | null>(null);
	const [stageWidth, setStageWidth] = useState(DEFAULT_ARTBOARD_SIZE.width);
	const stageShellRef = useRef<HTMLDivElement>(null);
	const artboardRef = useRef<HTMLDivElement>(null);
	const screenshotInputRef = useRef<HTMLInputElement>(null);
	const backgroundInputRef = useRef<HTMLInputElement>(null);
	const screenshotObjectUrlRef = useRef<string | null>(null);
	const backgroundObjectUrlRef = useRef<string | null>(null);
	const projectionDragRef = useRef<{
		pointerId: number;
		origin: Point;
		corners: Settings["corners"];
	} | null>(null);
	const edgeDragRef = useRef<{
		pointerId: number;
		edge: ProjectionEdge;
		origin: Point;
		corners: Settings["corners"];
	} | null>(null);
	const cropDragRef = useRef<{
		pointerId: number;
		origin: Point;
		rect: CropRect;
	} | null>(null);
	const cropEdgeDragRef = useRef<{
		pointerId: number;
		edge: FrameEdge;
		origin: Point;
		rect: CropRect;
	} | null>(null);
	const rotationDragRef = useRef<{
		pointerId: number;
		center: Point;
		startAngle: number;
		corners: Settings["corners"];
	} | null>(null);
	const transform = useMemo(
		() => getPerspectiveTransform(settings.corners, screenshotSize),
		[settings.corners, screenshotSize],
	);
	const scale = stageWidth / artboardSize.width;
	const rotationGuide = useMemo(
		() => getRotationGuide(settings.corners, 36 / scale),
		[scale, settings.corners],
	);
	const cropRect = useMemo(
		() =>
			frameRatio === "custom"
				? customCropRect
				: getCropRect(artboardSize, frameRatio, cropPosition),
		[artboardSize, cropPosition, customCropRect, frameRatio],
	);

	useEffect(() => {
		resetEditorState({
			...createInitialEditorState(),
			settings: readSettingsFromUrl(),
		});
	}, [resetEditorState]);

	useEffect(() => {
		const handleKeyDown = (event: KeyboardEvent) => {
			if (isEditableTarget(event.target) || event.altKey) return;

			const key = event.key.toLowerCase();
			const modifier = event.metaKey || event.ctrlKey;
			if (!modifier || (key !== "z" && key !== "y")) return;

			event.preventDefault();
			if (key === "y" || event.shiftKey) {
				redo();
			} else {
				undo();
			}
		};

		window.addEventListener("keydown", handleKeyDown);
		return () => window.removeEventListener("keydown", handleKeyDown);
	}, [redo, undo]);

	useEffect(() => {
		const stage = stageShellRef.current;
		if (!stage) return;

		const observer = new ResizeObserver(([entry]) => {
			setStageWidth(entry.contentRect.width);
		});
		observer.observe(stage);
		return () => observer.disconnect();
	}, []);

	useEffect(
		() => () => {
			if (screenshotObjectUrlRef.current) URL.revokeObjectURL(screenshotObjectUrlRef.current);
			if (backgroundObjectUrlRef.current) URL.revokeObjectURL(backgroundObjectUrlRef.current);
		},
		[],
	);

	const getArtboardPoint = (clientX: number, clientY: number) => {
		const artboard = artboardRef.current;
		if (!artboard) return null;

		const bounds = artboard.getBoundingClientRect();
		return {
			x: ((clientX - bounds.left) / bounds.width) * artboardSize.width,
			y: ((clientY - bounds.top) / bounds.height) * artboardSize.height,
		};
	};

	const setSettings = (action: React.SetStateAction<Settings>) => {
		setEditorState((current) => ({
			...current,
			settings: typeof action === "function" ? action(current.settings) : action,
		}));
	};

	const setFrameRatio = (action: React.SetStateAction<FrameRatio>) => {
		setEditorState((current) => ({
			...current,
			frameRatio: typeof action === "function" ? action(current.frameRatio) : action,
		}));
	};

	const setCropPosition = (action: React.SetStateAction<Point>) => {
		setEditorState((current) => ({
			...current,
			cropPosition: typeof action === "function" ? action(current.cropPosition) : action,
		}));
	};

	const setCustomCropRect = (action: React.SetStateAction<CropRect>) => {
		setEditorState((current) => ({
			...current,
			customCropRect: typeof action === "function" ? action(current.customCropRect) : action,
		}));
	};

	const setCornerCoordinate = (key: CornerKey, axis: keyof Point, value: number) => {
		if (!Number.isFinite(value)) return;
		setSettings((current) => ({
			...current,
			corners: {
				...current.corners,
				[key]: { ...current.corners[key], [axis]: value },
			},
		}));
	};

	const scaleProjection = (nextScale: number) => {
		setSettings((current) => ({
			...current,
			projectionScale: nextScale,
			corners: scaleProjectionCorners(current.corners, current.projectionScale, nextScale),
		}));
	};

	const moveCorner = (key: CornerKey, event: React.PointerEvent<HTMLButtonElement>) => {
		const point = getArtboardPoint(event.clientX, event.clientY);
		if (!point || event.buttons !== 1) return;

		setCornerCoordinate(key, "x", Math.round(Math.max(0, Math.min(artboardSize.width, point.x))));
		setCornerCoordinate(key, "y", Math.round(Math.max(0, Math.min(artboardSize.height, point.y))));
	};

	const startProjectionDrag = (event: React.PointerEvent<SVGPolygonElement>) => {
		const origin = getArtboardPoint(event.clientX, event.clientY);
		if (!origin) return;

		beginHistoryTransaction();
		event.currentTarget.setPointerCapture(event.pointerId);
		projectionDragRef.current = {
			pointerId: event.pointerId,
			origin,
			corners: structuredClone(settings.corners),
		};
	};

	const moveProjection = (event: React.PointerEvent<SVGPolygonElement>) => {
		const drag = projectionDragRef.current;
		const point = getArtboardPoint(event.clientX, event.clientY);
		if (!drag || !point || drag.pointerId !== event.pointerId) return;

		setSettings((current) => ({
			...current,
			corners: moveProjectionCorners(
				drag.corners,
				{ x: point.x - drag.origin.x, y: point.y - drag.origin.y },
				artboardSize,
			),
		}));
	};

	const startEdgeDrag = (edge: ProjectionEdge, event: React.PointerEvent<SVGLineElement>) => {
		const origin = getArtboardPoint(event.clientX, event.clientY);
		if (!origin) return;

		event.stopPropagation();
		setShowGuides(true);
		beginHistoryTransaction();
		event.currentTarget.setPointerCapture(event.pointerId);
		edgeDragRef.current = {
			pointerId: event.pointerId,
			edge,
			origin,
			corners: structuredClone(settings.corners),
		};
	};

	const moveEdge = (event: React.PointerEvent<SVGLineElement>) => {
		const drag = edgeDragRef.current;
		const point = getArtboardPoint(event.clientX, event.clientY);
		if (!drag || !point || drag.pointerId !== event.pointerId) return;

		const isHorizontalEdge = drag.edge === "top" || drag.edge === "bottom";
		const delta = isHorizontalEdge ? point.y - drag.origin.y : point.x - drag.origin.x;

		setSettings((current) => ({
			...current,
			corners: moveProjectionEdge(drag.corners, drag.edge, delta, event.altKey, artboardSize),
		}));
	};

	const startRotationDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
		const origin = getArtboardPoint(event.clientX, event.clientY);
		if (!origin) return;

		event.stopPropagation();
		setShowGuides(true);
		beginHistoryTransaction();
		event.currentTarget.setPointerCapture(event.pointerId);
		rotationDragRef.current = {
			pointerId: event.pointerId,
			center: rotationGuide.center,
			startAngle: Math.atan2(origin.y - rotationGuide.center.y, origin.x - rotationGuide.center.x),
			corners: structuredClone(settings.corners),
		};
	};

	const moveRotation = (event: React.PointerEvent<HTMLButtonElement>) => {
		const drag = rotationDragRef.current;
		const point = getArtboardPoint(event.clientX, event.clientY);
		if (!drag || !point || drag.pointerId !== event.pointerId) return;

		const angle = Math.atan2(point.y - drag.center.y, point.x - drag.center.x) - drag.startAngle;

		setSettings((current) => ({
			...current,
			corners: rotateProjection(drag.corners, drag.center, angle),
		}));
	};

	const startCropDrag = (event: React.PointerEvent<HTMLDivElement>) => {
		const origin = getArtboardPoint(event.clientX, event.clientY);
		if (!origin || frameRatio === "original") return;

		event.stopPropagation();
		setShowGuides(
			isPointInsidePolygon(
				origin,
				CORNER_KEYS.map((key) => settings.corners[key]),
			),
		);
		beginHistoryTransaction();
		event.currentTarget.setPointerCapture(event.pointerId);
		cropDragRef.current = {
			pointerId: event.pointerId,
			origin,
			rect: cropRect,
		};
	};

	const moveCrop = (event: React.PointerEvent<HTMLDivElement>) => {
		const drag = cropDragRef.current;
		const point = getArtboardPoint(event.clientX, event.clientY);
		if (!drag || !point || drag.pointerId !== event.pointerId) return;

		const availableX = artboardSize.width - drag.rect.width;
		const availableY = artboardSize.height - drag.rect.height;
		const x = Math.max(0, Math.min(availableX, drag.rect.x + point.x - drag.origin.x));
		const y = Math.max(0, Math.min(availableY, drag.rect.y + point.y - drag.origin.y));

		if (frameRatio === "custom") {
			setCustomCropRect({
				...drag.rect,
				x: Math.round(x),
				y: Math.round(y),
			});
			return;
		}

		setCropPosition({
			x: availableX > 0 ? x / availableX : 0.5,
			y: availableY > 0 ? y / availableY : 0.5,
		});
	};

	const startCropEdgeDrag = (edge: FrameEdge, event: React.PointerEvent<HTMLDivElement>) => {
		const origin = getArtboardPoint(event.clientX, event.clientY);
		if (!origin) return;

		event.stopPropagation();
		beginHistoryTransaction();
		event.currentTarget.setPointerCapture(event.pointerId);
		cropEdgeDragRef.current = {
			pointerId: event.pointerId,
			edge,
			origin,
			rect: cropRect,
		};
	};

	const moveCropEdge = (event: React.PointerEvent<HTMLDivElement>) => {
		const drag = cropEdgeDragRef.current;
		const point = getArtboardPoint(event.clientX, event.clientY);
		if (!drag || !point || drag.pointerId !== event.pointerId) return;

		const delta =
			drag.edge === "top" || drag.edge === "bottom"
				? point.y - drag.origin.y
				: point.x - drag.origin.x;
		if (delta === 0) return;

		setFrameRatio("custom");
		setCustomCropRect(resizeCropRect(drag.rect, drag.edge, delta, event.altKey, artboardSize));
	};

	const startCropBadgeEdit = (editor: "ratio" | "dimensions") => {
		beginHistoryTransaction();
		setCropBadgeDraft(
			editor === "ratio"
				? getAspectRatioLabel(cropRect.width, cropRect.height)
				: `${cropRect.width}x${cropRect.height}`,
		);
		setCropBadgeEditor(editor);
	};

	const commitCropBadgeEdit = () => {
		if (cropBadgeEditor === "ratio") {
			const match = cropBadgeDraft.match(/^\s*(\d+(?:\.\d+)?)\s*[:/]\s*(\d+(?:\.\d+)?)\s*$/);
			if (match) {
				const ratio = Number(match[1]) / Number(match[2]);
				if (Number.isFinite(ratio) && ratio > 0) {
					let width = cropRect.width;
					let height = width / ratio;
					if (height > artboardSize.height) {
						height = artboardSize.height;
						width = height * ratio;
					}
					setCustomCropRect(centerCropRect(width, height, cropRect, artboardSize));
					setFrameRatio("custom");
				}
			}
		} else if (cropBadgeEditor === "dimensions") {
			const match = cropBadgeDraft.match(/^\s*(\d+)\s*[x×]\s*(\d+)\s*$/i);
			if (match) {
				setCustomCropRect(
					centerCropRect(Number(match[1]), Number(match[2]), cropRect, artboardSize),
				);
				setFrameRatio("custom");
			}
		}

		setCropBadgeEditor(null);
		endHistoryTransaction();
	};

	const handleCropBadgeKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
		if (event.key === "Enter") {
			event.currentTarget.blur();
		} else if (event.key === "Escape") {
			setCropBadgeEditor(null);
			endHistoryTransaction();
		}
	};

	const copyUrl = async () => {
		const url = new URL(window.location.href);
		url.search = settingsToParams(settings).toString();
		window.history.replaceState(null, "", url);
		await navigator.clipboard.writeText(url.toString());
		setCopied("url");
		window.setTimeout(() => setCopied(null), 1500);
	};

	const copyParameters = async () => {
		await navigator.clipboard.writeText(
			JSON.stringify(
				{
					...settings,
					screenshot: { name: screenshotName, kind: mediaKind, ...screenshotSize },
					background: { name: backgroundName, ...artboardSize },
					exportFrame: { ratio: frameRatio, ...cropRect },
				},
				null,
				2,
			),
		);
		setCopied("params");
		window.setTimeout(() => setCopied(null), 1500);
	};

	const selectScreenshot = async (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (!file) return;

		const objectUrl = URL.createObjectURL(file);

		try {
			const isVideo = file.type.startsWith("video/");
			const size = isVideo
				? await loadVideo(objectUrl).then((video) => ({
						width: video.videoWidth,
						height: video.videoHeight,
					}))
				: await loadImage(objectUrl).then((image) => ({
						width: image.naturalWidth,
						height: image.naturalHeight,
					}));

			if (screenshotObjectUrlRef.current) URL.revokeObjectURL(screenshotObjectUrlRef.current);
			screenshotObjectUrlRef.current = objectUrl;
			setScreenshotSrc(objectUrl);
			setScreenshotName(file.name);
			setScreenshotSize(size);
			setMediaKind(isVideo ? "video" : "image");
			setShowVideo(isVideo);
		} catch {
			URL.revokeObjectURL(objectUrl);
		} finally {
			event.target.value = "";
		}
	};

	// Swap between the bundled still PNG and the mp4 example. The video's real
	// size is loaded asynchronously; a provisional size keeps the projection
	// valid in the meantime.
	const toggleExampleVideo = (checked: boolean) => {
		setShowVideo(checked);
		if (checked) {
			setScreenshotSrc(EXAMPLE_VIDEO_SRC);
			setScreenshotName(EXAMPLE_VIDEO_NAME);
			setMediaKind("video");
			setScreenshotSize(EXAMPLE_VIDEO_SIZE);
			loadVideo(EXAMPLE_VIDEO_SRC)
				.then((video) => setScreenshotSize({ width: video.videoWidth, height: video.videoHeight }))
				.catch(() => {});
		} else {
			setScreenshotSrc(flintRecordingImage.src);
			setScreenshotName(EXAMPLE_IMAGE_NAME);
			setMediaKind("image");
			setScreenshotSize(DEFAULT_SCREENSHOT_SIZE);
		}
	};

	const selectBackground = async (event: React.ChangeEvent<HTMLInputElement>) => {
		const file = event.target.files?.[0];
		if (!file) return;

		const objectUrl = URL.createObjectURL(file);
		const image = new Image();
		image.src = objectUrl;

		try {
			await image.decode();
			const nextSize = { width: image.naturalWidth, height: image.naturalHeight };
			if (backgroundObjectUrlRef.current) URL.revokeObjectURL(backgroundObjectUrlRef.current);
			backgroundObjectUrlRef.current = objectUrl;
			setBackgroundSrc(objectUrl);
			setBackgroundName(file.name);
			resetEditorState({
				settings: {
					...settings,
					corners: Object.fromEntries(
						CORNER_KEYS.map((key) => [
							key,
							{
								x: Math.round(settings.corners[key].x * (nextSize.width / artboardSize.width)),
								y: Math.round(settings.corners[key].y * (nextSize.height / artboardSize.height)),
							},
						]),
					) as Settings["corners"],
				},
				frameRatio,
				cropPosition,
				customCropRect: {
					x: Math.round(customCropRect.x * (nextSize.width / artboardSize.width)),
					y: Math.round(customCropRect.y * (nextSize.height / artboardSize.height)),
					width: Math.round(customCropRect.width * (nextSize.width / artboardSize.width)),
					height: Math.round(customCropRect.height * (nextSize.height / artboardSize.height)),
				},
			});
			setArtboardSize(nextSize);
		} catch {
			URL.revokeObjectURL(objectUrl);
		} finally {
			event.target.value = "";
		}
	};

	// Flash "Done ✓" on the pill, then revert after a beat.
	const flashDone = () => {
		setDlDone(true);
		if (dlDoneTimer.current) window.clearTimeout(dlDoneTimer.current);
		dlDoneTimer.current = window.setTimeout(() => setDlDone(false), 1500);
	};

	const downloadComposite = async () => {
		const artboard = artboardRef.current;
		if (!artboard || isDownloading) return;

		if (dlDoneTimer.current) window.clearTimeout(dlDoneTimer.current);
		setDlDone(false);
		setIsDownloading(true);
		try {
			if (mediaKind === "video") {
				const background = await loadImage(backgroundSrc);
				const sourceCanvas = document.createElement("canvas");
				sourceCanvas.width = screenshotSize.width;
				sourceCanvas.height = screenshotSize.height;

				const fullCanvas = document.createElement("canvas");
				fullCanvas.width = artboardSize.width;
				fullCanvas.height = artboardSize.height;
				const drawFrame = createVideoCompositor({
					canvas: fullCanvas,
					background,
					screenshot: sourceCanvas,
					screenshotSize,
					settings,
					artboardSize,
				});
				const outputCanvas = document.createElement("canvas");
				// The H.264 (avc) encoder rejects odd dimensions — both width and
				// height must be even. Round down so a 1280×811 crop becomes 1280×810.
				outputCanvas.width = Math.floor(cropRect.width / 2) * 2;
				outputCanvas.height = Math.floor(cropRect.height / 2) * 2;
				const outputContext = outputCanvas.getContext("2d");
				if (!outputContext) throw new Error("Could not create video crop canvas.");
				outputContext.imageSmoothingEnabled = true;
				outputContext.imageSmoothingQuality = "high";

				const drawOutputFrame = () => {
					drawFrame();
					outputContext.clearRect(0, 0, outputCanvas.width, outputCanvas.height);
					outputContext.drawImage(
						fullCanvas,
						cropRect.x,
						cropRect.y,
						cropRect.width,
						cropRect.height,
						0,
						0,
						outputCanvas.width,
						outputCanvas.height,
					);
				};
				setDlProgress(0);
				const blob = await exportCompositeVideo({
					sourceUrl: screenshotSrc,
					sourceCanvas,
					outputCanvas,
					drawFrame: drawOutputFrame,
					onProgress: setDlProgress,
				});
				const url = URL.createObjectURL(blob);
				const link = document.createElement("a");
				link.download = "flint-hand-mockup.mp4";
				link.href = url;
				link.click();
				window.setTimeout(() => URL.revokeObjectURL(url), 1000);
				flashDone();
				return;
			}

			const fullDataUrl = await domToPng(artboard, {
				width: artboardSize.width,
				height: artboardSize.height,
				scale: 1,
				style: { transform: "none" },
				filter: (node) => !(node instanceof Element && node.hasAttribute("data-export-ignore")),
			});
			const fullImage = await loadImage(fullDataUrl);
			const outputCanvas = document.createElement("canvas");
			outputCanvas.width = cropRect.width;
			outputCanvas.height = cropRect.height;
			const outputContext = outputCanvas.getContext("2d");
			if (!outputContext) throw new Error("Could not create image crop canvas.");
			outputContext.drawImage(
				fullImage,
				cropRect.x,
				cropRect.y,
				cropRect.width,
				cropRect.height,
				0,
				0,
				cropRect.width,
				cropRect.height,
			);
			const link = document.createElement("a");
			link.download = "flint-hand-mockup.png";
			link.href = outputCanvas.toDataURL("image/png");
			link.click();
			flashDone();
		} finally {
			setIsDownloading(false);
			setDlProgress(null);
		}
	};

	// Expose the header height as a CSS variable so the sticky preview can pin
	// directly below the (also sticky) header instead of at the document top.
	// Usage card is collapsed by default on mobile to save vertical space; it is
	// always shown on desktop (xl) regardless of this state.
	const [usageOpen, setUsageOpen] = useState(false);
	const headerRef = useRef<HTMLDivElement>(null);
	useEffect(() => {
		const header = headerRef.current;
		if (!header) return;
		const setVar = () =>
			document.documentElement.style.setProperty("--cutout-header-h", `${header.offsetHeight}px`);
		setVar();
		const observer = new ResizeObserver(setVar);
		observer.observe(header);
		return () => observer.disconnect();
	}, []);

	return (
		<div className="relative isolate min-h-screen bg-[#11100f] px-4 pb-5 text-[#eee9e2] sm:px-6 lg:px-8 xl:px-12">
			{/* Header backdrop — gradient + blur layered IN FRONT of the panel (z-20,
				below the z-30 header text). Panel cards scroll underneath it and get
				faded + blurred toward the header, so the sticky title/Home keep good
				contrast. pointer-events-none so it never intercepts scroll/clicks. Its
				height matches the header bar and is cancelled by a negative bottom margin
				so it overlaps the bar below instead of adding extra flow space. */}
			<div
				aria-hidden="true"
				className="pointer-events-none sticky top-0 z-20 -mx-4 backdrop-blur-md sm:-mx-6 lg:-mx-8 xl:-mx-12"
				style={{
					height: "var(--cutout-header-h, 76px)",
					marginBottom: "calc(-1 * var(--cutout-header-h, 76px))",
					background:
						"linear-gradient(to bottom, #11100f 0%, #11100f 45%, rgba(17,16,15,0.72) 62%, rgba(17,16,15,0) 100%)",
					WebkitMaskImage: "linear-gradient(to bottom, #000 62%, transparent 100%)",
					maskImage: "linear-gradient(to bottom, #000 62%, transparent 100%)",
				}}
			/>

			{/* Title + Home — on TOP of the panel (z-30) but transparent, so panel
				cards scroll through the gaps; only the text and Home pill stay above.
				Empty areas pass pointer events through to the cards behind. */}
			{/* biome-ignore lint/a11y/useSemanticElements: a global `header { position: fixed }` rule in global.css is meant for the site nav; using a real <header> here inherits it and breaks this page's sticky layout */}
			<div
				ref={headerRef}
				role="banner"
				className="pointer-events-none sticky top-0 z-30 flex items-start justify-between gap-4 pt-6 pb-4 xl:mx-auto xl:max-w-[1200px] xl:pt-6 xl:pb-6"
			>
				<div className="pointer-events-auto">
					<h1 className="text-2xl font-semibold tracking-[-0.025em]">Cutout Fixer</h1>
					<p className="mt-1 max-w-xl text-sm text-[#eee9e2]/60">
						Map a screenshot onto a 3D device mockup by dragging the four corners. Export a clean
						composite PNG, or a video when a recording is loaded.
					</p>
				</div>
				<a
					href="https://wzulfikar.com"
					className="pointer-events-auto inline-flex flex-none items-center gap-1.5 rounded-full border border-white/15 bg-white/5 px-3.5 py-1.5 text-sm font-medium text-[#eee9e2] backdrop-blur-md transition-colors hover:bg-white/10"
				>
					<HomeIcon className="h-4 w-4" />
					Home
				</a>
			</div>

			<div className="relative z-10 mx-auto grid max-w-[1200px] items-start gap-5 xl:grid-cols-[minmax(0,1fr)_360px]">
				<div className="contents xl:flex xl:flex-col xl:gap-5 xl:sticky xl:top-[var(--cutout-header-h,0px)] xl:self-start">
					<section className="sticky top-[var(--cutout-header-h,0px)] z-20 overflow-hidden rounded-[18px] border border-white/10 bg-black shadow-[0_24px_80px_rgba(0,0,0,0.45)] xl:static xl:z-auto">
						<div
							ref={stageShellRef}
							className="relative w-full overflow-hidden"
							style={{ height: artboardSize.height * scale }}
						>
							<div
								ref={artboardRef}
								className="absolute left-0 top-0 origin-top-left touch-none"
								onPointerDown={() => setShowGuides(false)}
								style={{
									width: artboardSize.width,
									height: artboardSize.height,
									transform: `scale(${scale})`,
								}}
							>
								{mediaKind === "video" ? (
									<video
										key={screenshotSrc}
										src={screenshotSrc}
										aria-label="Screen recording projected into the phone"
										autoPlay
										loop
										muted
										playsInline
										disablePictureInPicture
										disableRemotePlayback
										className="pointer-events-none absolute left-0 top-0 max-w-none [&::-webkit-media-controls-overlay-play-button]:!hidden [&::-webkit-media-controls-start-playback-button]:!hidden [&::-webkit-media-controls]:!hidden"
										style={{
											width: screenshotSize.width,
											height: screenshotSize.height,
											opacity: settings.opacity,
											filter: `brightness(${settings.brightness}) contrast(${settings.contrast}) saturate(${settings.saturation})`,
											borderRadius: settings.cornerRadius,
											transform,
											transformOrigin: "0 0",
											zIndex: settings.screenshotAbove ? 15 : 0,
										}}
									/>
								) : (
									<img
										src={screenshotSrc}
										alt="Flint recording screen projected into the phone"
										draggable={false}
										className="pointer-events-none absolute left-0 top-0 max-w-none"
										style={{
											width: screenshotSize.width,
											height: screenshotSize.height,
											opacity: settings.opacity,
											filter: `brightness(${settings.brightness}) contrast(${settings.contrast}) saturate(${settings.saturation})`,
											borderRadius: settings.cornerRadius,
											transform,
											transformOrigin: "0 0",
											zIndex: settings.screenshotAbove ? 15 : 0,
										}}
									/>
								)}

								<img
									src={backgroundSrc}
									alt="Hand holding a phone with a transparent display"
									draggable={false}
									className="pointer-events-none absolute inset-0 z-10 h-full w-full select-none"
									style={{
										filter: `brightness(${settings.bgBrightness}) contrast(${settings.bgContrast}) saturate(${settings.bgSaturation})`,
									}}
								/>

								<svg
									aria-hidden
									data-export-ignore
									viewBox={`0 0 ${artboardSize.width} ${artboardSize.height}`}
									className="pointer-events-none absolute inset-0 z-20 h-full w-full"
								>
									<polygon
										points={CORNER_KEYS.map(
											(key) => `${settings.corners[key].x},${settings.corners[key].y}`,
										).join(" ")}
										fill={showGuides ? "rgba(255, 180, 62, 0.08)" : "transparent"}
										stroke={showGuides ? "#ffb43e" : "transparent"}
										strokeDasharray="7 7"
										strokeWidth="1.5"
										vectorEffect="non-scaling-stroke"
										pointerEvents="all"
										className="cursor-move"
										onPointerDown={(event) => {
											event.stopPropagation();
											setShowGuides(true);
											startProjectionDrag(event);
										}}
										onPointerMove={moveProjection}
										onPointerUp={() => {
											projectionDragRef.current = null;
											endHistoryTransaction();
										}}
										onPointerCancel={() => {
											projectionDragRef.current = null;
											endHistoryTransaction();
										}}
									/>
									{showGuides &&
										(
											Object.entries(EDGE_CORNERS) as Array<
												[ProjectionEdge, [CornerKey, CornerKey]]
											>
										).map(([edge, [startKey, endKey]]) => (
											<line
												key={edge}
												x1={settings.corners[startKey].x}
												y1={settings.corners[startKey].y}
												x2={settings.corners[endKey].x}
												y2={settings.corners[endKey].y}
												stroke="transparent"
												strokeWidth="18"
												vectorEffect="non-scaling-stroke"
												pointerEvents="stroke"
												style={{
													cursor: edge === "top" || edge === "bottom" ? "ns-resize" : "ew-resize",
												}}
												onPointerDown={(event) => startEdgeDrag(edge, event)}
												onPointerMove={moveEdge}
												onPointerUp={() => {
													edgeDragRef.current = null;
													endHistoryTransaction();
												}}
												onPointerCancel={() => {
													edgeDragRef.current = null;
													endHistoryTransaction();
												}}
											/>
										))}
									{showGuides && (
										<line
											x1={rotationGuide.edgeCenter.x}
											y1={rotationGuide.edgeCenter.y}
											x2={rotationGuide.handle.x}
											y2={rotationGuide.handle.y}
											stroke="#ffb43e"
											strokeWidth="1.5"
											vectorEffect="non-scaling-stroke"
										/>
									)}
								</svg>

								{showGuides &&
									CORNER_KEYS.map((key) => {
										const point = settings.corners[key];
										return (
											<button
												key={key}
												type="button"
												data-export-ignore
												aria-label={`Move ${key.toUpperCase()} corner`}
												onPointerDown={(event) => {
													event.stopPropagation();
													setShowGuides(true);
													beginHistoryTransaction();
													event.currentTarget.setPointerCapture(event.pointerId);
													moveCorner(key, event);
												}}
												onPointerMove={(event) => moveCorner(key, event)}
												onPointerUp={endHistoryTransaction}
												onPointerCancel={endHistoryTransaction}
												className="absolute z-50 h-2 w-2 -translate-x-1/2 -translate-y-1/2 cursor-move rounded-full border border-black bg-[#ffb43e] shadow-[0_0_0_1px_rgba(255,255,255,0.9)]"
												style={{ left: point.x, top: point.y }}
											/>
										);
									})}

								{showGuides && (
									<button
										type="button"
										data-export-ignore
										aria-label="Rotate projection"
										onPointerDown={startRotationDrag}
										onPointerMove={moveRotation}
										onPointerUp={() => {
											rotationDragRef.current = null;
											endHistoryTransaction();
										}}
										onPointerCancel={() => {
											rotationDragRef.current = null;
											endHistoryTransaction();
										}}
										className="absolute z-50 grid -translate-x-1/2 -translate-y-1/2 cursor-grab touch-none place-items-center rounded-full border border-black bg-[#ffb43e] text-black shadow-[0_0_0_1px_rgba(255,255,255,0.9)] active:cursor-grabbing"
										style={{
											left: rotationGuide.handle.x,
											top: rotationGuide.handle.y,
											width: 24 / scale,
											height: 24 / scale,
										}}
									>
										<RotateCwIcon
											aria-hidden
											strokeWidth={2.25}
											style={{ width: 12 / scale, height: 12 / scale }}
										/>
									</button>
								)}

								{frameRatio !== "original" && (
									// biome-ignore lint/a11y/useSemanticElements: draggable crop frame that contains nested buttons, so it can't be a <button>
									<div
										data-export-ignore
										role="button"
										tabIndex={0}
										aria-label="Move export frame"
										onPointerDown={startCropDrag}
										onPointerMove={moveCrop}
										onPointerUp={() => {
											cropDragRef.current = null;
											endHistoryTransaction();
										}}
										onPointerCancel={() => {
											cropDragRef.current = null;
											endHistoryTransaction();
										}}
										className="absolute z-40 cursor-move border border-white/90 shadow-[0_0_0_9999px_rgba(0,0,0,0.58)]"
										style={{
											left: cropRect.x,
											top: cropRect.y,
											width: cropRect.width,
											height: cropRect.height,
										}}
									>
										<div
											className="absolute left-1.5 top-1.5 z-20 flex gap-1 font-mono text-[8px] leading-none text-white"
											onPointerDown={(event) => event.stopPropagation()}
										>
											{cropBadgeEditor === "ratio" ? (
												<input
													aria-label="Edit export frame ratio"
													value={cropBadgeDraft}
													onChange={(event) => setCropBadgeDraft(event.target.value)}
													onBlur={commitCropBadgeEdit}
													onKeyDown={handleCropBadgeKeyDown}
													className="h-4 w-12 rounded border border-[#ffb43e] bg-black/90 px-1 text-center font-mono text-[8px] text-white outline-none"
												/>
											) : (
												<button
													type="button"
													aria-label="Edit export frame ratio"
													onClick={() => startCropBadgeEdit("ratio")}
													className="cursor-text rounded bg-black/70 px-1.5 py-1"
												>
													{getAspectRatioLabel(cropRect.width, cropRect.height)}
												</button>
											)}
											{cropBadgeEditor === "dimensions" ? (
												<input
													aria-label="Edit export frame dimensions"
													value={cropBadgeDraft}
													onChange={(event) => setCropBadgeDraft(event.target.value)}
													onBlur={commitCropBadgeEdit}
													onKeyDown={handleCropBadgeKeyDown}
													className="h-4 w-16 rounded border border-[#ffb43e] bg-black/90 px-1 text-center font-mono text-[8px] text-white outline-none"
												/>
											) : (
												<button
													type="button"
													aria-label="Edit export frame dimensions"
													onClick={() => startCropBadgeEdit("dimensions")}
													className="cursor-text rounded bg-black/70 px-1.5 py-1"
												>
													{cropRect.width}x{cropRect.height}
												</button>
											)}
										</div>
										{FRAME_EDGES.map((edge) => {
											const horizontal = edge === "top" || edge === "bottom";
											const hitSize = 18 / scale;

											return (
												// biome-ignore lint/a11y/useSemanticElements: pointer-drag resize handle, not an <hr>
												// biome-ignore lint/a11y/useFocusableInteractive: pointer-only resize handle with no keyboard affordance
												<div
													key={edge}
													role="separator"
													aria-label={`Resize export frame ${edge} edge`}
													aria-orientation={horizontal ? "horizontal" : "vertical"}
													aria-valuenow={horizontal ? cropRect.height : cropRect.width}
													onPointerDown={(event) => startCropEdgeDrag(edge, event)}
													onPointerMove={moveCropEdge}
													onPointerUp={() => {
														cropEdgeDragRef.current = null;
														endHistoryTransaction();
													}}
													onPointerCancel={() => {
														cropEdgeDragRef.current = null;
														endHistoryTransaction();
													}}
													className="absolute z-10 touch-none"
													style={{
														...(horizontal
															? {
																	left: 0,
																	width: "100%",
																	height: hitSize,
																	[edge]: -hitSize / 2,
																}
															: {
																	top: 0,
																	width: hitSize,
																	height: "100%",
																	[edge]: -hitSize / 2,
																}),
														cursor: horizontal ? "ns-resize" : "ew-resize",
													}}
												/>
											);
										})}
									</div>
								)}
							</div>

							{/* Download pill, bottom-right of the preview (mirrors the Scrubly tool). */}
							<button
								type="button"
								onClick={downloadComposite}
								disabled={isDownloading}
								className="absolute bottom-[9px] right-[9px] z-30 inline-flex h-7 w-[118px] items-center justify-center overflow-hidden whitespace-nowrap rounded-full bg-black/60 px-2 text-[11px] font-semibold tabular-nums text-white backdrop-blur-sm transition-colors hover:bg-black/75 disabled:cursor-default"
							>
								{dlDone ? (
									"Done ✓"
								) : mediaKind === "video" ? (
									isDownloading ? (
										<>
											Rendering{" "}
											<span className="inline-block w-[3ch] text-right">
												{Math.round((dlProgress ?? 0) * 100)}
											</span>
											%
										</>
									) : (
										"Download MP4"
									)
								) : (
									"Download PNG"
								)}
							</button>
						</div>
					</section>

					<section className="rounded-[18px] border border-white/10 bg-[#1a1917] p-5 text-sm leading-6 text-[#b6b0a7] shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
						<button
							type="button"
							aria-expanded={usageOpen}
							onClick={() => setUsageOpen((open) => !open)}
							className="flex w-full items-center justify-between gap-2 text-left xl:cursor-default"
						>
							<span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[#8e8981]">
								Usage
							</span>
							<ChevronDownIcon
								className={`h-4 w-4 flex-none text-[#8e8981] transition-transform xl:hidden ${usageOpen ? "rotate-180" : ""}`}
							/>
						</button>
						<div className={`${usageOpen ? "block" : "hidden"} mt-3 xl:block`}>
							<ol className="list-decimal space-y-1.5 pl-5 marker:text-[#8e8981]">
								<li>
									Pick a <span className="text-[#eee9e2]">background</span> (the 3D mockup) and a{" "}
									<span className="text-[#eee9e2]">screenshot or recording</span> from the panel.
								</li>
								<li>
									Drag the four handles onto the display corners until the screenshot maps cleanly
									onto the device.
								</li>
								<li>
									Tune{" "}
									<span className="text-[#eee9e2]">
										scale, corner radius, opacity, brightness, contrast
									</span>{" "}
									and saturation so the cutout blends in.
								</li>
								<li>Use the projection coordinates to fine-tune corners by exact source pixels.</li>
								<li>Export the composite as a PNG, or a video when a recording is loaded.</li>
							</ol>
							<p className="mt-3 text-xs text-[#8e8981]">
								Tip: corner coordinates are stored in the URL — copy it to reopen the same
								calibration.
							</p>
						</div>
					</section>
				</div>

				<aside className="rounded-[18px] border border-white/10 bg-[#1a1917] p-5 pb-8 shadow-[0_24px_80px_rgba(0,0,0,0.28)]">
					<div className="grid grid-cols-2 gap-2">
						<input
							ref={screenshotInputRef}
							type="file"
							accept="image/png,image/jpeg,image/webp,video/mp4,video/webm,video/quicktime"
							onChange={selectScreenshot}
							className="hidden"
						/>
						<button
							type="button"
							onClick={() => backgroundInputRef.current?.click()}
							className="rounded-xl border border-white/10 px-3 py-2.5 text-left hover:bg-white/5"
						>
							<span className="block text-sm font-semibold">Select background image</span>
							<span className="block truncate text-[11px] text-[#77726b]">
								{backgroundName} · {artboardSize.width}×{artboardSize.height}
							</span>
						</button>

						<input
							ref={backgroundInputRef}
							type="file"
							accept="image/png,image/jpeg,image/webp"
							onChange={selectBackground}
							className="hidden"
						/>
						<button
							type="button"
							onClick={() => screenshotInputRef.current?.click()}
							className="rounded-xl border border-white/10 px-3 py-2.5 text-left hover:bg-white/5"
						>
							<span className="block text-sm font-semibold">Select screenshot or recording</span>
							<span className="block truncate text-[11px] text-[#77726b]">
								{screenshotName} · {mediaKind} · {screenshotSize.width}×{screenshotSize.height}
							</span>
						</button>
					</div>

					<div className="mt-2 grid grid-cols-3 gap-2">
						<label className="flex cursor-pointer items-start justify-between gap-1.5 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5">
							<span className="text-xs font-medium leading-tight">Show guides</span>
							<input
								type="checkbox"
								checked={showGuides}
								onChange={(event) => setShowGuides(event.target.checked)}
								className="mt-0.5 h-4 w-4 shrink-0 accent-[#ffb43e]"
							/>
						</label>

						<label className="flex cursor-pointer items-start justify-between gap-1.5 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5">
							<span className="text-xs font-medium leading-tight">Show video</span>
							<input
								type="checkbox"
								checked={showVideo}
								onChange={(event) => toggleExampleVideo(event.target.checked)}
								className="mt-0.5 h-4 w-4 shrink-0 accent-[#ffb43e]"
							/>
						</label>

						<label className="flex cursor-pointer items-start justify-between gap-1.5 rounded-xl border border-white/10 bg-black/20 px-3 py-2.5">
							<span className="text-xs font-medium leading-tight">Image on top</span>
							<input
								type="checkbox"
								checked={settings.screenshotAbove}
								onChange={(event) =>
									setSettings((current) => ({
										...current,
										screenshotAbove: event.target.checked,
									}))
								}
								className="mt-0.5 h-4 w-4 shrink-0 accent-[#ffb43e]"
							/>
						</label>
					</div>

					<div className="my-5 h-px bg-white/10" />

					<div className="mb-5 flex items-center justify-between gap-3">
						<div>
							<h2 className="font-semibold">Projection parameters</h2>
							<p className="mt-1 text-xs text-[#8e8981]">Coordinates use the source PNG pixels.</p>
						</div>
					</div>

					<div className="grid gap-3">
						{CORNER_KEYS.map((key) => (
							<fieldset key={key} className="grid grid-cols-[28px_1fr_1fr] items-center gap-2">
								<legend className="sr-only">{key.toUpperCase()} corner</legend>
								<CornerGlyph corner={key} />
								{(["x", "y"] as const).map((axis) => (
									<label key={axis} className="relative">
										<span className="pointer-events-none absolute left-2.5 top-1/2 -translate-y-1/2 font-mono text-[10px] uppercase text-[#77726b]">
											{axis}
										</span>
										<input
											type="number"
											step="1"
											value={Math.round(settings.corners[key][axis])}
											onChange={(event) =>
												setCornerCoordinate(key, axis, event.target.valueAsNumber)
											}
											onFocus={beginHistoryTransaction}
											onBlur={endHistoryTransaction}
											aria-label={`${key.toUpperCase()} ${axis.toUpperCase()}`}
											className="w-full min-w-0 rounded-lg border border-white/10 bg-black/30 py-2 pl-7 pr-2 font-mono text-sm outline-none focus:border-[#ffb43e]"
										/>
									</label>
								))}
							</fieldset>
						))}
					</div>

					<div className="my-5 h-px bg-white/10" />

					<fieldset className="mb-4 grid gap-3">
						<legend className="flex w-full items-center justify-between text-xs text-[#aaa49b]">
							Frame ratio
							<span className="font-mono text-[#77726b]">
								{cropRect.width}×{cropRect.height}
							</span>
						</legend>
						<div className="grid grid-cols-3 gap-1.5">
							{FRAME_RATIOS.map(({ value, label, ratio }) => {
								const selected = frameRatio === value;
								const visualRatio =
									value === "custom"
										? customCropRect.width / customCropRect.height
										: (ratio ?? artboardSize.width / artboardSize.height);
								const [name, dimensions] = label.includes(" (")
									? label.replace(")", "").split(" (")
									: [
											label,
											value === "custom"
												? `${customCropRect.width}×${customCropRect.height}`
												: `${artboardSize.width}:${artboardSize.height}`,
										];

								return (
									<button
										key={value}
										type="button"
										aria-pressed={selected}
										onClick={() => {
											setEditorState((current) => ({
												...current,
												frameRatio: value,
												cropPosition:
													value === "custom" ? current.cropPosition : { x: 0.5, y: 0.5 },
												customCropRect:
													value === "custom" && current.frameRatio !== "custom"
														? cropRect
														: current.customCropRect,
											}));
										}}
										className={`grid min-w-0 place-items-center gap-1 rounded-lg border px-1 py-2 transition-colors ${
											selected
												? "border-[#ffb43e] bg-[#ffb43e]/10 text-[#ffb43e]"
												: "border-white/10 text-[#77726b] hover:border-white/25 hover:text-[#aaa49b]"
										}`}
									>
										<span className="grid h-5 w-8 place-items-center">
											<span
												className="block rounded-[2px] border border-current"
												style={
													visualRatio >= 1
														? { width: 20, height: 20 / visualRatio }
														: { width: 20 * visualRatio, height: 20 }
												}
											/>
										</span>
										<span className="truncate text-[9px] leading-none">{name}</span>
										<span className="font-mono text-[8px] leading-none opacity-70">
											{dimensions}
										</span>
									</button>
								);
							})}
						</div>
					</fieldset>

					<fieldset className="mb-4 grid gap-3">
						<legend className="text-xs text-[#aaa49b]">Adjust</legend>
						<div className="grid grid-cols-2 gap-1.5">
							{(
								[
									{ value: "background", label: "Background" },
									{ value: "image", label: mediaKind === "video" ? "Recording" : "Image" },
								] as const
							).map(({ value, label }) => {
								const selected = adjustTarget === value;
								return (
									<button
										key={value}
										type="button"
										aria-pressed={selected}
										onClick={() => setAdjustTarget(value)}
										className={`rounded-lg border px-3 py-2 text-xs font-medium transition-colors ${
											selected
												? "border-[#ffb43e] bg-[#ffb43e]/10 text-[#ffb43e]"
												: "border-white/10 text-[#77726b] hover:border-white/25 hover:text-[#aaa49b]"
										}`}
									>
										{label}
									</button>
								);
							})}
						</div>
					</fieldset>

					<div className="grid gap-4">
						{adjustTarget === "image" && (
							<>
								<RangeControl
									label="Scale"
									value={settings.projectionScale}
									min={0.5}
									max={1.5}
									step={0.01}
									onChange={scaleProjection}
									onChangeStart={beginHistoryTransaction}
									onChangeEnd={endHistoryTransaction}
								/>
								<RangeControl
									label="Corner radius"
									value={settings.cornerRadius}
									min={0}
									max={Math.floor(Math.min(screenshotSize.width, screenshotSize.height) / 2)}
									step={1}
									fractionDigits={0}
									onChange={(cornerRadius) =>
										setSettings((current) => ({ ...current, cornerRadius }))
									}
									onChangeStart={beginHistoryTransaction}
									onChangeEnd={endHistoryTransaction}
								/>
								<RangeControl
									label="Opacity"
									value={settings.opacity}
									min={0}
									max={1}
									step={0.01}
									onChange={(opacity) => setSettings((current) => ({ ...current, opacity }))}
									onChangeStart={beginHistoryTransaction}
									onChangeEnd={endHistoryTransaction}
								/>
							</>
						)}
						<RangeControl
							label="Brightness"
							value={adjustTarget === "image" ? settings.brightness : settings.bgBrightness}
							min={0.4}
							max={1.4}
							step={0.01}
							onChange={(value) =>
								setSettings((current) =>
									adjustTarget === "image"
										? { ...current, brightness: value }
										: { ...current, bgBrightness: value },
								)
							}
							onChangeStart={beginHistoryTransaction}
							onChangeEnd={endHistoryTransaction}
						/>
						<RangeControl
							label="Contrast"
							value={adjustTarget === "image" ? settings.contrast : settings.bgContrast}
							min={0.5}
							max={1.5}
							step={0.01}
							onChange={(value) =>
								setSettings((current) =>
									adjustTarget === "image"
										? { ...current, contrast: value }
										: { ...current, bgContrast: value },
								)
							}
							onChangeStart={beginHistoryTransaction}
							onChangeEnd={endHistoryTransaction}
						/>
						<RangeControl
							label="Saturation"
							value={adjustTarget === "image" ? settings.saturation : settings.bgSaturation}
							min={0}
							max={1.5}
							step={0.01}
							onChange={(value) =>
								setSettings((current) =>
									adjustTarget === "image"
										? { ...current, saturation: value }
										: { ...current, bgSaturation: value },
								)
							}
							onChangeStart={beginHistoryTransaction}
							onChangeEnd={endHistoryTransaction}
						/>
					</div>

					<div className="mt-5 grid grid-cols-2 gap-2">
						<button
							type="button"
							onClick={copyUrl}
							className="rounded-xl border border-white/10 px-3 py-2.5 text-sm font-semibold hover:bg-white/5"
						>
							{copied === "url" ? "Copied" : "Copy URL"}
						</button>
						<button
							type="button"
							onClick={copyParameters}
							className="rounded-xl border border-white/10 px-3 py-2.5 text-sm font-semibold hover:bg-white/5"
						>
							{copied === "params" ? "Copied" : "Copy JSON"}
						</button>
						<button
							type="button"
							onClick={() =>
								setSettings({
									...structuredClone(DEFAULT_SETTINGS),
									corners: Object.fromEntries(
										CORNER_KEYS.map((key) => [
											key,
											{
												x: Math.round(
													DEFAULT_SETTINGS.corners[key].x *
														(artboardSize.width / DEFAULT_ARTBOARD_SIZE.width),
												),
												y: Math.round(
													DEFAULT_SETTINGS.corners[key].y *
														(artboardSize.height / DEFAULT_ARTBOARD_SIZE.height),
												),
											},
										]),
									) as Settings["corners"],
								})
							}
							className="col-span-2 rounded-xl border border-white/10 px-3 py-2 text-xs text-[#aaa49b] hover:bg-white/5"
						>
							Reset measured defaults
						</button>
					</div>

					<details className="mt-4 border-t border-white/10 pt-4">
						<summary className="cursor-pointer text-xs text-[#8e8981]">
							CSS transform matrix
						</summary>
						<code className="mt-3 block break-all rounded-lg bg-black/30 p-3 font-mono text-[10px] leading-4 text-[#b9b2a8]">
							{transform}
						</code>
					</details>
				</aside>
			</div>
		</div>
	);
}

function CornerGlyph({ corner }: { corner: CornerKey }) {
	const paths: Record<CornerKey, string> = {
		tl: "M18 5H10Q5 5 5 10V18",
		tr: "M6 5H14Q19 5 19 10V18",
		br: "M19 6V14Q19 19 14 19H6",
		bl: "M5 6V14Q5 19 10 19H18",
	};

	return (
		<svg
			aria-hidden
			viewBox="0 0 24 24"
			className="h-4 w-4 text-[#ffb43e]"
			fill="none"
			stroke="currentColor"
			strokeWidth="2"
			strokeLinecap="round"
			strokeLinejoin="round"
		>
			<path d={paths[corner]} />
		</svg>
	);
}

function RangeControl({
	label,
	value,
	min,
	max,
	step,
	fractionDigits = 2,
	onChange,
	onChangeStart,
	onChangeEnd,
}: {
	label: string;
	value: number;
	min: number;
	max: number;
	step: number;
	fractionDigits?: number;
	onChange: (value: number) => void;
	onChangeStart: () => void;
	onChangeEnd: () => void;
}) {
	return (
		<label className="grid gap-1.5">
			<span className="flex items-center justify-between text-xs text-[#aaa49b]">
				{label}
				<output className="font-mono text-[#eee9e2]">{value.toFixed(fractionDigits)}</output>
			</span>
			<input
				type="range"
				value={value}
				min={min}
				max={max}
				step={step}
				onChange={(event) => onChange(event.target.valueAsNumber)}
				onPointerDown={onChangeStart}
				onPointerUp={onChangeEnd}
				onPointerCancel={onChangeEnd}
				className="accent-[#ffb43e]"
			/>
		</label>
	);
}
