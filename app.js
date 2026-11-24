'use strict';

const clock = document.getElementById('clock');
const metric = document.getElementById('metric');
const group = document.getElementById('group');
const search = document.getElementById('search');
const board = document.getElementById('afk-comparison');
const sortButtons = board.querySelectorAll('[data-sort]');
const subsets = ['Hostile','Benign','Turn-based','Overall'];
let sortSubset = 3;
let descending = true;

const modelLogos = {
  'GPT-6.1 Sol': 'openai',
  'GPT-6 Astra': 'openai',
  'Claude Opus 5.5': 'claude-color',
  'Claude Fable 5.2': 'claude-color',
  'DeepSeek-V4.1-Flash': 'deepseek-color',
  'GLM-5.3-Flash': 'zai',
  'Hy4-flash': 'hunyuan-color',
  'Qwen4-Max': 'qwen-color'
};

function appendRow(body, values) {
  const row = body.insertRow();
  for (const [index, value] of values.entries()) {
    const cell = document.createElement(index === 0 ? 'th' : 'td');
    if (index === 0) cell.scope = 'row';
    cell.textContent = value;
    row.append(cell);
  }
  return row;
}

function renderResults() {
  const success = metric.value === 'Success rate';
  const index = success ? 0 : 1;
  const selectedClock = clock.querySelector('input:checked').value;
  const rows = results.filter(row => row.clock === selectedClock);
  const points = row => row.scores[sortSubset][index];
  rows.sort((a, b) => points(b) - points(a));
  const ranks = new Map();
  rows.forEach((row, i) => {
    if (!ranks.has(points(row))) ranks.set(points(row), i + 1);
  });
  if (!descending) rows.sort((a, b) => points(a) - points(b));
  board.dataset.subset = sortSubset;
  for (const button of sortButtons) {
    const subset = Number(button.dataset.sort);
    const active = subset === sortSubset;
    button.dataset.active = String(active);
    const arrow = active ? (descending ? '↓' : '↑') : '↕';
    button.querySelector('.afk-arrow').textContent = arrow;
    const label = 'Sort ' + subsets[subset] + (active && descending ? ' lowest first' : ' highest first');
    button.setAttribute('aria-label',label);
    button.title = label;
    const head = button.closest('th');
    if (head && active) head.setAttribute('aria-sort', descending ? 'descending' : 'ascending');
    else if (head) head.removeAttribute('aria-sort');
  }
  const body = document.getElementById('scores');
  body.replaceChildren();
  rows.forEach(({model, harness, effort, scores}) => {
    const overall = scores[3][index];
    const rank = ranks.get(scores[sortSubset][index]);
    const values = scores.map(score => success ? score[0].toFixed(1) + '%' : score[1].toFixed(3));
    const row = body.insertRow();
    row.dataset.harness = harness;
    const rankCell = row.insertCell();
    rankCell.className = 'afk-place';
    const place = document.createElement('span');
    place.textContent = rank;
    if (rank <= 3) place.className = 'afk-place-' + rank;
    rankCell.append(place);

    const identity = document.createElement('th');
    identity.scope = 'row';
    row.append(identity);
    const label = document.createElement('div');
    label.className = 'afk-id';
    identity.append(label);
    const tile = document.createElement('span');
    tile.className = 'afk-logo';
    label.append(tile);
    if (modelLogos[model]) {
      const logo = document.createElement('img');
      logo.src = 'assets/model-logos/' + modelLogos[model] + '.svg';
      logo.alt = '';
      tile.append(logo);
    } else {
      tile.textContent = model === 'Random' ? '⚄' : '–';
      tile.setAttribute('aria-hidden','true');
    }
    const copy = document.createElement('span');
    copy.className = 'afk-model';
    const name = document.createElement('strong');
    name.textContent = model;
    const meta = document.createElement('small');
    meta.textContent = effort === '—' ? 'No model' : effort === 'Single mode' ? 'Single thinking mode' : effort + ' effort';
    const mobileHarness = document.createElement('span');
    mobileHarness.className = 'afk-mobile-harness';
    mobileHarness.textContent = ' · ' + harness;
    meta.append(mobileHarness);
    copy.append(name,meta);
    label.append(copy);

    const method = row.insertCell();
    method.className = 'afk-harness';
    method.textContent = harness;
    const score = row.insertCell();
    score.className = 'afk-overall';
    score.classList.toggle('afk-selected', sortSubset === 3);
    const track = document.createElement('span');
    track.className = 'afk-track';
    track.setAttribute('aria-hidden','true');
    const fill = document.createElement('i');
    fill.style.width = (success ? overall : overall * 100) + '%';
    track.append(fill);
    const number = document.createElement('b');
    number.textContent = values[3];
    score.append(track,number);
    subsets.slice(0,3).forEach((environment,i) => {
      const cell = row.insertCell();
      cell.className = 'afk-env';
      cell.classList.toggle('afk-selected', sortSubset === i);
      cell.dataset.environment = environment;
      cell.textContent = values[i];
    });
  });
  document.querySelector('.afk-scroll').scrollTop = 0;
  document.getElementById('metric-note').textContent = rows.length + ' entries · ' +
    (success ? 'Success rate' : 'Mean progress (0–1)') + ' · ' + subsets[sortSubset] +
    (descending ? ' highest first' : ' lowest first');
}

function renderGames() {
  const query = search.value.trim().toLowerCase();
  const matches = games.filter(([name, environment]) => name.toLowerCase().includes(query)
    && (group.value === 'All environments' || group.value === environment));
  const body = document.getElementById('games');
  body.replaceChildren();
  for (const [name, environment, vista, autopilot] of matches) {
    appendRow(body, [name, environment, vista + '/3', autopilot + '/3']);
  }
  document.getElementById('count').textContent = matches.length
    ? matches.length + (matches.length === 1 ? ' game' : ' games')
    : 'No games match this search.';
}

clock.addEventListener('change', renderResults);
metric.addEventListener('change', renderResults);
for (const button of sortButtons) {
  button.addEventListener('click', () => {
    const next = Number(button.dataset.sort);
    descending = next === sortSubset ? !descending : true;
    sortSubset = next;
    renderResults();
  });
}
search.addEventListener('input', renderGames);
group.addEventListener('change', renderGames);

const cases = document.querySelectorAll('[data-case]');
for (const button of cases) {
  button.addEventListener('click', () => {
    for (const candidate of cases) {
      const selected = candidate === button;
      candidate.setAttribute('aria-pressed', String(selected));
      document.getElementById('case-' + candidate.dataset.case).hidden = !selected;
    }
  });
}

renderResults();
renderGames();

document.getElementById('section-menu').addEventListener('change', event => {
  const section = document.getElementById(event.target.value);
  if (!section) return;
  if (section.tagName === 'DETAILS') section.open = true;
  location.hash = section.id;
  event.target.selectedIndex = 0;
});
