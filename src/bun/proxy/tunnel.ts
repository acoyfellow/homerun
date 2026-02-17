export function handleConnect(_req: Request, url: URL): Response {
	const [hostname, portStr] = (url.pathname || url.host).split(":");
	const port = Number.parseInt(portStr || "443", 10);

	if (!hostname) {
		return new Response("Bad Request: missing hostname", { status: 400 });
	}

	return new Response(null, {
		status: 200,
		statusText: "Connection Established",
		headers: {
			"X-Homerun-Tunnel": `${hostname}:${port}`,
		},
	});
}
