//@ts-nocheck
import { serve } from "bun";
import fetch from "node-fetch";
// import * as cheerio from "cheerio";
import { parseHTML } from 'linkedom';
import { writeFileSync, existsSync, readFileSync, mkdirSync } from "fs";
import path from "path";


const RSS_FOLDER = path.resolve("./rss_feeds");
if (!existsSync(RSS_FOLDER)) mkdirSync(RSS_FOLDER);

const CHANNELS = path.resolve("./channels.json");


function readJSON(file, defaultValue) {
  if (existsSync(file)) {
    try {
      return JSON.parse(readFileSync(file, "utf-8"));
    } catch {
      return defaultValue;
    }
  }
  return defaultValue;
}

function writeJSON(file, data) {
  writeFileSync(file, JSON.stringify(data, null, 2));
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
  const { document } = parseHTML(rss);
  const items = [];

  document.querySelectorAll("item").forEach((el) => {
    items.push({
      title: el.querySelector("title")?.textContent || "",
      pubDate: el.querySelector("pubDate")?.textContent || "",
      description: el.querySelector("description")?.textContent || "",
      img: el.querySelector("enclosure")?.getAttribute("url") || "",
    });
  });

  return items;
}


function absoluteUrl(urlToCheck, originalUrl) {
  // console.log(urlToCheck, originalUrl)
  try {
    // If already a full URL, return as is
    return new URL(urlToCheck).href;
  } catch {
    // Otherwise, join with domain of originalUrl
    const orig = new URL(originalUrl);
    // console.log(`${orig.origin}${urlToCheck.startsWith("/") ? "" : "/"}${urlToCheck}`)
    return `${orig.origin}${urlToCheck.startsWith("/") ? "" : "/"}${urlToCheck}`;
  }
}


function generateRSS(items, pageUrl, title) {
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0">
<channel>
  <title>${title}</title>
  <link>${pageUrl}</link>
  <description>ibhub: ${title}</description>
  ${items
      .map((it) => {
        const imgTag = it.img ? `<img src="${absoluteUrl(it.img, pageUrl)}" />` : "";
        const description = it.description || "";
        return `
  <item>
    <title><![CDATA[${it.title}]]></title>
    <link>${pageUrl}</link>
    <pubDate>${it.pubDate}</pubDate>
    <description><![CDATA[${description} ${imgTag}]]></description>
  </item>`;
      })
      .join("")}
</channel>
</rss>`;
}


async function fetchData(req, url) {
  const id = url.searchParams.get("id");
  if (!id) {
    return new Response("missing id param", { status: 400 })
  }

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
      // const $ = cheerio.load(html);

      const urlParam = channelsObj[id].url
      const containerSel = channelsObj[id].container || "body";
      const titleSel = channelsObj[id].title;
      const textSel = channelsObj[id].text;
      const imgSel = channelsObj[id].img;

      const {
        document
      } = parseHTML(html)

      const firstIsNewest = false

      const newPosts = [];
      document.querySelectorAll(containerSel).forEach(item => {

        const feedObj = {
          title: titleSel ? item.querySelector(titleSel)?.textContent.trim() : "title element not found",
          pubDate: new Date().toUTCString()
        }
        if (textSel) {
          console.log(textSel)
          feedObj.description = item.querySelector(textSel)?.textContent.trim()
        }
        if (imgSel) {
          console.log(imgSel)
          feedObj.img = item.querySelector(imgSel)?.getAttribute("src")
        }
        if (firstIsNewest) {
          newPosts.unshift(feedObj)
        } else {
          newPosts.push(feedObj);
        }
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

async function admin(req, url) {
  console.log(req, url)
  return new Response("yooo", { status: 200 });
}

async function apiLocal(req, url) {
  try {
    // Ensure content type is JSON
    if (req.headers.get("content-type") !== "application/json") {
      return new Response("Invalid Content-Type", { status: 400 });
    }

    // Parse the JSON body
    const data = await req.json();
    console.log("Received JSON:", data);

    return new Response(JSON.stringify({ status: "ok" }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response("Invalid JSON", { status: 400 });
  }
}


console.log("seving on http://localhost:3013")
serve({
  port: 3013,
  async fetch(req) {
    const url = new URL(req.url)


    if (url.pathname === "/api" && req.method === "POST") {
      return await apiLocal(req, url)
    }

    if (url.pathname === "/_") {
      return await admin(req, url)
    }
    if (url.pathname === "/") {
      return await fetchData(req, url)
    }

  },
});
