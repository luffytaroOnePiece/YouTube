const ALLOWED_ORIGIN = "https://luffytaroonepiece.github.io";

export default {
  async fetch(request, env) {
    const origin = request.headers.get("Origin") || "";

    const headers = {
      "Access-Control-Allow-Origin": ALLOWED_ORIGIN,
      "Access-Control-Allow-Methods": "GET, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
      "Content-Type": "application/json",
      Vary: "Origin",
    };

    if (origin && origin !== ALLOWED_ORIGIN) {
      return Response.json({ error: "Forbidden origin" }, { status: 403 });
    }

    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers });
    }

    const url = new URL(request.url);

    if (url.pathname === "/health") {
      return Response.json({ status: "OK" }, { headers });
    }

    if (url.pathname !== "/search") {
      return Response.json({ error: "Not found" }, { status: 404, headers });
    }

    const q = url.searchParams.get("q")?.trim();

    if (!q || q.length > 150) {
      return Response.json(
        { error: "Invalid query" },
        {
          status: 400,
          headers,
        },
      );
    }

    if (!env.YOUTUBE_API_KEY) {
      return Response.json(
        { error: "API key missing" },
        {
          status: 500,
          headers,
        },
      );
    }

    const api = new URL("https://www.googleapis.com/youtube/v3/search");

    api.search = new URLSearchParams({
      part: "snippet",
      type: "video",
      maxResults: "20",
      q,
      key: env.YOUTUBE_API_KEY,
    });

    const response = await fetch(api);
    const data = await response.json();

    if (!response.ok) {
      return Response.json(
        {
          error: data.error?.message || "YouTube API error",
        },
        { status: response.status, headers },
      );
    }

    const videos = (data.items || []).map((v) => ({
      id: v.id.videoId,
      title: v.snippet.title,
      channel: v.snippet.channelTitle,
      description: v.snippet.description,
      thumbnail: v.snippet.thumbnails.high.url,
      publishedAt: v.snippet.publishedAt,
    }));

    return Response.json({ videos }, { headers });
  },
};
