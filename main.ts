//@ts-nocheck
import { serve, file } from "bun";
import fetch from "node-fetch";
import * as cheerio from "cheerio";
import { writeFileSync, existsSync, readFileSync, mkdirSync } from "fs";
import path from "path";
import { create } from "xmlbuilder2";

/* =========================
   apiChecker (INLINE)
   ========================= */
function apiChecker({ json, path, prev }) {
  if (!path) return { updated: false, value: "" };

  const parts = path.split(".").filter(Boolean);
  let cur = json;

  for (const p of parts) {
    if (cur == null) return { updated: false, value: "" };
    cur = cur[p];
  }

  let value = "";

  if (Array.isArray(cur)) {
    if (cur.length === 0) return { updated: false, value: "" };
    value = String(cur[cur.length - 1]);
  } else {
    value = String(cur);
  }

  const norm = s => (s || "").replace(/\s+/g, " ").trim();

  if (norm(value) !== norm(prev)) {
    return { updated: true, value };
  }

  return { updated: false, value };
}
/* ========================= */

const RSS_FOLDER = path.resolve("./rss_feeds");
if (!existsSync(RSS_FOLDER)) mkdirSync(RSS_FOLDER);

const CHANNELS = path.resolve("./channels.json");

/* ========================= */

function jsonFeedToRSS(feed) {
  const doc = create({ version: "1.0", encoding: "UTF-8" })
    .ele("rss", { version: "2.0" })
    .ele("channel")
    .ele("title").txt(feed.title).up()
    .ele("link").txt(feed.link).up()
    .ele("description").txt(feed.description).up();

  for (const item of feed.items) {
    const it = doc.ele("item");
    it.ele("title").dat(item.title).up();
    it.ele("link").txt(feed.link).up();
    it.ele("pubDate").txt(item.pubDate || "").up();

    const descParts = [];
    if (item.img) descParts.push(`<img src="${item.img}" />`);
    if (item.description) descParts.push(item.description);

    it.ele("description").dat(descParts.join("\n")).up();
  }

  return doc.end({ prettyPrint: true });
}

const normalizeText = s => (s || "").replace(/\s+/g, " ").trim();

/* ===== FIX: normalize image URLs ===== */
function normalizeImgUrl(src, baseUrl) {
  if (!src) return "";
  try {
    return new URL(src, baseUrl).href;
  } catch {
    return src;
  }
}
/* =================================== */

function readJSON(filei, def = {}) {
  if (!existsSync(filei)) return def;
  try {
    return JSON.parse(readFileSync(filei, "utf-8"));
  } catch {
    return def;
  }
}

function writeJSON(filei, data) {
  writeFileSync(filei, JSON.stringify(data, null, 2));
}

function safeFileName(str) {
  return str
    .replace(/https?:\/\/|\.html/g, "")
    .replace(/[^a-z0-9]/gi, "_")
    .toLowerCase();
}

function readFeed(filePath, title, link) {
  if (existsSync(filePath)) {
    try {
      return JSON.parse(readFileSync(filePath, "utf-8"));
    } catch {}
  }
  return {
    title,
    link,
    description: `ibhub feed for ${title}`,
    items: [],
    lastValue: ""
  };
}

function writeFeed(filePath, feed) {
  writeFileSync(filePath, JSON.stringify(feed, null, 2));
}

function withCORS(res) {
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "*");
  return res;
}

/* ========================= */

async function fetchData(channelsObj, id, skipsave = false) {
  if (!channelsObj || !channelsObj.url) {
    return { error: `Missing channel or url for ${id}` };
  }

  try {
    const res = await fetch(channelsObj.url);
    const contentType = res.headers.get("content-type") || "";

    const feedFile = path.join(RSS_FOLDER, safeFileName(id) + ".json");
    const feed = readFeed(feedFile, id, channelsObj.url);

    /* ===== JSON MODE ===== */
    if (contentType.includes("application/json")) {
      const json = await res.json();
console.log(json)
      const check = apiChecker({
        json,
        path: channelsObj.jsonpath,
        prev: feed.lastValue || ""
      });

      if (check.updated) {
        feed.lastValue = check.value;
        feed.items.push({
          title: check.value,
          description: "",
          img: "",
          pubDate: new Date().toUTCString()
        });

        if (!skipsave) writeFeed(feedFile, feed);
      }

      return { data: feed };
    }
    /* ===================== */

    /* ===== HTML MODE ===== */
    const html = await res.text();
    const $ = cheerio.load(html);

    const containerSel = channelsObj.container || "body";
    const titleSel = channelsObj.title;
    const textSel = channelsObj.text;
    const imgSel = channelsObj.img;

    const newPosts = [];

    $(containerSel).each((_, el) => {
      const el$ = $(el);

      const title = titleSel
        ? el$.find(titleSel).first().text().trim()
        : el$.clone().children().remove().end().text().trim();

      const rawImgRaw = imgSel
        ? el$.find(imgSel).first().attr("src")
        : el$.find("img").first().attr("src");

      const rawImg = normalizeImgUrl(rawImgRaw, channelsObj.url);

      if (!title && !rawImg) return;

      newPosts.push({
        title: title || `Image post`,
        description: textSel ? el$.find(textSel).first().text() : "",
        img: rawImg || "",
        pubDate: new Date().toUTCString()
      });
    });

    if (channelsObj.newontop === true) {
      newPosts.reverse();
    }

    const freshItems = newPosts.filter(p => {
      return !feed.items.some(e =>
        normalizeText(e.title) === normalizeText(p.title) &&
        normalizeText(e.description) === normalizeText(p.description) &&
        normalizeImgUrl(e.img, channelsObj.url) ===
        normalizeImgUrl(p.img, channelsObj.url)
      );
    });

    feed.items.push(...freshItems);
    if (!skipsave) writeFeed(feedFile, feed);

    return { data: feed };
  } catch (err) {
    return { error: err.toString() };
  }
}

/* ========================= */

async function fetchFromId(req) {
  const id = req.params.id;
  if (!id) return { error: "Missing id param" };
  const channelsObj = readJSON(CHANNELS, {});
  return fetchData(channelsObj[id], id);
}

async function getmeta(pageurl) {
  try {
    const res = await fetch(pageurl.page);
    const html = await res.text();
    const $ = cheerio.load(html);

    const title =
      $('meta[property="og:title"]').attr("content") ||
      $('meta[name="twitter:title"]').attr("content") ||
      $("title").text() ||
      $("h1").first().text() ||
      null;

    const image =
      $('meta[property="og:image"]').attr("content") ||
      $('meta[name="twitter:image"]').attr("content") ||
      $('link[rel="icon"]').attr("href") ||
      null;

    return { title, image };
  } catch (error) {
    return { error };
  }
}

/* ========================= */

const port = 3013;
console.log(`:D http://localhost:${port}`);

serve({
  port,
  routes: {
    "/rss/:id": async req => {
      const res = await fetchFromId(req);
      if (res.error) {
        return withCORS(new Response(res.error, { status: 500 }));
      }
      return withCORS(
        new Response(jsonFeedToRSS(res.data), {
          headers: { "Content-Type": "application/rss+xml; charset=utf-8" }
        })
      );
    },

    "/json/:id": async req => {
      const res = await fetchFromId(req);
      if (res.error) {
        return withCORS(new Response(res.error, { status: 500 }));
      }
      return withCORS(Response.json(res.data));
    },

    "/api/ch": {
      OPTIONS: () => withCORS(new Response(null, { status: 204 })),
      GET: () => withCORS(new Response(file("channels.json"))),
      POST: async req => {
        const post = await req.json();
        const channels = readJSON(CHANNELS, {});
        writeJSON(CHANNELS, { ...channels, ...post });
        return withCORS(Response.json(post));
      },
      DELETE: async req => {
        const json = await req.json();
        const channels = readJSON(CHANNELS, {});
        delete channels[json.target];
        writeJSON(CHANNELS, channels);
        return withCORS(Response.json({ status: "complete" }));
      }
    },

    "/api/meta": {
      OPTIONS: () => withCORS(new Response(null, { status: 204 })),
      POST: async req => {
        const json = await req.json();
        if (!json.page) return new Response("Not Found", { status: 404 });
        const meta = await getmeta(json);
        return withCORS(Response.json(meta));
      }
    },

    "/*": req => {
      const url = new URL(req.url);
      const p = url.pathname === "/" ? "/index.html" : url.pathname;
      if (existsSync("frontend/dist" + p)) {
        return new Response(file("frontend/dist" + p));
      }
      return new Response("Not Found", { status: 404 });
    }
  }
});
