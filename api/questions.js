const { Client } = require('@notionhq/client');

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const DATABASE_ID = '374e20f2-cd60-80bc-b86c-c76fc454ca9c';

const SECTION_ORDER = [
  'Core Java', 'Collections', 'JVM', 'Garbage Collection',
  'Multithreading', 'Concurrency', 'Java 8+', 'Spring', 'Spring Boot',
  'Hibernate/JPA', 'SQL', 'Microservices', 'Kafka', 'Redis',
  'Design Patterns', 'System Design', 'Cloud', 'Docker', 'Kubernetes'
];

const SECTION_ICONS = {
  'Core Java': '☕', 'Collections': '📦', 'JVM': '⚙️',
  'Garbage Collection': '🗑️', 'Multithreading': '🔀', 'Concurrency': '⚡',
  'Java 8+': '🚀', 'Spring': '🌱', 'Spring Boot': '🌿',
  'Hibernate/JPA': '🗃️', 'SQL': '🔢', 'Microservices': '🔧',
  'Kafka': '📨', 'Redis': '🔴', 'Design Patterns': '🎨',
  'System Design': '🏗️', 'Cloud': '☁️', 'Docker': '🐳', 'Kubernetes': '🎡'
};

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 's-maxage=60, stale-while-revalidate=300');

  try {
    const questions = [];
    let cursor;

    do {
      const response = await notion.databases.query({
        database_id: DATABASE_ID,
        page_size: 100,
        start_cursor: cursor,
      });

      for (const page of response.results) {
        const props = page.properties;
        const section = props['Section']?.select?.name || 'Uncategorized';
        const subTopics = props['Sub-Topic']?.multi_select?.map(t => t.name) || [];
        const question = props['Question']?.title?.map(t => t.plain_text).join('') || '';
        if (question) questions.push({ id: page.id, question, section, subTopics });
      }

      cursor = response.next_cursor;
    } while (cursor);

    const grouped = {};
    SECTION_ORDER.forEach(s => { grouped[s] = []; });
    questions.forEach(q => {
      if (grouped[q.section] !== undefined) grouped[q.section].push(q);
    });

    const sections = SECTION_ORDER
      .filter(s => grouped[s].length > 0)
      .map(s => ({
        name: s,
        icon: SECTION_ICONS[s] || '📝',
        slug: s.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
        count: grouped[s].length,
        questions: grouped[s],
      }));

    res.json({ sections });
  } catch (error) {
    console.error('Error fetching questions:', error);
    res.status(500).json({ error: 'Failed to fetch questions', message: error.message });
  }
};
