//@ts-nocheck
import { serve, file } from "bun";
import fetch from "node-fetch";
import * as cheerio from "cheerio";
import { writeFileSync, existsSync, readFileSync, mkdirSync } from "fs";
import path from "path";
import { create } from "xmlbuilder2";

const RSS_FOLDER = path.resolve("./rss_feeds");
if (!existsSync(RSS_FOLDER)) mkdirSync(RSS_FOLDER);

const CHANNELS = path.resolve("./channels.json");





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

    it.ele("description").dat(descParts.join(" ")).up();
  }

  return doc.end({ prettyPrint: true });
}

function rssResponse(feedJson) {
  const xml = jsonFeedToRSS(feedJson);

  return new Response(xml, {
    headers: {
      "Content-Type": "application/rss+xml; charset=utf-8",
    },
  });
}

function normalizeImgUrl(imgUrl, pageUrl) {
  if (!imgUrl || typeof imgUrl !== "string") return "";

  const trimmed = imgUrl.trim();

  // reject base64 / data URLs
  if (trimmed.startsWith("data:")) return "";

  // absolute URL
  try {
    const u = new URL(trimmed);
    return u.href;
  } catch {}

  // relative root path
  if (trimmed.startsWith("/")) {
    try {
      const base = new URL(pageUrl);
      return base.origin + trimmed;
    } catch {}
  }

  // relative path (no slash)
  try {
    const base = new URL(pageUrl);
    return base.origin + "/" + trimmed;
  } catch {}

  return "";
}



function readJSON(filei, defaultValue = {}) {
  if (existsSync(filei)) {
    try {
      return JSON.parse(readFileSync(filei, "utf-8"));
    } catch {
      return defaultValue;
    }
  }
  return defaultValue;
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
    items: []
  };
}

function writeFeed(filePath, feed) {
  writeFileSync(filePath, JSON.stringify(feed, null, 2));
}

function absoluteUrl(urlToCheck, originalUrl) {
  try {
    return new URL(urlToCheck).href;
  } catch {
    const orig = new URL(originalUrl);
    return `${orig.origin}${urlToCheck.startsWith("/") ? "" : "/"}${urlToCheck}`;
  }
}

function withCORS(res) {
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "*");
  return res;
}

/* ---------------- core scraping ---------------- */

async function fetchData(channelsObj, id, skipsave = false) {
  if (!channelsObj || !channelsObj.url) {
    return { error: `Missing channel or url for ${id}` };
  }

  try {
    const res = await fetch(channelsObj.url);
    const html = await res.text();
    const $ = cheerio.load(html);

    const containerSel = channelsObj.container || "body";
    const titleSel = channelsObj.title;
    const textSel = channelsObj.text;
    const imgSel = channelsObj.img;
    const topIsNewest = channelsObj.topIsNewest;

    const newPosts = [];

    const pushPost = p => {
      if (topIsNewest) newPosts.unshift(p);
      else newPosts.push(p);
    };

    $(containerSel).each((_, el) => {
      const el$ = $(el);

      const title = titleSel
        ? el$.find(titleSel).first().text().trim()
        : el$.text().trim();

	const rawImg = imgSel ? el$.find(imgSel).first().attr("src") : "";
	

	if (!title && !rawImg) return;


const finalTitle =
  title || (rawImg ? `Image post – ${normalizeImgUrl(rawImg, channelsObj.url)}` : "");



      pushPost({
        title: finalTitle,
        description: textSel ? el$.find(textSel).first().text().trim() : "",
	img: normalizeImgUrl(rawImg, channelsObj.url),
        pubDate: new Date().toUTCString()
      });
    });

    if (newPosts.length === 0) {
      return { error: `No posts found for ${id}` };
    }

    const feedFile = path.join(RSS_FOLDER, safeFileName(id) + ".json");
    const feed = readFeed(feedFile, id, channelsObj.url);

const freshItems = newPosts.filter(p => {
  const textEmpty = !p.description || !p.description.trim();

  return !feed.items.some(e => {
    const imgSame = p.img && e.img && p.img === e.img;
    const titleSame = e.title === p.title;

    // DROP only if:
    // text is empty AND image is missing or repeated
    if (textEmpty && (!p.img || imgSame)) {
      return true;
    }

    // normal duplicate protection
    if (titleSame) return true;
    if (imgSame) return true;

    return false;
  });
});

    feed.items.push(...freshItems);

    if (!skipsave) writeFeed(feedFile, feed);

    return { data: feed };
  } catch (err) {
    return { error: err.toString() };
  }
}

async function fetchFromId(req) {
  const id = req.params.id;
  if (!id) return { error: "Missing id param" };

  const channelsObj = readJSON(CHANNELS, {});
  return fetchData(channelsObj[id], id);
}

async function fetchDataPreviewjson(post) {
  const res = await fetchData(post, post.name, true);
  if (res.error) return { error: res.error };
  return { data: res.data };
}

/* ---------------- meta scraping ---------------- */

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

/* ---------------- server ---------------- */

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

      const xml = jsonFeedToRSS(res.data);

      return withCORS(
        new Response(xml, {
          headers: {
            "Content-Type": "application/rss+xml; charset=utf-8",
          },
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
