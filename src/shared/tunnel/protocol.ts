import { TunnelMessageType, type TunnelFrame, type TunnelRequestMeta, type TunnelResponseMeta, type TunnelErrorMeta } from "./types";

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

const HEADER_SIZE = 9;

function writeUint32BE(view: DataView, offset: number, value: number): void {
	view.setUint32(offset, value, false);
}

function readUint32BE(view: DataView, offset: number): number {
	return view.getUint32(offset, false);
}

export function encodeFrame(frame: TunnelFrame): ArrayBuffer {
	const type = frame.type;
	const requestId = frame.requestId;

	if (type === TunnelMessageType.PING || type === TunnelMessageType.PONG) {
		const buffer = new ArrayBuffer(HEADER_SIZE);
		const view = new DataView(buffer);
		view.setUint8(0, type);
		writeUint32BE(view, 1, requestId);
		writeUint32BE(view, 5, 0);
		return buffer;
	}

	const meta =
		type === TunnelMessageType.REQUEST
			? (frame as { meta: TunnelRequestMeta }).meta
			: type === TunnelMessageType.RESPONSE
				? (frame as { meta: TunnelResponseMeta }).meta
				: (frame as { meta: TunnelErrorMeta }).meta;

	const metaJson = JSON.stringify(meta);
	const metaBytes = textEncoder.encode(metaJson);
	const body = "body" in frame && frame.body ? frame.body : null;
	const bodySize = body ? body.byteLength : 0;

	const totalSize = HEADER_SIZE + metaBytes.byteLength + bodySize;
	const buffer = new ArrayBuffer(totalSize);
	const view = new DataView(buffer);
	const uint8 = new Uint8Array(buffer);

	view.setUint8(0, type);
	writeUint32BE(view, 1, requestId);
	writeUint32BE(view, 5, metaBytes.byteLength);

	uint8.set(metaBytes, HEADER_SIZE);

	if (body) {
		uint8.set(new Uint8Array(body), HEADER_SIZE + metaBytes.byteLength);
	}

	return buffer;
}

export function decodeFrame(data: ArrayBuffer): TunnelFrame {
	const view = new DataView(data);
	const type = view.getUint8(0) as TunnelMessageType;
	const requestId = readUint32BE(view, 1);
	const metaLen = readUint32BE(view, 5);

	if (type === TunnelMessageType.PING) {
		return { type: TunnelMessageType.PING, requestId };
	}

	if (type === TunnelMessageType.PONG) {
		return { type: TunnelMessageType.PONG, requestId };
	}

	const uint8 = new Uint8Array(data);
	const metaBytes = uint8.slice(HEADER_SIZE, HEADER_SIZE + metaLen);
	const metaJson = textDecoder.decode(metaBytes);
	const meta = JSON.parse(metaJson);

	const bodyBytes = uint8.slice(HEADER_SIZE + metaLen);
	const body: ArrayBuffer | null = bodyBytes.byteLength > 0 ? bodyBytes.slice().buffer : null;

	if (type === TunnelMessageType.REQUEST) {
		return { type: TunnelMessageType.REQUEST, requestId, meta: meta as TunnelRequestMeta, body };
	}

	if (type === TunnelMessageType.RESPONSE) {
		return { type: TunnelMessageType.RESPONSE, requestId, meta: meta as TunnelResponseMeta, body };
	}

	if (type === TunnelMessageType.ERROR) {
		return { type: TunnelMessageType.ERROR, requestId, meta: meta as TunnelErrorMeta };
	}

	throw new Error(`Unknown tunnel message type: ${type}`);
}

export function encodeRequest(
	requestId: number,
	method: string,
	url: string,
	headers: Record<string, string>,
	body: ArrayBuffer | null,
): ArrayBuffer {
	return encodeFrame({
		type: TunnelMessageType.REQUEST,
		requestId,
		meta: { method, url, headers },
		body,
	});
}

export function encodeResponse(
	requestId: number,
	status: number,
	statusText: string,
	headers: Record<string, string>,
	body: ArrayBuffer | null,
): ArrayBuffer {
	return encodeFrame({
		type: TunnelMessageType.RESPONSE,
		requestId,
		meta: { status, statusText, headers },
		body,
	});
}

export function encodePing(requestId: number): ArrayBuffer {
	return encodeFrame({ type: TunnelMessageType.PING, requestId });
}

export function encodePong(requestId: number): ArrayBuffer {
	return encodeFrame({ type: TunnelMessageType.PONG, requestId });
}

export function encodeError(requestId: number, message: string, code?: string): ArrayBuffer {
	return encodeFrame({
		type: TunnelMessageType.ERROR,
		requestId,
		meta: { message, code },
	});
}
