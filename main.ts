//@ts-nocheck
import { serve, file } from "bun";
import fetch from "node-fetch";
import * as cheerio from "cheerio";
import { writeFileSync, existsSync, readFileSync, mkdirSync } from "fs";
import path from "path";
import { existsSync } from "fs";
import { XMLParser, XMLBuilder } from "fast-xml-parser";


const xmltojson = new XMLParser();
const xmlbuilder = new XMLBuilder({
  ignoreAttributes: false,
  format: true,
});


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

  const xmlobj = {
    rss: {
      version: "2.0",
      channel: {
        title: feedTitle,
        link: "http://localhost:3031/",
        description: `ibhub RSS feed for ${feedTitle}`,
      },
    },
  };



  return xmlbuilder.build(xmlobj);
}

function parseRSSItems(rss) {


  const obs = xmltojson.parse(rss)
  console.log(obs)
  const rsschannel = obs.rss.channel;
  const items = rsschannel.item ? rsschannel.item : [];

  return items

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


function generateRSS(items, pageUrl, title) {
  const obj = {
    rss: {
      version: "2.0",
      channel: {
        title,
        link: pageUrl,
        description: `ibhub RSS feed for ${title}`,
        item: items.map((it) => {
          const descParts = [];
          if (it.img) descParts.push(`<img src="${absoluteUrl(it.img, pageUrl)}" />`);
          if (it.description) descParts.push(it.description);

          return {
            title: { "#cdata": it.title },
            link: pageUrl,
            pubDate: it.pubDate ?? "",
            description: { "#cdata": descParts.join(" ") },
          };
        }),
      },
    },
  };

  console.log(xmlbuilder.build(obj))
  return xmlbuilder.build(obj);


}


async function fetchFromId(req) {
  const id = req.params.id
  if (!id) return new Response("Missing id param", { status: 400 });
  const channelsObj = readJSON(CHANNELS, {});

  return await fetchData(channelsObj[id], id)
}

async function fetchDataPreviewjson(post) {
  console.log(post)
  const res = await fetchData(post, post.name, true)
  if (res.error) {
    return { error: res.error }
  } else {
    return { data: xmltojson.parse(res.data) }
  }
}


async function fetchData(channelsObj, id, skipsave = false) {

  if (channelsObj) {

    //data
    if (!channelsObj.url) {
      return new Response(`Missing url param on channels.json entry ${id}`, { status: 400 });
    }
    try {
      const res = await fetch(channelsObj.url);
      const html = await res.text();
      const $ = cheerio.load(html);

      const urlParam = channelsObj.url
      const containerSel = channelsObj.container || "body";
      const titleSel = channelsObj.title;
      const textSel = channelsObj.text;
      const imgSel = channelsObj.img;
      const topIsNewest = channelsObj.topIsNewest

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
        (p) => !existingItems.some((ei) => {
          return (ei.title === p.title)
          // if (ei.title === p.title) {
          //   if (ei.description === p.description) {
          //     return true
          //   } else {
          //     return false
          //   }
          // } else {
          //   return false
          // }
        }

        ))

      const allItems = [...existingItems, ...newItems];
      const rssXML = generateRSS(allItems, urlParam, id);
      if (!skipsave) {
        writeFileSync(rssFile, rssXML);
      }

      return {
        data: rssXML
      }
      // return withCORS(new Response(rssXML, {
      //   status: 200,
      //   headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
      // }))
    } catch (err) {
      return { error: err }
      // return withCORS(new Response(`Error: ${err}`, { status: 500 }))
    }

    //data
  } else {
    return { error: `Channel not found, please access /_ to add this new channel or add it manually on channels.json` }
    // return withCORS(new Response(`Channel not found, please access /_ to add this new channel or add it manually on channels.json`, { status: 500 }))
  }

}


function withCORS(res) {
  res.headers.set("Access-Control-Allow-Origin", "*");
  res.headers.set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
  res.headers.set("Access-Control-Allow-Headers", "*");
  return res;
}

async function getmeta(pageurl) {
  try {

    const res = await fetch(pageurl.page);
    const html = await res.text();
    const $ = cheerio.load(html);
    console.log($(pageurl.container)?.first())
    const title =
      $('meta[property="og:title"]').attr("content") ||
      $('meta[name="twitter:title"]').attr("content") ||
      $("title").text() ||
      $(pageurl.container)?.first().find(pageurl.title)?.first().text() ||
      $("h1").first().text() ||
      null
    let image =
      $('meta[property="og:image"]').attr("content") ||
      $('meta[name="twitter:image"]').attr("content") ||
      $('link[rel="icon"]').attr("href") ||
      $('link[rel="shortcut icon"]').attr("href") ||
      $(pageurl.container)?.first().find(pageurl.imgselector)?.first().attr("src") ||
      null;
    return { title: title, image: image }
  } catch (error) {
    return { error: error }
  }
}

const port = 3013
console.log(`:D http://localhost:${port}`)
serve({
  port: port,
  routes: {
    "/api/previewrss": {
      OPTIONS: () => withCORS(new Response(null, { status: 204 })),
      POST: async req => {
        const post = await req.json();
        const res = await fetchDataPreviewjson(post)
        if (res.error) {
          return withCORS(new Response(`Error: ${res.error}`, { status: 500 }))
        } else {
          return withCORS(Response.json(res.data));
          // return withCORS(new Response(res.data, {
          //   status: 200,
          //   headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
          // }))
        }
      },
    },
    "/rss/:id": async req => {
      const res = await fetchFromId(req)
      if (res.error) {
        return withCORS(new Response(`Error: ${res.error}`, { status: 500 }))
      } else {
        return withCORS(new Response(res.data, {
          status: 200,
          headers: { "Content-Type": "application/rss+xml; charset=utf-8" },
        }))
      }
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
    "/api/meta": {
      OPTIONS: () => withCORS(new Response(null, { status: 204 })),
      POST: async req => {
        const json = await req.json();
        console.log(json)
        console.log(json.page)
        if (json.page) {
          const meta = await getmeta(json)
          return withCORS(Response.json(meta));
        } else {
          return new Response("Not Found", { status: 404 });
        }
      },
    },
    "/*": req => {
      const url = new URL(req.url);
      const path = url.pathname === "/" ? "/index.html" : url.pathname;
      if (existsSync("frontend/dist" + path)) {
        return new Response(file("frontend/dist" + path));
      } else {
        return new Response("Not Found", { status: 404 });
      }

    }
  }
});
