/* ---------- helpers ---------- */
const camelCaseName = name =>
  name
  .normalize('NFC')
  .split(/[^\p{L}\p{N}]+/u)
  .filter(Boolean)
  .map(w => w.charAt(0).toLocaleUpperCase() + w.slice(1).toLowerCase())
  .join('');

const toDMS = v => {
  const abs = Math.abs(v);
  const d = Math.floor(abs);
  const m = Math.floor((abs - d) * 60);
  const s = (abs - d - m / 60) * 3600;
  return [d, m, s];
};

const parseCoordinates = s => {
  const [lon, lat, ele = 0] = s.trim().split(/\s*,\s*/).map(Number);
  return [lon, lat, ele];
};

/* ---------- core conversion ---------- */
function placemarkToWpt(pm) {
  const coordsTag = pm.querySelector('Point coordinates');
  if (!coordsTag) return null;

  const [lon, lat, ele] = parseCoordinates(coordsTag.textContent);
  const [latD, latM, latS] = toDMS(lat);
  const [lonD, lonM, lonS] = toDMS(lon);

  const latDir = lat >= 0 ? 'N' : 'S';
  const lonDir = lon >= 0 ? 'E' : 'W';

  const nameEl = pm.querySelector('name');
  const descEl = pm.querySelector('description');

  const rawName = nameEl?.textContent.trim() || 'Waypoint';
  const formattedName = camelCaseName(rawName);

  let description = rawName;
  if (descEl && descEl.textContent.trim()) {
    description += ',' + descEl.textContent.trim();
  }

  return `${formattedName} ${latDir} ${String(latD).padStart(2,'0')} \
${String(latM).padStart(2,'0')} ${latS.toFixed(2).padStart(5,'0')} \
${lonDir} ${String(lonD).padStart(3,'0')} ${String(lonM).padStart(2,'0')} \
${lonS.toFixed(2).padStart(5,'0')} ${Math.round(ele)} ${description}`;
}

function convertKmlToWpt(kmlText) {
  const dom = new DOMParser().parseFromString(kmlText, 'application/xml');
  const placemarks = [...dom.querySelectorAll('Placemark')];

  // skip placemarks inside a Folder named "Waypoints" (mirrors the Python logic)
  const lines = placemarks.flatMap(pm => {
    let p = pm.parentElement;
    while (p) {
      if (
        p.tagName === 'Folder' &&
        p.querySelector(':scope > name')?.textContent.trim() === 'Waypoints'
      ) return [];
      p = p.parentElement;
    }
    const line = placemarkToWpt(pm);
    return line ? [line] : [];
  });

  return '$FormatGEO\n' + lines.join('\n');
}

/* ---------- UI wiring ---------- */
const fileInput  = document.getElementById('fileInput');
const convertBtn = document.getElementById('convertBtn');
const statusBox  = document.getElementById('status');
const fileLabel  = document.getElementById('fileLabel');
const fileName   = document.getElementById('fileName');

fileInput.addEventListener('change', () => {
  const hasFile = fileInput.files.length > 0;
  convertBtn.disabled = !hasFile;
  statusBox.textContent = '';
  
  if (hasFile) {
    const file = fileInput.files[0];
    fileName.textContent = file.name;
    fileLabel.classList.add('has-file');
  } else {
    fileName.textContent = '';
    fileLabel.classList.remove('has-file');
  }
});

convertBtn.addEventListener('click', async () => {
  const file = fileInput.files[0];
  if (!file) return;

  const text = await file.text();
  let wpt;
  try {
    wpt = convertKmlToWpt(text);
  } catch (e) {
    statusBox.textContent = 'Conversion error: ' + e.message;
    return;
  }

  const blob = new Blob([wpt], { type: 'text/plain' });
  const url  = URL.createObjectURL(blob);
  const a    = Object.assign(document.createElement('a'), {
    href: url,
    download: file.name.replace(/\.kml$/i, '') + '.wpt'
  });
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);

  statusBox.textContent = `✔️ Converted ${file.name} → ${a.download}`;
});

/* ---------- collapsible instructions ---------- */
const instructionsHeader = document.querySelector('.instructions-header');
const instructionsContent = document.querySelector('.instructions-content');
const instructionsToggle = document.querySelector('.instructions-toggle');

instructionsHeader.addEventListener('click', () => {
  const isExpanded = instructionsContent.classList.contains('expanded');
  
  if (isExpanded) {
    instructionsContent.classList.remove('expanded');
    instructionsToggle.classList.remove('expanded');
    instructionsToggle.textContent = '+';
  } else {
    instructionsContent.classList.add('expanded');
    instructionsToggle.classList.add('expanded');
    instructionsToggle.textContent = '−';
  }
}); 