import React, { useState, useRef, useCallback, useEffect } from "react";

const THEMES = [
  { id: "cinematic", label: "🎬 Cinematic" },
  { id: "neon", label: "🌈 Neon Glow" },
  { id: "minimal", label: "✨ Minimal" },
  { id: "vinyl", label: "🎵 Vinyl Record" },
  { id: "editorial", label: "📰 Editorial" },
];

const LABELS = [
  "NOW PLAYING",
  "ON REPEAT",
  "CURRENTLY VIBING",
  "FAVORITE TRACK",
];

function parseSongAndArtist(title, fallback = "") {
  if (!title) return { song: "Untitled", artist: fallback || "YouTube Music" };
  let cleaned = title
    .replace(
      /\s*(\(|\[)?(8K|4K|2K|1080p|60\s*FPS|Full\s*Video|Video\s*Song|Official\s*(Video|Audio|Music\s*Video)?|HD|Lyric(al)?|Audio)(\)|\])?/gi,
      "",
    )
    .trim();
  for (const sep of [" | ", " - ", " – ", " — ", " // "]) {
    if (cleaned.includes(sep)) {
      const parts = cleaned
        .split(sep)
        .map((p) => p.trim())
        .filter(Boolean);
      if (parts.length >= 2)
        return { song: parts[0], artist: parts.slice(1).join(" • ") };
    }
  }
  return { song: cleaned || title, artist: fallback || "YouTube Music" };
}

export default function StoryPoster({ video, onClose }) {
  const canvasRef = useRef(null);
  const previewCanvasRef = useRef(null);

  const parsed = parseSongAndArtist(
    video?.title,
    video?.type || video?.category,
  );
  const [song, setSong] = useState(parsed.song);
  const [artist, setArtist] = useState(parsed.artist);
  const [theme, setTheme] = useState("cinematic");
  const [label, setLabel] = useState("NOW PLAYING");
  const [thumbnailImg, setThumbnailImg] = useState(null);
  const [loading, setLoading] = useState(true);
  const [ready, setReady] = useState(false);
  const [copied, setCopied] = useState(false);

  // Load thumbnail from YouTube
  useEffect(() => {
    if (!video?.youtubeLinkID) return;
    setLoading(true);
    setReady(false);
    setThumbnailImg(null);
    let mounted = true;
    const urls = [
      video.thumbnail,
      `https://i.ytimg.com/vi/${video.youtubeLinkID}/maxresdefault.jpg`,
      `https://img.youtube.com/vi/${video.youtubeLinkID}/maxresdefault.jpg`,
      `https://i.ytimg.com/vi/${video.youtubeLinkID}/sddefault.jpg`,
      `https://i.ytimg.com/vi/${video.youtubeLinkID}/hqdefault.jpg`,
    ].filter(Boolean);

    (async () => {
      for (const url of urls) {
        if (!mounted) return;
        try {
          const img = await new Promise((res, rej) => {
            const i = new Image();
            i.crossOrigin = "anonymous";
            i.onload = () => res(i);
            i.onerror = rej;
            i.src = url;
          });
          if (img.naturalWidth > 150 && mounted) {
            setThumbnailImg(img);
            setLoading(false);
            return;
          }
        } catch {
          /* try next */
        }
      }
      if (mounted) setLoading(false);
    })();
    return () => {
      mounted = false;
    };
  }, [video?.youtubeLinkID, video?.thumbnail]);

  // Re-render whenever inputs change
  useEffect(() => {
    if (thumbnailImg) {
      renderPoster();
      setReady(true);
    }
  }, [thumbnailImg, theme, label, song, artist]);

  // ─── Color Helpers ───
  const col = {
    avg: (img) => {
      const c = document.createElement("canvas");
      c.width = 50;
      c.height = 50;
      const x = c.getContext("2d");
      x.drawImage(img, 0, 0, 50, 50);
      const d = x.getImageData(0, 0, 50, 50).data;
      let r = 0,
        g = 0,
        b = 0,
        n = 0;
      for (let i = 0; i < d.length; i += 4) {
        r += d[i];
        g += d[i + 1];
        b += d[i + 2];
        n++;
      }
      return {
        r: Math.round(r / n),
        g: Math.round(g / n),
        b: Math.round(b / n),
      };
    },
    regions: (img) => {
      const c = document.createElement("canvas");
      c.width = 100;
      c.height = 100;
      const x = c.getContext("2d");
      x.drawImage(img, 0, 0, 100, 100);
      const d = x.getImageData(0, 0, 100, 100).data;
      const reg = {
        top: { r: 0, g: 0, b: 0, n: 0 },
        mid: { r: 0, g: 0, b: 0, n: 0 },
        bot: { r: 0, g: 0, b: 0, n: 0 },
      };
      for (let y2 = 0; y2 < 100; y2++)
        for (let x2 = 0; x2 < 100; x2++) {
          const i = (y2 * 100 + x2) * 4,
            r = y2 < 33 ? reg.top : y2 < 66 ? reg.mid : reg.bot;
          r.r += d[i];
          r.g += d[i + 1];
          r.b += d[i + 2];
          r.n++;
        }
      for (const k in reg) {
        const r = reg[k];
        r.r = Math.round(r.r / r.n);
        r.g = Math.round(r.g / r.n);
        r.b = Math.round(r.b / r.n);
      }
      return reg;
    },
    lighten: (c, a) => ({
      r: Math.min(255, c.r + a),
      g: Math.min(255, c.g + a),
      b: Math.min(255, c.b + a),
    }),
    darken: (c, a) => ({
      r: Math.max(0, c.r - a),
      g: Math.max(0, c.g - a),
      b: Math.max(0, c.b - a),
    }),
    sat: (c, f) => {
      const avg = (c.r + c.g + c.b) / 3;
      return {
        r: Math.min(255, Math.max(0, Math.round(avg + (c.r - avg) * f))),
        g: Math.min(255, Math.max(0, Math.round(avg + (c.g - avg) * f))),
        b: Math.min(255, Math.max(0, Math.round(avg + (c.b - avg) * f))),
      };
    },
    rgb: (c) => `rgb(${c.r},${c.g},${c.b})`,
    rgba: (c, a) => `rgba(${c.r},${c.g},${c.b},${a})`,
  };

  // ─── Canvas Helpers ───
  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  // Draw thumbnail at full natural 16:9 ratio spanning full poster width — no crop, no bars
  function drawThumb(ctx, img, dx, dy, dw) {
    const iw = img.naturalWidth || img.width;
    const ih = img.naturalHeight || img.height;
    const dh = Math.round(dw * (ih / iw)); // preserve aspect ratio
    ctx.drawImage(img, dx, dy, dw, dh);
    return dh; // return actual drawn height
  }

  function wrapText(ctx, text, x, y, maxW, lh, align = "center") {
    const prev = ctx.textAlign;
    ctx.textAlign = align;
    const words = text.split(" ");
    let line = "",
      cy = y;
    for (let i = 0; i < words.length; i++) {
      const test = line + words[i] + " ";
      if (ctx.measureText(test).width > maxW && i > 0) {
        ctx.fillText(line.trim(), x, cy);
        line = words[i] + " ";
        cy += lh;
      } else line = test;
    }
    ctx.fillText(line.trim(), x, cy);
    ctx.textAlign = prev;
    return cy;
  }

  function wrappedH(ctx, text, maxW, lh) {
    const words = text.split(" ");
    let line = "",
      lines = 1;
    for (let i = 0; i < words.length; i++) {
      const test = line + words[i] + " ";
      if (ctx.measureText(test).width > maxW && i > 0) {
        line = words[i] + " ";
        lines++;
      } else line = test;
    }
    return lines * lh;
  }

  function titleSize(text, max = 68, min = 42) {
    return Math.min(
      max,
      Math.max(min, max - Math.max(0, text.length - 15) * 1.1),
    );
  }

  const SYS_FONT =
    '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

  function drawLabel(ctx, x, y, text, accent) {
    ctx.save();
    ctx.textAlign = "center";
    ctx.font = `700 22px ${SYS_FONT}`;
    const tw = ctx.measureText(text).width;
    roundRect(ctx, x - tw / 2 - 30, y - 18, tw + 60, 40, 22);
    ctx.fillStyle = col.rgba(accent, 0.14);
    ctx.fill();
    ctx.strokeStyle = col.rgba(accent, 0.45);
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.beginPath();
    ctx.arc(x - tw / 2 - 10, y + 2, 5, 0, Math.PI * 2);
    ctx.fillStyle = col.rgb(accent);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.fillText(text, x + 8, y + 9);
    ctx.restore();
  }

  function drawPlayerBar(ctx, W, y, accent) {
    const bW = W - 220,
      bX = 110,
      prog = 0.42;
    // Track
    ctx.fillStyle = "rgba(255,255,255,0.1)";
    roundRect(ctx, bX, y, bW, 8, 4);
    ctx.fill();
    // Fill
    const gr = ctx.createLinearGradient(bX, 0, bX + bW * prog, 0);
    gr.addColorStop(0, col.rgb(accent));
    gr.addColorStop(1, col.rgb(col.lighten(accent, 40)));
    ctx.fillStyle = gr;
    roundRect(ctx, bX, y, bW * prog, 8, 4);
    ctx.fill();
    // Knob
    ctx.save();
    ctx.shadowColor = col.rgba(accent, 0.6);
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.arc(bX + bW * prog, y + 4, 13, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.restore();
    // Times
    ctx.font = `600 21px ${SYS_FONT}`;
    ctx.fillStyle = "rgba(255,255,255,0.5)";
    ctx.textAlign = "left";
    ctx.fillText("1:34", bX, y + 46);
    ctx.textAlign = "right";
    ctx.fillText(video?.duration || "3:45", bX + bW, y + 46);
    // Controls
    const cy2 = y + 105;
    // Prev
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.beginPath();
    ctx.moveTo(W / 2 - 96, cy2 - 14);
    ctx.lineTo(W / 2 - 116, cy2);
    ctx.lineTo(W / 2 - 96, cy2 + 14);
    ctx.fill();
    ctx.fillRect(W / 2 - 120, cy2 - 14, 4, 28);
    ctx.restore();
    // Play
    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.4)";
    ctx.shadowBlur = 20;
    ctx.beginPath();
    ctx.arc(W / 2, cy2, 36, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(W / 2 - 9, cy2 - 16);
    ctx.lineTo(W / 2 - 9, cy2 + 16);
    ctx.lineTo(W / 2 + 15, cy2);
    ctx.closePath();
    ctx.fillStyle = "#0a0a0f";
    ctx.fill();
    ctx.restore();
    // Next
    ctx.save();
    ctx.fillStyle = "rgba(255,255,255,0.6)";
    ctx.beginPath();
    ctx.moveTo(W / 2 + 96, cy2 - 14);
    ctx.lineTo(W / 2 + 116, cy2);
    ctx.lineTo(W / 2 + 96, cy2 + 14);
    ctx.fill();
    ctx.fillRect(W / 2 + 118, cy2 - 14, 4, 28);
    ctx.restore();
    // Return bottom edge of controls
    return cy2 + 50;
  }

  function drawYTBranding(ctx, W, y, light = false) {
    ctx.save();
    const x = W / 2;
    roundRect(ctx, x - 22, y - 16, 44, 32, 9);
    ctx.fillStyle = "#FF0000";
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(x - 7, y - 9);
    ctx.lineTo(x - 7, y + 9);
    ctx.lineTo(x + 9, y);
    ctx.closePath();
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.font = `600 17px ${SYS_FONT}`;
    ctx.textAlign = "center";
    ctx.fillStyle = light ? "#888" : "rgba(255,255,255,0.4)";
    ctx.fillText("WATCH ON YOUTUBE", x, y + 42);
    ctx.restore();
  }

  // ─── Theme Renderers ───
  function renderCinematic(ctx, W, H, s, a, avg, reg, acc, dark) {
    // Deep bg
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, col.rgb(col.darken(reg.top, 110)));
    bg.addColorStop(0.5, col.rgb(col.darken(avg, 95)));
    bg.addColorStop(1, col.rgb(col.darken(reg.bot, 120)));
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Blurred full-canvas backdrop
    ctx.save();
    ctx.filter = "blur(80px) brightness(0.4) saturate(1.3)";
    ctx.globalAlpha = 0.65;
    ctx.drawImage(thumbnailImg, -100, 0, W + 200, H);
    ctx.restore();

    // Top vignette
    const topV = ctx.createLinearGradient(0, 0, 0, 480);
    topV.addColorStop(0, "rgba(5,5,8,0.95)");
    topV.addColorStop(1, "rgba(5,5,8,0)");
    ctx.fillStyle = topV;
    ctx.fillRect(0, 0, W, 480);

    // Label
    drawLabel(ctx, W / 2, 190, label, acc);

    // Full-width thumbnail at natural 16:9 ratio
    const tY = 290;
    const tH = drawThumb(ctx, thumbnailImg, 0, tY, W);

    // Gradient fade below thumbnail into bg
    const fadeH = 160;
    const fade = ctx.createLinearGradient(0, tY + tH - fadeH, 0, tY + tH + 60);
    fade.addColorStop(0, "rgba(5,5,8,0)");
    fade.addColorStop(1, col.rgba(col.darken(avg, 95), 1));
    ctx.fillStyle = fade;
    ctx.fillRect(0, tY + tH - fadeH, W, fadeH + 60);

    // Text section flowing from thumbnail
    const textY = tY + tH + 80;
    const tSize = titleSize(s);
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.font = `800 ${tSize}px ${SYS_FONT}`;
    wrapText(ctx, s.toUpperCase(), W / 2, textY, W - 160, tSize * 1.18);
    const aY =
      textY + wrappedH(ctx, s.toUpperCase(), W - 160, tSize * 1.18) + 28;
    ctx.fillStyle = col.rgba(acc, 0.95);
    ctx.font = `600 36px ${SYS_FONT}`;
    ctx.fillText(a, W / 2, aY);
    // Player + branding flow right after artist
    const pEnd = drawPlayerBar(ctx, W, aY + 80, acc);
    drawYTBranding(ctx, W, pEnd + 60);
  }

  function renderNeon(ctx, W, H, s, a, avg, reg, acc, dark) {
    ctx.fillStyle = "#07060f";
    ctx.fillRect(0, 0, W, H);

    // Neon ambient blobs
    ctx.save();
    ctx.filter = "blur(130px)";
    ctx.globalAlpha = 0.42;
    ctx.fillStyle = col.rgb(col.sat(acc, 2.2));
    ctx.beginPath();
    ctx.ellipse(W * 0.2, H * 0.25, 340, 420, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = col.rgb(col.sat({ r: acc.b, g: acc.r, b: acc.g }, 2));
    ctx.beginPath();
    ctx.ellipse(W * 0.8, H * 0.75, 300, 370, 0, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();

    drawLabel(ctx, W / 2, 190, label, acc);

    // Full-width thumbnail with neon glow border lines
    const tY = 290;
    // Top neon line
    ctx.save();
    ctx.shadowColor = col.rgb(acc);
    ctx.shadowBlur = 20;
    ctx.strokeStyle = col.rgba(acc, 0.7);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, tY);
    ctx.lineTo(W, tY);
    ctx.stroke();
    ctx.restore();

    const tH = drawThumb(ctx, thumbnailImg, 0, tY, W);

    // Bottom neon line
    ctx.save();
    ctx.shadowColor = col.rgb(acc);
    ctx.shadowBlur = 20;
    ctx.strokeStyle = col.rgba(acc, 0.7);
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, tY + tH);
    ctx.lineTo(W, tY + tH);
    ctx.stroke();
    ctx.restore();

    const textY = tY + tH + 90;
    const tSize = titleSize(s);
    ctx.save();
    ctx.shadowColor = col.rgb(acc);
    ctx.shadowBlur = 28;
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.font = `900 ${tSize}px ${SYS_FONT}`;
    wrapText(ctx, s.toUpperCase(), W / 2, textY, W - 160, tSize * 1.18);
    ctx.restore();
    const aY =
      textY + wrappedH(ctx, s.toUpperCase(), W - 160, tSize * 1.18) + 28;
    ctx.fillStyle = col.rgba(acc, 0.95);
    ctx.font = `600 36px ${SYS_FONT}`;
    ctx.textAlign = "center";
    ctx.fillText(a, W / 2, aY);
    const pEnd = drawPlayerBar(ctx, W, aY + 80, acc);
    drawYTBranding(ctx, W, pEnd + 60);
  }

  function renderMinimal(ctx, W, H, s, a, avg, reg, acc, dark) {
    const bg = ctx.createLinearGradient(0, 0, 0, H);
    bg.addColorStop(0, "#0c0d12");
    bg.addColorStop(1, col.rgb(col.darken(avg, 110)));
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, W, H);

    // Label as plain text
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.font = `700 20px ${SYS_FONT}`;
    ctx.textAlign = "center";
    ctx.fillText(label.split("").join(" "), W / 2, 220);

    // Thumbnail with subtle rounded corners + padding
    const pad = 40,
      tY = 300;
    ctx.save();
    roundRect(ctx, pad, tY, W - pad * 2, 10000, 20);
    ctx.clip();
    const tH = drawThumb(ctx, thumbnailImg, pad, tY, W - pad * 2);
    ctx.restore();

    // Separator line
    const sepY = tY + tH + 70;
    ctx.strokeStyle = col.rgba(acc, 0.35);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(W / 2 - 130, sepY);
    ctx.lineTo(W / 2 + 130, sepY);
    ctx.stroke();

    const textY = sepY + 60;
    const tSize = titleSize(s, 58, 36);
    ctx.fillStyle = "#fff";
    ctx.textAlign = "center";
    ctx.font = `700 ${tSize}px ${SYS_FONT}`;
    wrapText(ctx, s, W / 2, textY, W - 220, tSize * 1.25);
    const aY = textY + wrappedH(ctx, s, W - 220, tSize * 1.25) + 24;
    ctx.fillStyle = col.rgba(acc, 0.85);
    ctx.font = `500 34px ${SYS_FONT}`;
    ctx.fillText(a, W / 2, aY);
    const pEnd = drawPlayerBar(ctx, W, aY + 80, acc);
    drawYTBranding(ctx, W, pEnd + 60);
  }

  function renderVinyl(ctx, W, H, s, a, avg, reg, acc, dark) {
    // ── Dark atmospheric background ──
    ctx.fillStyle = "#0d0b0e";
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.filter = "blur(100px) brightness(0.28) saturate(1.5)";
    ctx.globalAlpha = 0.9;
    ctx.drawImage(thumbnailImg, -200, -200, W + 400, H + 400);
    ctx.restore();

    // Radial spotlight
    const spotlight = ctx.createRadialGradient(
      W / 2,
      H * 0.38,
      0,
      W / 2,
      H * 0.38,
      700,
    );
    spotlight.addColorStop(0, col.rgba(acc, 0.08));
    spotlight.addColorStop(1, "rgba(0,0,0,0)");
    ctx.fillStyle = spotlight;
    ctx.fillRect(0, 0, W, H);

    // ── TOP: Album artwork at natural ratio ──
    const albumPad = 80;
    const albumW = W - albumPad * 2;
    const iw = thumbnailImg.naturalWidth || thumbnailImg.width;
    const ih = thumbnailImg.naturalHeight || thumbnailImg.height;
    const albumH = Math.round(albumW * (ih / iw));
    const albumY = 160;

    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.9)";
    ctx.shadowBlur = 60;
    ctx.shadowOffsetY = 20;
    roundRect(ctx, albumPad, albumY, albumW, albumH, 20);
    ctx.fillStyle = "#000";
    ctx.fill();
    ctx.restore();

    ctx.save();
    roundRect(ctx, albumPad, albumY, albumW, albumH, 20);
    ctx.clip();
    ctx.drawImage(thumbnailImg, albumPad, albumY, albumW, albumH);
    ctx.restore();

    // Sheen on album art
    const sheen = ctx.createLinearGradient(
      albumPad,
      albumY,
      albumPad + albumW,
      albumY + albumH,
    );
    sheen.addColorStop(0, "rgba(255,255,255,0.08)");
    sheen.addColorStop(0.5, "rgba(255,255,255,0)");
    sheen.addColorStop(1, "rgba(0,0,0,0.15)");
    ctx.save();
    roundRect(ctx, albumPad, albumY, albumW, albumH, 20);
    ctx.clip();
    ctx.fillStyle = sheen;
    ctx.fillRect(albumPad, albumY, albumW, albumH);
    ctx.restore();

    ctx.save();
    roundRect(ctx, albumPad, albumY, albumW, albumH, 20);
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    ctx.restore();

    // ── VINYL DISC overlapping bottom of album card ──
    const cx = W / 2;
    const discCY = albumY + albumH + 20;
    const discR = 340;

    ctx.save();
    ctx.shadowColor = "rgba(0,0,0,0.95)";
    ctx.shadowBlur = 100;
    ctx.shadowOffsetY = 30;
    ctx.beginPath();
    ctx.arc(cx, discCY, discR, 0, Math.PI * 2);
    ctx.fillStyle = "#0e0d10";
    ctx.fill();
    ctx.restore();

    ctx.beginPath();
    ctx.arc(cx, discCY, discR, 0, Math.PI * 2);
    ctx.fillStyle = "#0e0d10";
    ctx.fill();

    // Grooves
    for (let r = 80; r <= discR - 10; r += 6) {
      ctx.beginPath();
      ctx.arc(cx, discCY, r, 0, Math.PI * 2);
      const alpha = r % 18 === 0 ? 0.09 : 0.03;
      ctx.strokeStyle = `rgba(255,255,255,${alpha})`;
      ctx.lineWidth = r % 18 === 0 ? 1.5 : 0.8;
      ctx.stroke();
    }

    // Center label — thumbnail fill in circle
    const labelR = 160;
    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, discCY, labelR, 0, Math.PI * 2);
    ctx.clip();
    const lsc = Math.max((labelR * 2) / iw, (labelR * 2) / ih);
    const ldw = iw * lsc,
      ldh = ih * lsc;
    ctx.drawImage(thumbnailImg, cx - ldw / 2, discCY - ldh / 2, ldw, ldh);
    ctx.restore();

    ctx.beginPath();
    ctx.arc(cx, discCY, labelR, 0, Math.PI * 2);
    ctx.strokeStyle = col.rgba(acc, 0.6);
    ctx.lineWidth = 3;
    ctx.stroke();

    ctx.beginPath();
    ctx.arc(cx, discCY, labelR - 10, 0, Math.PI * 2);
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    ctx.stroke();

    ctx.save();
    ctx.beginPath();
    ctx.arc(cx, discCY, 16, 0, Math.PI * 2);
    ctx.fillStyle = "#0e0d10";
    ctx.fill();
    ctx.strokeStyle = col.rgba(acc, 0.3);
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();

    // ── TEXT BELOW DISC ──
    const textStartY = discCY + discR + 70;
    drawLabel(ctx, W / 2, textStartY, label, acc);

    const tSize = titleSize(s, 62, 38);
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "center";
    ctx.font = `800 ${tSize}px ${SYS_FONT}`;
    const titleY = textStartY + 70;
    wrapText(ctx, s.toUpperCase(), W / 2, titleY, W - 160, tSize * 1.18);

    const artY =
      titleY + wrappedH(ctx, s.toUpperCase(), W - 160, tSize * 1.18) + 24;
    ctx.fillStyle = col.rgba(acc, 0.9);
    ctx.font = `600 34px ${SYS_FONT}`;
    ctx.fillText(a, W / 2, artY);
    const pEnd = drawPlayerBar(ctx, W, artY + 76, acc);
    drawYTBranding(ctx, W, pEnd + 60);
  }

  function renderEditorial(ctx, W, H, s, a, avg, reg, acc, dark) {
    // ── Full dark base + blurred bg ──
    ctx.fillStyle = "#080810";
    ctx.fillRect(0, 0, W, H);
    ctx.save();
    ctx.filter = "blur(120px) brightness(0.2) saturate(1.2)";
    ctx.globalAlpha = 0.8;
    ctx.drawImage(thumbnailImg, -100, 0, W + 200, H);
    ctx.restore();

    // ── HERO: Full-bleed thumbnail ──
    const iw = thumbnailImg.naturalWidth || thumbnailImg.width;
    const ih = thumbnailImg.naturalHeight || thumbnailImg.height;
    const heroH = Math.round(W * (ih / iw));
    ctx.drawImage(thumbnailImg, 0, 0, W, heroH);

    // Deep gradient fade from bottom of photo
    const photoFade = ctx.createLinearGradient(0, heroH * 0.4, 0, heroH + 100);
    photoFade.addColorStop(0, "rgba(8,8,16,0)");
    photoFade.addColorStop(0.6, "rgba(8,8,16,0.75)");
    photoFade.addColorStop(1, "rgba(8,8,16,1)");
    ctx.fillStyle = photoFade;
    ctx.fillRect(0, heroH * 0.4, W, heroH * 0.6 + 100);

    // Top gradient for label readability
    const topGrad = ctx.createLinearGradient(0, 0, 0, 280);
    topGrad.addColorStop(0, "rgba(8,8,16,0.75)");
    topGrad.addColorStop(1, "rgba(8,8,16,0)");
    ctx.fillStyle = topGrad;
    ctx.fillRect(0, 0, W, 280);

    // Label overlaid on photo
    drawLabel(ctx, W / 2, 170, label, acc);

    // ── CONTENT SECTION ──
    const contentY = heroH + 60;

    // Accent rule
    const ruleGrad = ctx.createLinearGradient(80, 0, W - 80, 0);
    ruleGrad.addColorStop(0, "rgba(255,255,255,0)");
    ruleGrad.addColorStop(0.3, col.rgba(acc, 0.8));
    ruleGrad.addColorStop(0.7, col.rgba(acc, 0.8));
    ruleGrad.addColorStop(1, "rgba(255,255,255,0)");
    ctx.strokeStyle = ruleGrad;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(80, contentY);
    ctx.lineTo(W - 80, contentY);
    ctx.stroke();

    // Featured track label
    ctx.fillStyle = col.rgba(acc, 0.7);
    ctx.font = `700 20px ${SYS_FONT}`;
    ctx.textAlign = "left";
    ctx.fillText("▶  FEATURED TRACK", 80, contentY + 52);

    // Giant song title
    const tSize = titleSize(s, 80, 48);
    ctx.fillStyle = "#ffffff";
    ctx.textAlign = "left";
    ctx.font = `900 ${tSize}px ${SYS_FONT}`;
    const titleY = contentY + 110;
    wrapText(ctx, s, 80, titleY, W - 140, tSize * 1.1, "left");

    // Artist byline
    const artY = titleY + wrappedH(ctx, s, W - 140, tSize * 1.1) + 32;
    ctx.fillStyle = "rgba(255,255,255,0.45)";
    ctx.font = `400 28px ${SYS_FONT}`;
    ctx.fillText("BY", 80, artY);
    ctx.fillStyle = col.rgba(acc, 0.95);
    ctx.font = `700 32px ${SYS_FONT}`;
    ctx.fillText(
      a.toUpperCase(),
      80 + ctx.measureText("BY  ").width + 10,
      artY,
    );

    // Thin separator
    ctx.strokeStyle = "rgba(255,255,255,0.08)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(80, artY + 50);
    ctx.lineTo(W - 80, artY + 50);
    ctx.stroke();

    // Player scrubber — flows after separator
    const barY = artY + 80;
    const barW = W - 160;
    ctx.fillStyle = "rgba(255,255,255,0.08)";
    roundRect(ctx, 80, barY, barW, 5, 3);
    ctx.fill();

    const progGrad = ctx.createLinearGradient(80, 0, 80 + barW * 0.4, 0);
    progGrad.addColorStop(0, col.rgb(acc));
    progGrad.addColorStop(1, col.rgb(col.lighten(acc, 40)));
    ctx.fillStyle = progGrad;
    roundRect(ctx, 80, barY, barW * 0.4, 5, 3);
    ctx.fill();

    ctx.save();
    ctx.shadowColor = col.rgba(acc, 0.6);
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(80 + barW * 0.4, barY + 2.5, 11, 0, Math.PI * 2);
    ctx.fillStyle = "#fff";
    ctx.fill();
    ctx.restore();

    ctx.font = `500 20px ${SYS_FONT}`;
    ctx.fillStyle = "rgba(255,255,255,0.4)";
    ctx.textAlign = "left";
    ctx.fillText("1:34", 80, barY + 42);
    ctx.textAlign = "right";
    ctx.fillText(video?.duration || "3:45", 80 + barW, barY + 42);

    drawYTBranding(ctx, W, barY + 120);
  }

  function renderPoster() {
    const canvas = canvasRef.current;
    if (!canvas || !thumbnailImg) return;
    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, 1080, 1920);
    const avg = col.avg(thumbnailImg);
    const regions = col.regions(thumbnailImg);
    const accent = col.sat(col.lighten(avg, 40), 1.8);
    const dark = col.darken(avg, 80);
    const s = song.trim() || "Untitled";
    const a = artist.trim() || "YouTube";
    if (theme === "cinematic")
      renderCinematic(ctx, 1080, 1920, s, a, avg, regions, accent, dark);
    else if (theme === "neon")
      renderNeon(ctx, 1080, 1920, s, a, avg, regions, accent, dark);
    else if (theme === "minimal")
      renderMinimal(ctx, 1080, 1920, s, a, avg, regions, accent, dark);
    else if (theme === "vinyl")
      renderVinyl(ctx, 1080, 1920, s, a, avg, regions, accent, dark);
    else if (theme === "editorial")
      renderEditorial(ctx, 1080, 1920, s, a, avg, regions, accent, dark);
    // Update live scaled preview
    const pc = previewCanvasRef.current;
    if (pc) {
      const px = pc.getContext("2d");
      px.clearRect(0, 0, 360, 640);
      px.drawImage(canvas, 0, 0, 360, 640);
    }
  }

  const handleDownload = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const link = document.createElement("a");
    link.download = `${song
      .trim()
      .replace(/[^a-zA-Z0-9]/g, "_")
      .substring(0, 40)}_Story.png`;
    link.href = canvas.toDataURL("image/png");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }, [song]);

  const handleCopy = useCallback(async () => {
    const canvas = canvasRef.current;
    if (!canvas || !navigator?.clipboard?.write) return;
    canvas.toBlob(async (blob) => {
      if (!blob) return;
      try {
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": blob }),
        ]);
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      } catch {
        /* ignore */
      }
    }, "image/png");
  }, []);

  return (
    <div
      className="sp-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="sp-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="sp-header">
          <div className="sp-header__left">
            <div className="sp-header__icon">
              <svg
                width="18"
                height="18"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="2" y="2" width="20" height="20" rx="5" />
                <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
                <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
              </svg>
            </div>
            <div>
              <h3 className="sp-header__title">Instagram Story Poster</h3>
              <p className="sp-header__sub">1080 × 1920 px · High Resolution</p>
            </div>
          </div>
          <button
            className="sp-header__close"
            onClick={onClose}
            aria-label="Close"
          >
            ✕
          </button>
        </div>

        <div className="sp-body">
          {/* Controls */}
          <div className="sp-controls">
            <div className="sp-section">
              <label className="sp-label">POSTER STYLE</label>
              <div className="sp-chips">
                {THEMES.map((t) => (
                  <button
                    key={t.id}
                    className={`sp-chip ${theme === t.id ? "sp-chip--on" : ""}`}
                    onClick={() => setTheme(t.id)}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="sp-section">
              <label className="sp-label">LABEL STICKER</label>
              <div className="sp-chips">
                {LABELS.map((l) => (
                  <button
                    key={l}
                    className={`sp-chip ${label === l ? "sp-chip--on" : ""}`}
                    onClick={() => setLabel(l)}
                  >
                    {l}
                  </button>
                ))}
              </div>
            </div>

            <div className="sp-section">
              <label className="sp-label">CUSTOMIZE TEXT</label>
              <div className="sp-inputs">
                <div>
                  <span className="sp-input-caption">Song Title</span>
                  <input
                    className="sp-input"
                    value={song}
                    onChange={(e) => setSong(e.target.value)}
                    placeholder="Song Title"
                  />
                </div>
                <div>
                  <span className="sp-input-caption">Artist / Channel</span>
                  <input
                    className="sp-input"
                    value={artist}
                    onChange={(e) => setArtist(e.target.value)}
                    placeholder="Artist Name"
                  />
                </div>
              </div>
            </div>

            <div className="sp-action-row">
              <button
                className="sp-btn-download"
                onClick={handleDownload}
                disabled={!ready}
              >
                <svg
                  width="16"
                  height="16"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                  <polyline points="7 10 12 15 17 10" />
                  <line x1="12" y1="15" x2="12" y2="3" />
                </svg>
                {ready ? "Download Story (PNG)" : "Generating…"}
              </button>
              <button
                className="sp-btn-copy"
                onClick={handleCopy}
                disabled={!ready}
              >
                {copied ? "✓ Copied!" : "📋 Copy"}
              </button>
            </div>
          </div>

          {/* Preview */}
          <div className="sp-preview-col">
            <span className="sp-preview-tag">9:16 PREVIEW</span>
            <div className="sp-preview-frame">
              {loading && (
                <div className="sp-loader">
                  <div className="sp-spinner" />
                  <span>Loading artwork…</span>
                </div>
              )}
              <canvas
                ref={previewCanvasRef}
                width={360}
                height={640}
                className="sp-preview-canvas"
                style={{ display: ready ? "block" : "none" }}
              />
            </div>
          </div>
        </div>

        {/* Hidden full-res canvas */}
        <canvas
          ref={canvasRef}
          width={1080}
          height={1920}
          style={{ display: "none" }}
        />
      </div>
    </div>
  );
}
