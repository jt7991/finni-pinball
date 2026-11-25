import {voiceRequest} from './voice-session.js';

function groupNumberedCallouts(ids) {
  const numbered = /^(vo_player|vo_ball|vo_lildp_jackpot)(\d+)(?:locked)?$|^vo_(\d+)x(combo|bonus|playfield)$/;
  const families = new Map();
  for (const id of ids) {
    const match = id.match(numbered);
    if (!match) continue;
    const family = match[1] || match[4];
    if (!families.has(family)) families.set(family, []);
    families.get(family).push({id, number: Number(match[2] || match[3])});
  }
  return ids.flatMap(id => {
    const match = id.match(numbered);
    if (!match) return [id];
    const family = match[1] || match[4];
    const members = families.get(family);
    if (!members) return [];
    families.delete(family);
    return members.sort((a, b) => a.number - b.number).map(member => member.id);
  });
}

export function calloutCatalog(session, lines, groups, selectLine) {
  const catalog = document.getElementById('callout-catalog');
  const status = document.getElementById('catalog-status');
  const rows = new Map();
  const takes = new Map();
  let selectedButton;
  const dateFormat = new Intl.DateTimeFormat(undefined, {dateStyle: 'medium', timeStyle: 'short'});
  const duplicates = new Map();
  for (const {ids} of groups) {
    for (const id of ids) {
      const text = lines[id];
      duplicates.set(text, (duplicates.get(text) || 0) + 1);
    }
  }

  function section(title) {
    const group = document.createElement('details');
    group.className = 'catalog-group';
    const heading = document.createElement('summary');
    heading.textContent = title;
    const list = document.createElement('ul');
    list.className = 'recordings-list';
    group.append(heading, list);
    catalog.append(group);
    return list;
  }

  function row(list, text, trigger) {
    const item = document.createElement('li');
    const heading = document.createElement('h3');
    heading.textContent = text;
    const note = document.createElement('p');
    note.className = 'callout-trigger';
    note.textContent = trigger;
    const credits = document.createElement('div');
    credits.className = 'recording-credits';
    item.append(heading, note, credits);
    list.append(item);
    return {item, credits};
  }

  function renderTakes(view, recordings) {
    view.replaceChildren();
    if (!recordings?.size) {
      const empty = document.createElement('p');
      empty.textContent = 'No recordings yet';
      view.append(empty);
      return;
    }
    for (const take of [...recordings.values()].sort((a, b) => b.created.localeCompare(a.created))) {
      const entry = document.createElement('div');
      entry.className = 'recording-credit';
      const credit = document.createElement('span');
      credit.textContent = take.speaker || 'Recorder unknown';
      credit.title = dateFormat.format(new Date(take.created));
      const listen = document.createElement('button');
      listen.type = 'button';
      listen.textContent = 'Listen';
      listen.setAttribute('aria-label', `Listen to ${credit.textContent} record ${take.line_text}`);
      listen.addEventListener('click', async () => {
        listen.disabled = true;
        try {
          const {token} = await voiceRequest(session, '/api/files/token', {method: 'POST'});
          const player = document.createElement('audio');
          player.controls = true;
          player.setAttribute('aria-label', listen.getAttribute('aria-label'));
          player.src = `/api/files/${take.collectionId}/${take.id}/${encodeURIComponent(take.processed)}?token=${encodeURIComponent(token)}`;
          player.addEventListener('error', () => { listen.textContent = 'Retry audio'; player.replaceWith(listen); }, {once: true});
          listen.replaceWith(player);
          player.play().catch(() => {});
        } catch {
          listen.textContent = 'Retry audio';
        } finally {
          listen.disabled = false;
        }
      });
      entry.append(credit, listen);
      view.append(entry);
    }
  }

  function add(take) {
    if (!rows.has(take.line_id)) return;
    if (!takes.has(take.line_id)) takes.set(take.line_id, new Map());
    const recordings = takes.get(take.line_id);
    if (recordings.has(take.id)) return;
    recordings.set(take.id, take);
    renderTakes(rows.get(take.line_id), recordings);
  }

  for (const {title, ids, when} of groups) {
    const list = section(title);
    for (const id of groupNumberedCallouts(ids)) {
      if (!Object.hasOwn(lines, id)) continue;
      const {item, credits} = row(list, lines[id], when[id]);
      if (duplicates.get(lines[id]) > 1) {
        const detail = document.createElement('small');
        detail.textContent = id;
        item.querySelector('h3').append(detail);
      }
      const record = document.createElement('button');
      record.type = 'button';
      record.className = 'choose-callout';
      record.textContent = 'Record';
      record.setAttribute('aria-label', `Select ${lines[id]} to record`);
      record.setAttribute('aria-pressed', 'false');
      record.addEventListener('click', () => {
        if (!selectLine(id)) return;
        selectedButton?.setAttribute('aria-pressed', 'false');
        record.setAttribute('aria-pressed', 'true');
        selectedButton = record;
      });
      item.append(record);
      rows.set(id, credits);
      const loading = document.createElement('p');
      loading.textContent = 'Checking recordings…';
      credits.append(loading);
    }
  }
  async function load() {
    for (let page = 1; ; page++) {
      const records = await voiceRequest(session, `/api/collections/voice_takes/records?sort=-created,-id&page=${page}&perPage=100`);
      records.items.forEach(add);
      if (page >= records.totalPages) break;
    }
    for (const [id, view] of rows) {
      if (!takes.has(id)) renderTakes(view);
    }
    status.hidden = true;
  }
  load().catch(() => {
    status.textContent = 'Could not load all recordings. Refresh to try again.';
    status.classList.add('error');
    for (const [id, view] of rows) if (!takes.has(id)) view.replaceChildren();
  });
  return add;
}
