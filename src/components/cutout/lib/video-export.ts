import {
	ALL_FORMATS,
	BlobSource,
	BufferTarget,
	CanvasSource,
	Input,
	Mp4OutputFormat,
	Output,
	VideoSampleSink,
} from "mediabunny";

type ExportCompositeVideoOptions = {
	sourceUrl: string;
	sourceCanvas: HTMLCanvasElement;
	outputCanvas: HTMLCanvasElement;
	drawFrame: () => void;
	onProgress?: (fraction: number) => void;
};

export async function exportCompositeVideo({
	sourceUrl,
	sourceCanvas,
	outputCanvas,
	drawFrame,
	onProgress,
}: ExportCompositeVideoOptions) {
	const sourceBlob = await fetch(sourceUrl).then((response) => {
		if (!response.ok) throw new Error("Could not read the selected video.");
		return response.blob();
	});
	const input = new Input({
		source: new BlobSource(sourceBlob),
		formats: ALL_FORMATS,
	});

	try {
		const inputTrack = await input.getPrimaryVideoTrack();
		if (!inputTrack) throw new Error("The selected file does not contain a video track.");

		const sourceContext = sourceCanvas.getContext("2d");
		if (!sourceContext) throw new Error("Could not create video frame canvas.");

		const target = new BufferTarget();
		const output = new Output({
			format: new Mp4OutputFormat({ fastStart: "in-memory" }),
			target,
		});
		const canvasSource = new CanvasSource(outputCanvas, {
			codec: "avc",
			bitrate: 40_000_000,
			bitrateMode: "variable",
			latencyMode: "quality",
			keyFrameInterval: 2,
			contentHint: "detail",
		});
		output.addVideoTrack(canvasSource);
		await output.start();

		// Best-effort duration for the progress pill. computeDuration() walks the
		// track to the last sample and can reject for some files/containers — it
		// must never break the export, so fall back to no progress animation.
		let totalDuration = 0;
		if (onProgress) {
			try {
				totalDuration = await inputTrack.computeDuration();
			} catch {
				totalDuration = 0;
			}
		}

		const sink = new VideoSampleSink(inputTrack);
		let firstTimestamp: number | null = null;

		onProgress?.(0);
		for await (const sample of sink.samples()) {
			firstTimestamp ??= sample.timestamp;
			const timestamp = Math.max(0, sample.timestamp - firstTimestamp);
			const duration = Math.max(0, sample.duration);

			sourceContext.clearRect(0, 0, sourceCanvas.width, sourceCanvas.height);
			sample.draw(sourceContext, 0, 0, sourceCanvas.width, sourceCanvas.height);
			sample.close();

			drawFrame();
			await canvasSource.add(timestamp, duration);

			if (onProgress && totalDuration > 0) {
				onProgress(Math.min(1, (timestamp + duration) / totalDuration));
			}
		}
		onProgress?.(1);

		canvasSource.close();
		await output.finalize();
		if (!target.buffer) throw new Error("The video encoder did not produce an MP4.");

		return new Blob([target.buffer], { type: await output.getMimeType() });
	} finally {
		input.dispose();
	}
}
