(function () {
  'use strict';

  const POLL_MS = 10000;
  const PLAYERS = [
    ['t_danger', 't.danger'], ['devi', 'devi'], ['jannejalopeura', 'jannejalopeura'],
    ['laama', 'laama'], ['batari', 'batari'], ['turisti', 'turisti'], ['muhinaattori', 'muhinaattori']
  ];

  const statusEl = document.getElementById('stats-status');
  const playerEl = document.getElementById('player-stats');
  const mapEl = document.getElementById('map-stats');
  const filterEl = document.getElementById('stats-filter');

  if (typeof SUPABASE_URL === 'undefined' || SUPABASE_URL.includes('XXXX')) {
    statusEl.textContent = 'Täytä Supabase-tiedot tiedostoon config.js';
    return;
  }
  const db = window.supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

  let games = [];
  let dayFilter = 'all';

  // Peli lasketaan vasta kun molemmat scoret on syötetty
  function result(g) {
    const own = parseFloat(g.omat_score);
    const enemy = parseFloat(g.vihu_score);
    if (isNaN(own) || isNaN(enemy)) return null;
    return own > enemy ? 'win' : enemy > own ? 'loss' : 'tie';
  }
  const emptyStat = () => ({ played: 0, win: 0, loss: 0, tie: 0 });
  function add(stat, res) { stat.played++; stat[res]++; }

  function compute() {
    const players = {};
    PLAYERS.forEach(([key]) => { players[key] = emptyStat(); });
    const maps = {};
    games
      .filter(g => dayFilter === 'all' || g.day === dayFilter)
      .forEach(g => {
        const r = result(g);
        if (!r) return;
        if (g.kartta) add(maps[g.kartta] = maps[g.kartta] || emptyStat(), r);
        PLAYERS.forEach(([key]) => { if (g[key]) add(players[key], r); });
      });
    return {
      players: PLAYERS.map(([key, name]) => [name, players[key]]),
      maps: Object.entries(maps)
    };
  }

  function renderTable(container, label, entries) {
    container.innerHTML = '';
    entries.sort((a, b) => b[1].played - a[1].played || a[0].localeCompare(b[0]));
    if (!entries.length) {
      container.textContent = 'Ei vielä pelejä';
      return;
    }
    const table = document.createElement('table');
    const head = table.createTHead().insertRow();
    [label, 'Pelit', 'Voitot', 'Tappiot', 'Tasurit', 'Voitto-%'].forEach(t => {
      const th = document.createElement('th');
      th.textContent = t;
      head.appendChild(th);
    });
    const body = table.createTBody();
    entries.forEach(([name, s]) => {
      const tr = body.insertRow();
      const pct = s.played ? Math.round((s.win / s.played) * 100) + ' %' : '–';
      [[name, ''], [s.played, ''], [s.win, 'win'], [s.loss, 'loss'], [s.tie, ''], [pct, '']].forEach(([v, cls]) => {
        const td = tr.insertCell();
        td.textContent = v;
        if (cls) td.className = cls;
      });
    });
    container.appendChild(table);
  }

  function render() {
    const { players, maps } = compute();
    renderTable(playerEl, 'Pelaaja', players);
    renderTable(mapEl, 'Kartta', maps);
  }

  filterEl.addEventListener('click', e => {
    const btn = e.target.closest('button[data-day]');
    if (!btn) return;
    dayFilter = btn.dataset.day;
    filterEl.querySelectorAll('button').forEach(b => b.classList.toggle('active', b === btn));
    render();
  });

  async function load() {
    if (document.hidden && games.length) return;
    const cols = ['day', 'kartta', 'omat_score', 'vihu_score', ...PLAYERS.map(p => p[0])].join(',');
    const { data, error } = await db.from('games').select(cols);
    if (error) {
      statusEl.textContent = 'Yhteysvirhe: ' + error.message;
      return;
    }
    statusEl.textContent = '';
    games = data;
    render();
  }

  statusEl.textContent = 'Ladataan…';
  load();
  setInterval(load, POLL_MS);
})();
