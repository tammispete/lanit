(function () {
  'use strict';

  const DAY = document.body.dataset.day;      // "perjantai" tai "lauantai"
  const TABLE = 'games';
  const POLL_MS = 5000;                       // kuinka usein haetaan muiden muutokset
  const SAVE_DELAY_MS = 500;                  // tekstikenttien tallennusviive

  // ---------- Valikko ----------
  const hamburger = document.getElementById('hamburger');
  const navMenu = document.getElementById('nav-menu');
  hamburger.addEventListener('click', () => {
    hamburger.classList.toggle('active');
    navMenu.classList.toggle('active');
  });

  // ---------- Tila ----------
  const statusEl = document.getElementById('status');
  function setStatus(text, isError) {
    statusEl.textContent = text;
    statusEl.className = isError ? 'error' : '';
  }

  if (typeof SUPABASE_URL === 'undefined' || SUPABASE_URL.includes('XXXX')) {
    setStatus('Täytä Supabase-tiedot tiedostoon config.js', true);
    return;
  }
  const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  // ---------- Sarakkeet ----------
  const columns = [
    { key: 'kartta',         name: 'KARTTA',         type: 'select', options: ['Ancient', 'Anubis', 'Cache', 'Dust2', 'Inferno', 'Mirage', 'Nuke'] },
    { key: 'omat_score',     name: 'OMAT SCORE',     type: 'text' },
    { key: 'vihu_score',     name: 'VIHU SCORE',     type: 'text' },
    { key: 'tulos',          name: 'voitto/tappio',  type: 'result' },
    { key: 't_danger',       name: 't.danger',       type: 'check' },
    { key: 'devi',           name: 'devi',           type: 'check' },
    { key: 'jannejalopeura', name: 'jannejalopeura', type: 'check' },
    { key: 'laama',          name: 'laama',          type: 'check' },
    { key: 'batari',         name: 'batari',         type: 'check' },
    { key: 'turisti',        name: 'turisti',        type: 'check' },
    { key: 'muhinaattori',   name: 'muhinaattori',   type: 'check' },
    { key: 'poista',         name: 'POISTA',         type: 'action' }
  ];
  const dataCols = columns.filter(c => ['text', 'select', 'check'].includes(c.type));

  // ---------- Rivit ----------
  const emptyRow = () => {
    const r = { id: null, tulos: '' };
    dataCols.forEach(c => { r[c.key] = c.type === 'check' ? false : ''; });
    return r;
  };
  const isEmpty = row => dataCols.every(c => row[c.key] === '' || row[c.key] === false);

  function computeResult(row) {
    const own = parseFloat(row.omat_score);
    const enemy = parseFloat(row.vihu_score);
    row.tulos = '';
    if (!isNaN(own) && !isNaN(enemy)) {
      row.tulos = own > enemy ? 'voitto' : enemy > own ? 'tappio' : 'tasuri';
    }
  }
  function fromDb(rec) {
    const r = emptyRow();
    r.id = rec.id;
    dataCols.forEach(c => { if (rec[c.key] != null) r[c.key] = rec[c.key]; });
    computeResult(r);
    return r;
  }
  function toDb(row) {
    const o = { day: DAY };
    dataCols.forEach(c => { o[c.key] = row[c.key]; });
    return o;
  }
  const signature = row => JSON.stringify([row.id, ...dataCols.map(c => row[c.key])]);

  let rows = [];            // tallennetut rivit (järjestys = id-järjestys)
  let draft = emptyRow();   // viimeinen tyhjä rivi, johon kirjoitetaan seuraava peli
  let loaded = false;
  let connError = false;

  const headRow = document.getElementById('headRow');
  const tbody = document.querySelector('#dataTable tbody');
  const countersEl = document.getElementById('counters');

  // ---------- Otsikot ----------
  columns.forEach(col => {
    const th = document.createElement('th');
    th.textContent = col.name;
    headRow.appendChild(th);
  });

  // ---------- Näkymä ----------
  function updateResult(row) {
    computeResult(row);
    if (!row._resultSpan) return;
    row._resultSpan.textContent = row.tulos;
    row._resultCell.className = row.tulos === 'voitto' ? 'win' : row.tulos === 'tappio' ? 'loss' : 'tasapeli';
  }

  // Keltainen = 2 putkeen, punainen = 3+ putkeen
  function updateHighlights() {
    const all = [...rows, draft];
    all.forEach((row, index) => {
      if (!row._tr) return;
      columns.forEach((col, ci) => {
        if (col.type !== 'check') return;
        const td = row._tr.children[ci];
        let streak = 0;
        for (let i = index - 1; i >= 0 && all[i][col.key] === true; i--) streak++;
        td.classList.toggle('red-cell', streak >= 3);
        td.classList.toggle('yellow-cell', streak === 2);
      });
    });
  }

  function updateCounters() {
    countersEl.innerHTML = '';
    const all = [...rows, draft];
    columns.forEach(col => {
      if (col.type !== 'check') return;
      const badge = document.createElement('span');
      badge.className = 'counter';
      badge.textContent = col.name + ': ' + all.filter(r => r[col.key]).length;
      countersEl.appendChild(badge);
    });
  }

  function buildRow(row) {
    const tr = document.createElement('tr');
    row._tr = tr;
    columns.forEach(col => {
      const td = document.createElement('td');
      let el;
      if (col.type === 'check') {
        td.className = 'check';
        el = document.createElement('input');
        el.type = 'checkbox';
        el.checked = row[col.key];
        el.addEventListener('change', () => { row[col.key] = el.checked; onChange(row, true); });
      } else if (col.type === 'result') {
        el = document.createElement('span');
        row._resultSpan = el;
        row._resultCell = td;
      } else if (col.type === 'select') {
        el = document.createElement('select');
        ['', ...col.options].forEach(v => {
          const o = document.createElement('option');
          o.value = v; o.textContent = v;
          el.appendChild(o);
        });
        el.value = row[col.key];
        el.addEventListener('change', () => { row[col.key] = el.value; onChange(row, true); });
      } else if (col.type === 'action') {
        el = document.createElement('button');
        el.type = 'button';
        el.className = 'delete-btn';
        el.textContent = '❌';
        el.addEventListener('click', () => deleteRow(row));
      } else {
        el = document.createElement('input');
        el.type = 'text';
        el.value = row[col.key];
        el.addEventListener('input', () => { row[col.key] = el.value; updateResult(row); onChange(row, false); });
      }
      td.appendChild(el);
      tr.appendChild(td);
    });
    updateResult(row);
    return tr;
  }

  function render() {
    tbody.innerHTML = '';
    rows.forEach(r => tbody.appendChild(buildRow(r)));
    tbody.appendChild(buildRow(draft));
    updateHighlights();
    updateCounters();
  }

  // ---------- Muutokset ----------
  function onChange(row, immediate) {
    if (row === draft) {
      if (isEmpty(row)) { updateCounters(); updateHighlights(); return; }
      rows.push(row);                // viimeinen rivi sai sisältöä -> siitä tulee oikea rivi
      draft = emptyRow();
      tbody.appendChild(buildRow(draft));
    }
    updateCounters();
    updateHighlights();
    scheduleSave(row, immediate);
  }

  function deleteRow(row) {
    if (row === draft) { draft = emptyRow(); render(); return; }
    if (!isEmpty(row) && !confirm('Poistetaanko rivi?')) return;
    rows = rows.filter(r => r !== row);
    row._deleted = true;
    clearTimeout(row._timer);
    row._timer = null;
    saveRow(row);
    render();
  }

  // ---------- Tallennus ----------
  function scheduleSave(row, immediate) {
    clearTimeout(row._timer);
    if (immediate) {
      row._timer = null;
      saveRow(row);
    } else {
      row._timer = setTimeout(() => { row._timer = null; saveRow(row); }, SAVE_DELAY_MS);
    }
  }

  async function saveRow(row) {
    if (row._pending) { row._dirty = true; return; }
    row._pending = true;
    setStatus('Tallennetaan…');
    try {
      do {
        row._dirty = false;
        if (row._deleted) {
          if (row.id != null) {
            const { error } = await db.from(TABLE).delete().eq('id', row.id);
            if (error) throw error;
          }
          break;
        }
        if (row.id == null) {
          const res = await db.from(TABLE).insert(toDb(row)).select('id').single();
          if (res.error) throw res.error;
          row.id = res.data.id;
        } else {
          const { error } = await db.from(TABLE).update(toDb(row)).eq('id', row.id);
          if (error) throw error;
        }
      } while (row._dirty);
      setStatus('Tallennettu ✓');
    } catch (e) {
      setStatus('Tallennus epäonnistui: ' + (e.message || e), true);
    } finally {
      row._pending = false;
    }
  }

  // ---------- Lataus ja päivitys muilta ----------
  function isBusy() {
    const a = document.activeElement;
    const typing = a && tbody.contains(a) &&
      (a.tagName === 'SELECT' || (a.tagName === 'INPUT' && a.type === 'text'));
    return typing || rows.some(r => r._pending || r._timer);
  }

  async function load() {
    if (document.hidden && loaded) return;
    const { data, error } = await db.from(TABLE).select('*').eq('day', DAY).order('id', { ascending: true });
    if (error) {
      connError = true;
      setStatus('Yhteysvirhe: ' + error.message, true);
      return;
    }
    if (connError) { connError = false; setStatus(''); }
    const remote = data.map(fromDb);
    if (loaded) {
      if (remote.map(signature).join() === rows.map(signature).join()) return;  // ei muutoksia
      if (isBusy()) return;                                                      // älä keskeytä kirjoitusta
    }
    rows = remote;
    loaded = true;
    render();
  }

  render();
  setStatus('Ladataan…');
  load().then(() => { if (loaded && !connError) setStatus(''); });
  setInterval(load, POLL_MS);
})();