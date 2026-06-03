const { Client } = require('@notionhq/client');

const notion = new Client({ auth: process.env.NOTION_API_KEY });

async function fetchAllBlocks(blockId) {
  const blocks = [];
  let cursor;
  do {
    const { results, next_cursor } = await notion.blocks.children.list({
      block_id: blockId,
      start_cursor: cursor,
      page_size: 100,
    });
    blocks.push(...results);
    cursor = next_cursor;
  } while (cursor);
  return blocks;
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function richTextToHtml(arr) {
  if (!arr || arr.length === 0) return '';
  return arr.map(rt => {
    let text = escapeHtml(rt.plain_text);
    const a = rt.annotations;
    if (a.code)          text = `<code class="inline-code">${text}</code>`;
    if (a.bold)          text = `<strong>${text}</strong>`;
    if (a.italic)        text = `<em>${text}</em>`;
    if (a.strikethrough) text = `<s>${text}</s>`;
    if (a.underline)     text = `<u>${text}</u>`;
    if (rt.href)         text = `<a href="${escapeHtml(rt.href)}" target="_blank" rel="noopener">${text}</a>`;
    return text;
  }).join('');
}

function blockToHtml(block) {
  switch (block.type) {
    case 'paragraph':
      const p = richTextToHtml(block.paragraph.rich_text);
      return p ? `<p>${p}</p>` : '<p class="spacer"></p>';
    case 'bulleted_list_item':
      return `<li>${richTextToHtml(block.bulleted_list_item.rich_text)}</li>`;
    case 'numbered_list_item':
      return `<li>${richTextToHtml(block.numbered_list_item.rich_text)}</li>`;
    case 'code':
      const rawCode = block.code.rich_text.map(t => t.plain_text).join('');
      const lang = block.code.language === 'plain text' ? 'plaintext' : (block.code.language || 'java');
      return `<pre><code class="language-${lang}">${escapeHtml(rawCode)}</code></pre>`;
    case 'heading_1': return `<h4>${richTextToHtml(block.heading_1.rich_text)}</h4>`;
    case 'heading_2': return `<h5>${richTextToHtml(block.heading_2.rich_text)}</h5>`;
    case 'heading_3': return `<h6>${richTextToHtml(block.heading_3.rich_text)}</h6>`;
    case 'divider':   return '<hr class="divider">';
    case 'callout':
      const icon = block.callout.icon?.emoji || '💡';
      return `<div class="callout"><span>${icon}</span><div>${richTextToHtml(block.callout.rich_text)}</div></div>`;
    case 'quote':
      return `<blockquote>${richTextToHtml(block.quote.rich_text)}</blockquote>`;
    default: return '';
  }
}

function blocksToHtml(blocks) {
  let html = '';
  let i = 0;
  while (i < blocks.length) {
    const b = blocks[i];
    if (b.type === 'bulleted_list_item') {
      html += '<ul>';
      while (i < blocks.length && blocks[i].type === 'bulleted_list_item') { html += blockToHtml(blocks[i]); i++; }
      html += '</ul>';
    } else if (b.type === 'numbered_list_item') {
      html += '<ol>';
      while (i < blocks.length && blocks[i].type === 'numbered_list_item') { html += blockToHtml(blocks[i]); i++; }
      html += '</ol>';
    } else {
      html += blockToHtml(b);
      i++;
    }
  }
  return html;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=300, stale-while-revalidate=3600');

  const { id } = req.query;
  if (!id || !/^[a-f0-9-]{32,36}$/.test(id)) {
    return res.status(400).json({ error: 'Invalid or missing page id' });
  }

  try {
    const topBlocks = await fetchAllBlocks(id);
    const sections = {};

    for (const block of topBlocks) {
      if (block.type !== 'toggle') continue;
      const label = block.toggle.rich_text.map(t => t.plain_text).join('').trim();
      const children = await fetchAllBlocks(block.id);
      sections[label] = blocksToHtml(children);
    }

    res.json(sections);
  } catch (error) {
    console.error('Error fetching page:', error);
    res.status(500).json({ error: 'Failed to fetch page', message: error.message });
  }
};
