//@ts-nocheck
import { serve, file } from "bun";
import fetch from "node-fetch";
import * as cheerio from "cheerio";
import { writeFileSync, existsSync, readFileSync, mkdirSync } from "fs";
import path from "path";

// Folder to store RSS files
const RSS_FOLDER = path.resolve("./rss_feeds");
if (!existsSync(RSS_FOLDER)) mkdirSync(RSS_FOLDER);

const CHANNELS = path.resolve("./channels.json");

// Helpers
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

function safeFileName(url) {
  return url.replace(/https?:\/\/|\.html/g, "").replace(/[^a-z0-9]/gi, "_").toLowerCase();
}

function readRSS(filePath, feedTitle) {
  if (existsSync(filePath)) return readFileSync(filePath, "utf-8");
  return `<?xml version="1.0" encoding="UTF-8" ?>
<rss version="2.0">
<channel>
  <title>${feedTitle}</title>
  <link>http://localhost:3000/</link>
  <description>RSS feed for ${feedTitle}</description>
</channel>
</rss>`;
}

function parseRSSItems(rss) {
  const $ = cheerio.load(rss, { xmlMode: true });
  const items = [];
  $("item").each((_, el) => {
    items.push({
      title: $(el).find("title").text(),
      pubDate: $(el).find("pubDate").text(),
      description: $(el).find("description").text(),
      img: $(el).find("enclosure").attr("url"),
    });
  });
  return items;
}


function absoluteUrl(urlToCheck, originalUrl) {
  // console.log(urlToCheck, originalUrl)
  try {

    return new URL(urlToCheck).href;
  } catch {

    const orig = new URL(originalUrl);
    // console.log(`${orig.origin}${urlToCheck.startsWith("/") ? "" : "/"}${urlToCheck}`)
    return `${orig.origin}${urlToCheck.startsWith("/") ? "" : "/"}${urlToCheck}`;
  }
}

// Generate RSS XML from items
function generateRSS(items, pageUrl, title) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>${title}</title>
  <link>${pageUrl}</link>
  <description>RSS feed for ${title}</description>
  ${items
      .map((it) => {
        const imgTag = it.img ? `<img src="${absoluteUrl(it.img, pageUrl)}" />` : "";
        const description = it.description || "";
        return `
  <item>
    <title><![CDATA[${it.title}]]></title>
    <link>${pageUrl}</link>
    <pubDate>${it.pubDate}</pubDate>
    <description><![CDATA[${imgTag} ${description}]]></description>
  </item>`;
      })
      .join("")}
</channel>
</rss>`;
}


async function fetchData(req) {
  const id = req.params.id
  if (!id) return new Response("Missing id param", { status: 400 });

  const channelsObj = readJSON(CHANNELS, {});
  if (channelsObj[id]) {
    // console.log(channelsObj[id])
    //data
    if (!channelsObj[id].url) {
      return new Response(`Missing url param on channels.json entry ${id}`, { status: 400 });
    }
    try {
      const res = await fetch(channelsObj[id].url);
      const html = await res.text();
      const $ = cheerio.load(html);

      const urlParam = channelsObj[id].url
      const containerSel = channelsObj[id].container || "body";
      const titleSel = channelsObj[id].title;
      const textSel = channelsObj[id].text;
      const imgSel = channelsObj[id].img;
      const topIsNewest = channelsObj[id].topIsNewest

      const newPosts = [];
      const pushTonewPosts = (newObjElement) => {
        if (channelsObj[topIsNewest]) {
          newPosts.unshift(newObjElement);
        } else {
          newPosts.push(newObjElement);
        }
      }

      $(containerSel).each((i, el) => {
        const el$ = $(el);
        const newObjElement = {
          title: titleSel ? el$.find(titleSel).first().text().trim() : el$.text().trim(),
          description: textSel ? el$.find(textSel).first().text().trim() : "",
          img: imgSel ? el$.find(imgSel).first().attr("src") : "",
          pubDate: new Date().toUTCString(),
        }

        pushTonewPosts(newObjElement)

      });

      if (newPosts.length === 0) {
        return new Response(
          `No posts found for ${id} ${urlParam} with container "${containerSel}"`,
          { status: 200 }
        );
      }

      const rssFile = path.join(RSS_FOLDER, safeFileName(id) + ".xml");
      const rssContent = readRSS(rssFile, urlParam);
      const existingItems = parseRSSItems(rssContent);


      const newItems = newPosts.filter(
        (p) => !existingItems.some((ei) => ei.title === p.title)
      );

      const allItems = [...existingItems, ...newItems];
      const rssXML = generateRSS(allItems, urlParam, id);
      writeFileSync(rssFile, rssXML);

      return new Response(rssXML, {
        status: 200,
        headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
      });
    } catch (err) {
      return new Response(`Error: ${err}`, { status: 500 });
    }

    //data
  } else {
    return new Response(`Channel not found, please access /_ to add this new channel or add it manually on channels.json`, { status: 500 });
  }

}




function withCORS(res) {
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "*");
  return res;
}

const port = 3013
console.log(`:D http://localhost:${port}`)
serve({
  port: port,
  routes: {
    "/rss/:id": async req => {
      return await fetchData(req)
    },
    "/xml/:id": req => {
      return withCORS(new Response(file(`rss_feeds/${safeFileName(req.params.id)}.xml`)))
    },
    "/api/ch": {
      OPTIONS: () => withCORS(new Response(null, { status: 204 })),
      GET: () => withCORS(new Response(file("channels.json"))),
      POST: async req => {
        const post = await req.json();
        const channelsin = readJSON("channels.json")
        writeJSON("channels.json", { ...channelsin, ...post })
        return withCORS(Response.json(post));
      },
      DELETE: async req => {
        const json = await req.json();
        const channelsin = readJSON("channels.json")
        delete channelsin[json.target]
        writeJSON("channels.json", channelsin)
        return withCORS(Response.json({ status: "complete" }));
      }
    },
    // "/api/meta": {
    //   POST: async req => {
    //     const json = await req.json();
    //     if (json.page) {
    //       return withCORS(new Response(file("channels.json")))
    //     }
    //   },
    // },
    "/*": req => {
      const url = new URL(req.url);
      const path = url.pathname === "/" ? "/index.html" : url.pathname;
      return new Response(file("frontend/dist" + path));
    }
  }
});
