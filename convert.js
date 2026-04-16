// Convert existing MAPSTOTO HTML pages to JSON data files for CSR
const fs = require('fs');
const path = require('path');

const srcDir = 'C:/Users/user201/mapstoto-id';
const outDir = 'C:/Users/user201/mapstoto-web';
const templateSrc = fs.readFileSync(path.join(outDir, 'template.html'), 'utf8');

const colors = ['#6366f1','#10b981','#f59e0b','#06b6d4','#f43f5e','#8b5cf6','#14b8a6','#84cc16','#0ea5e9','#ec4899','#f97316','#22c55e'];
const fonts = ['Inter','DM Sans','Space Grotesk','Outfit','Raleway','Nunito','Poppins','Sora','Manrope','Rubik','Montserrat','Quicksand'];

function extractText(html, startTag, endTag) {
  const s = html.indexOf(startTag);
  if (s === -1) return '';
  const e = html.indexOf(endTag, s + startTag.length);
  if (e === -1) return '';
  return html.substring(s + startTag.length, e).trim();
}

function stripTags(html) {
  return html.replace(/<[^>]+>/g, '').trim();
}

function extractBetween(html, open, close) {
  const parts = [];
  let pos = 0;
  while (true) {
    const s = html.indexOf(open, pos);
    if (s === -1) break;
    const e = html.indexOf(close, s + open.length);
    if (e === -1) break;
    parts.push(html.substring(s + open.length, e).trim());
    pos = e + close.length;
  }
  return parts;
}

for (let i = 1; i <= 100; i++) {
  const pageDir = path.join(srcDir, 'page' + i);
  const htmlFile = path.join(pageDir, 'index.html');

  if (!fs.existsSync(htmlFile)) {
    console.log('SKIP page' + i + ' (no source)');
    continue;
  }

  const html = fs.readFileSync(htmlFile, 'utf8');

  // Extract title
  const titleMatch = html.match(/<title>([^<]+)<\/title>/);
  const title = titleMatch ? titleMatch[1] : 'MAPSTOTO Page ' + i;

  // Extract meta description
  const descMatch = html.match(/name="description"\s+content="([^"]+)"/);
  const description = descMatch ? descMatch[1] : '';

  // Extract keywords
  const kwMatch = html.match(/name="keywords"\s+content="([^"]+)"/);
  const keywords = kwMatch ? kwMatch[1] : '';

  // Extract H1
  const h1Match = html.match(/<h1[^>]*>(.*?)<\/h1>/s);
  const h1 = h1Match ? h1Match[1].replace(/<[^>]+>/g, '') : title;

  // Extract article body
  const articleMatch = html.match(/<article[^>]*>([\s\S]*?)<\/article>/);
  const articleHtml = articleMatch ? articleMatch[1] : '';

  // Parse sections from article
  const sections = [];
  const h2Matches = articleHtml.split(/<h2[^>]*>/);

  for (let j = 1; j < h2Matches.length; j++) {
    const sectionHtml = h2Matches[j];
    const h2End = sectionHtml.indexOf('</h2>');
    const h2Text = h2End !== -1 ? stripTags(sectionHtml.substring(0, h2End)) : '';
    const rest = h2End !== -1 ? sectionHtml.substring(h2End + 5) : sectionHtml;

    // Extract paragraphs
    const paragraphs = [];
    const pMatches = rest.match(/<p[^>]*>([\s\S]*?)<\/p>/g);
    if (pMatches) {
      pMatches.forEach(p => {
        const text = p.replace(/<\/?p[^>]*>/g, '').trim();
        if (text.length > 20) paragraphs.push(text);
      });
    }

    // Extract list items
    const listItems = [];
    const liMatches = rest.match(/<li[^>]*>([\s\S]*?)<\/li>/g);
    if (liMatches) {
      liMatches.forEach(li => {
        const text = li.replace(/<\/?li[^>]*>/g, '').trim();
        if (text.length > 5) listItems.push(text);
      });
    }

    // Extract table
    let table = null;
    const tableMatch = rest.match(/<table[\s\S]*?<\/table>/);
    if (tableMatch) {
      const headers = [];
      const thMatches = tableMatch[0].match(/<th[^>]*>([\s\S]*?)<\/th>/g);
      if (thMatches) thMatches.forEach(th => headers.push(stripTags(th)));

      const rows = [];
      const trMatches = tableMatch[0].match(/<tr>([\s\S]*?)<\/tr>/g);
      if (trMatches) {
        trMatches.forEach(tr => {
          if (tr.includes('<th')) return;
          const cells = [];
          const tdMatches = tr.match(/<td[^>]*>([\s\S]*?)<\/td>/g);
          if (tdMatches) tdMatches.forEach(td => cells.push(stripTags(td)));
          if (cells.length) rows.push(cells);
        });
      }
      if (headers.length && rows.length) table = { headers, rows };
    }

    const section = { h2: h2Text };
    if (paragraphs.length) section.paragraphs = paragraphs;
    if (listItems.length > 3) section.list = listItems;
    if (table) section.table = table;
    sections.push(section);
  }

  // First section (before any h2) — intro paragraphs
  if (h2Matches[0]) {
    const introParas = [];
    const introP = h2Matches[0].match(/<p[^>]*>([\s\S]*?)<\/p>/g);
    if (introP) {
      introP.forEach(p => {
        const text = p.replace(/<\/?p[^>]*>/g, '').trim();
        if (text.length > 20) introParas.push(text);
      });
    }
    if (introParas.length) {
      sections.unshift({ h2: '', paragraphs: introParas });
    }
  }

  // Extract FAQ
  const faq = [];
  const summaryMatches = articleHtml.match(/<summary>([\s\S]*?)<\/summary>/g);
  const answerMatches = articleHtml.match(/<div class="faq-a[^"]*">([\s\S]*?)<\/div>|<div class="faq-body[^"]*">([\s\S]*?)<\/div>|<p class="faq[^"]*">([\s\S]*?)<\/p>/g);

  if (summaryMatches) {
    summaryMatches.forEach((s, idx) => {
      const q = stripTags(s);
      let a = '';
      // Try to find answer after this summary
      const detailsMatches = articleHtml.match(/<details[^>]*>[\s\S]*?<summary>[\s\S]*?<\/summary>([\s\S]*?)<\/details>/g);
      if (detailsMatches && detailsMatches[idx]) {
        const answerHtml = detailsMatches[idx].replace(/<summary>[\s\S]*?<\/summary>/, '').replace(/<\/?details[^>]*>/g, '');
        a = stripTags(answerHtml);
      }
      if (q && a) faq.push({ q, a });
    });
  }

  // Build data object
  const data = {
    title,
    description,
    keywords,
    h1,
    subtitle: description,
    color: colors[(i - 1) % colors.length],
    font: fonts[(i - 1) % fonts.length],
    sections: sections.filter(s => s.h2 !== '' || (s.paragraphs && s.paragraphs.length)),
    faq
  };

  // Write JSON
  const pageOutDir = path.join(outDir, 'page' + i);
  if (!fs.existsSync(pageOutDir)) fs.mkdirSync(pageOutDir, { recursive: true });
  fs.writeFileSync(path.join(pageOutDir, 'data.json'), JSON.stringify(data, null, 0), 'utf8');

  // Copy template as index.html
  fs.copyFileSync(path.join(outDir, 'template.html'), path.join(pageOutDir, 'index.html'));

  console.log('✓ page' + i + ': ' + title.substring(0, 50));
}

console.log('\nDone! All pages converted to CSR format.');
