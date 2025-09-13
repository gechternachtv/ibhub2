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