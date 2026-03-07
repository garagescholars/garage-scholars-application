const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, 'src');
const DIST = path.join(__dirname, 'dist');
const PARTIALS_DIR = path.join(SRC, 'partials');
const PAGES_DIR = path.join(SRC, 'pages');

// Clean and create dist
if (fs.existsSync(DIST)) fs.rmSync(DIST, { recursive: true });
fs.mkdirSync(DIST, { recursive: true });
fs.mkdirSync(path.join(DIST, 'js'), { recursive: true });
fs.mkdirSync(path.join(DIST, 'images'), { recursive: true });

// Load all partials
const partials = {};
for (const file of fs.readdirSync(PARTIALS_DIR)) {
  const name = path.basename(file, '.html');
  partials[name] = fs.readFileSync(path.join(PARTIALS_DIR, file), 'utf8');
}

// Parse page config from HTML comments at top of file
// Format: <!-- config key: value -->
function parsePageConfig(content) {
  const config = {};
  const configRegex = /^<!--\s*config\s+(\w+):\s*(.+?)\s*-->\n?/gm;
  let match;
  let cleanContent = content;
  while ((match = configRegex.exec(content)) !== null) {
    config[match[1]] = match[2].trim();
    cleanContent = cleanContent.replace(match[0], '');
  }
  return { config, content: cleanContent };
}

// Build header with active nav link
function buildHeader(activeNav) {
  let header = partials['header'] || '';
  // Remove all existing active classes, then add to the right link
  header = header.replace(/class="active"\s*/g, '');
  if (activeNav) {
    // Match the nav link by href
    const hrefMap = {
      'index': 'index.html',
      'about': 'about.html',
      'contact': 'contact.html',
      'apply': 'apply.html',
    };
    const href = hrefMap[activeNav];
    if (href) {
      // Add active class only inside <nav class="nav-links">, not the logo
      const navMatch = header.match(/<nav class="nav-links">([\s\S]*?)<\/nav>/);
      if (navMatch) {
        const updatedNav = navMatch[0].replace(
          new RegExp(`(<a href="${href}")>`),
          '$1 class="active">'
        );
        header = header.replace(navMatch[0], updatedNav);
      }
    }
  }
  return header;
}

// Build head section with page-specific title and meta
function buildHead(config) {
  let head = partials['head'] || '';
  const title = config.title || 'Garage Scholars Denver';
  const ogTitle = config.ogTitle || title;
  head = head.replace('{{title}}', title);
  head = head.replace('{{description}}', config.description || '');
  head = head.replaceAll('{{ogTitle}}', ogTitle);
  return head;
}

// Build Firebase script tags based on which services the page needs
function buildScripts(config) {
  let scripts = '';
  const firebaseModules = (config.firebase || '').split(',').map(s => s.trim()).filter(Boolean);

  if (firebaseModules.length > 0) {
    scripts += '    <!-- Firebase SDK -->\n';
    for (const mod of firebaseModules) {
      scripts += `    <script src="https://www.gstatic.com/firebasejs/10.7.1/firebase-${mod}-compat.js"></script>\n`;
    }
    scripts += '    <script src="/firebase-config.js"></script>\n';
  }

  // Always include shared JS (cache-bust with build timestamp)
  const cacheBust = Date.now();
  scripts += `    <script src="/js/main.js?v=${cacheBust}"></script>\n`;

  return scripts;
}

// Process each page
const pages = fs.readdirSync(PAGES_DIR).filter(f => f.endsWith('.html'));
console.log(`Building ${pages.length} pages...`);

for (const pageFile of pages) {
  const raw = fs.readFileSync(path.join(PAGES_DIR, pageFile), 'utf8');
  const { config, content } = parsePageConfig(raw);

  let html = content;

  // Replace partial placeholders
  html = html.replace('{{head}}', buildHead(config));
  html = html.replace('{{header}}', config.noHeader === 'true' ? '' : buildHeader(config.activeNav));
  html = html.replace('{{footer}}', config.noFooter === 'true' ? '' : (partials['footer'] || ''));
  html = html.replace('{{quote-modal}}', config.hasQuoteModal === 'true' ? (partials['quote-modal'] || '') : '');
  html = html.replace('{{scripts}}', buildScripts(config));

  fs.writeFileSync(path.join(DIST, pageFile), html);
  console.log(`  ✓ ${pageFile}`);
}

// Copy static assets
const staticFiles = ['styles.css', 'firebase-config.js', 'firebase-config.template.js', 'robots.txt', 'sitemap.xml'];
for (const file of staticFiles) {
  const src = path.join(__dirname, file);
  if (fs.existsSync(src)) {
    fs.copyFileSync(src, path.join(DIST, file));
    console.log(`  ✓ ${file} (static)`);
  }
}

// Copy images
const imagesDir = path.join(SRC, 'images');
if (fs.existsSync(imagesDir)) {
  for (const file of fs.readdirSync(imagesDir)) {
    fs.copyFileSync(path.join(imagesDir, file), path.join(DIST, 'images', file));
    console.log(`  ✓ images/${file}`);
  }
}

// Copy JS
const jsDir = path.join(SRC, 'js');
if (fs.existsSync(jsDir)) {
  for (const file of fs.readdirSync(jsDir)) {
    fs.copyFileSync(path.join(jsDir, file), path.join(DIST, 'js', file));
    console.log(`  ✓ js/${file}`);
  }
}

// Copy generate-firebase-config.sh for Vercel
const genScript = path.join(__dirname, 'generate-firebase-config.sh');
if (fs.existsSync(genScript)) {
  fs.copyFileSync(genScript, path.join(DIST, 'generate-firebase-config.sh'));
}

console.log(`\nBuild complete! ${pages.length} pages → dist/`);
