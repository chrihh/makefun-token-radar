// Launch Radar dashboard. Reads window.RADAR (written beside dashboard/ by
// main.ts) and renders the peer-priced board, filters, a per-category peer
// table, and a detail drawer for every protocol with the model's workings
// and the protocol's own farm plan. No network: data.js is the whole dataset.
(function () {
  'use strict';

  var DATA = window.RADAR;
  if (!DATA) return;
  var app = document.getElementById('board');
  var state = { q: '', category: 'all', chain: 'all', tier: 'all', tab: 'pre-token', sort: 'implied', dir: -1, selected: null };

  var usd = new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });
  function fmtUsd(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    if (Math.abs(n) >= 1e9) return '$' + (n / 1e9).toFixed(2) + 'B';
    if (Math.abs(n) >= 1e6) return '$' + (n / 1e6).toFixed(1) + 'M';
    if (Math.abs(n) >= 1e3) return '$' + Math.round(n / 1e3) + 'K';
    return usd.format(n);
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + n.toFixed(2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return (days / 365).toFixed(1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  function fmtMult(n) { return n === null || n === undefined ? 'n/a' : Number(n).toFixed(3).replace(/0+$/, '').replace(/\.$/, '') + 'x'; }

  // The model, recomputed in the page from the figures data.js carries, so a
  // reader can check any row against board.json: the numbers must agree.
  function impliedOf(row, m) {
    var growth = Math.min(m.growth_cap, Math.max(m.growth_floor, row.change_7d === null || row.change_7d === undefined ? 0 : row.change_7d));
    var growthMult = 1 + (growth / 100) * m.growth_weight;
    var age = row.age_days === null || row.age_days === undefined ? m.unknown_age_days : row.age_days;
    var maturity = m.maturity_floor + (Math.min(Math.max(age, 0), m.maturity_days) / m.maturity_days) * m.maturity_range;
    var breadth = 1 + Math.min(Math.max((row.chains || []).length - 1, 0), m.breadth_max_chains) * m.breadth_per_chain;
    var launch = m.launch_base + m.launch_span * row.launch_rate;
    return Math.max(1, Math.round(row.tvl_usd * row.peer_multiple * launch * growthMult * maturity * breadth));
  }

  function el(tag, attrs) {
    var node = document.createElement(tag);
    if (attrs) {
      Object.keys(attrs).forEach(function (k) {
        if (k === 'class') node.className = attrs[k];
        else if (k === 'text') node.textContent = attrs[k];
        else if (k.slice(0, 2) === 'on') node.addEventListener(k.slice(2), attrs[k]);
        else if (attrs[k] !== null && attrs[k] !== undefined) node.setAttribute(k, attrs[k]);
      });
    }
    for (var i = 2; i < arguments.length; i++) {
      var child = arguments[i];
      if (child === null || child === undefined) continue;
      if (Array.isArray(child)) child.forEach(function (c) { if (c) node.appendChild(c); });
      else if (typeof child === 'string') node.appendChild(document.createTextNode(child));
      else node.appendChild(child);
    }
    return node;
  }

  function readHash() {
    var hash = window.location.hash.replace(/^#/, '');
    if (!hash) return;
    var params = new URLSearchParams(hash);
    if (params.get('q')) state.q = params.get('q');
    if (params.get('p')) state.selected = params.get('p');
    if (params.get('category')) state.category = params.get('category');
    if (params.get('tier')) state.tier = params.get('tier');
    if (params.get('chain')) state.chain = params.get('chain');
  }
  function writeHash() {
    var params = new URLSearchParams();
    if (state.q) params.set('q', state.q);
    if (state.category !== 'all') params.set('category', state.category);
    if (state.tier !== 'all') params.set('tier', state.tier);
    if (state.chain !== 'all') params.set('chain', state.chain);
    if (state.selected) params.set('p', state.selected);
    var next = params.toString();
    if (next) window.history.replaceState(null, '', '#' + next);
    else window.history.replaceState(null, '', window.location.pathname + window.location.search);
  }

  function rows() {
    var q = state.q.trim().toLowerCase();
    return DATA.rows.filter(function (r) {
      if (state.category !== 'all' && (r.category || 'Other') !== state.category) return false;
      if (state.tier !== 'all' && r.tier !== state.tier) return false;
      if (state.chain !== 'all' && (r.chains || []).indexOf(state.chain) < 0) return false;
      if (!q) return true;
      var hay = [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }
  function sortedRows(list) {
    var key = state.sort;
    return list.slice().sort(function (a, b) {
      var av, bv;
      if (key === 'name') { av = a.name.toLowerCase(); bv = b.name.toLowerCase(); }
      else if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'growth') { av = a.change_7d === null ? -Infinity : a.change_7d; bv = b.change_7d === null ? -Infinity : b.change_7d; }
      else if (key === 'score') { av = a.launch_score; bv = b.launch_score; }
      else if (key === 'age') { av = a.age_days === null ? Infinity : a.age_days; bv = b.age_days === null ? Infinity : b.age_days; }
      else { av = a.implied_value_usd; bv = b.implied_value_usd; }
      if (av < bv) return -state.dir;
      if (av > bv) return state.dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }

  function header() {
    return el('header', { class: 'top' },
      el('div', { class: 'brand' }, el('span', { class: 'mark' }), el('span', { class: 'brand-name', text: 'Launch Radar' })),
      el('div', { class: 'top-meta' },
        el('span', { text: 'Snapshot ' + DATA.as_of }),
        el('span', { text: 'DefiLlama protocol index, sealed' }),
        el('span', { text: DATA.model_version + ' model' })
      )
    );
  }

  function lede() {
    return el('section', { class: 'lede' },
      el('div', null,
        el('h1', null, 'Protocols with no token yet, ', el('span', { class: 'accent', text: 'priced by the peers that already trade' })),
        el('p', { text: 'Every protocol on the watchlist (at least $' + Math.round(DATA.floor_usd / 1e6) + 'M of TVL, no token on record, not a wrapped or staked product of a traded one) is covered, and the early radar adds ' + DATA.early_size + ' clean pre-token protocols below that floor. Each implied value is its category\u2019s traded market-cap / TVL multiple, adjusted for how often that category actually launches, one week of growth, age, and chain breadth. A model, not a promise: no row here is a prediction that a token will exist.' })
      ),
      el('div', { class: 'facts' },
        el('div', { class: 'fact' }, el('span', { text: 'Watchlist covered' }), el('b', { text: DATA.watchlist_size + ' / ' + DATA.watchlist_size })),
        el('div', { class: 'fact' }, el('span', { text: 'Pre-token rows scored' }), el('b', { text: String(DATA.board_size) })),
        el('div', { class: 'fact' }, el('span', { text: 'Board TVL' }), el('b', { text: fmtUsd(DATA.total_tvl_usd) })),
        el('div', { class: 'fact' }, el('span', { text: 'Total implied value' }), el('b', { text: fmtUsd(DATA.total_implied_usd) }))
      )
    );
  }

  function selectField(id, label, values, current, onChange) {
    var select = el('select', { id: id, 'aria-label': label },
      values.map(function (v) { return el('option', { value: v.value, text: v.label, selected: v.value === current ? 'selected' : null }); })
    );
    select.addEventListener('change', function () { onChange(select.value); writeHash(); render(); });
    return el('div', { class: 'field' }, el('label', { for: id, text: label }), select);
  }

  function controls() {
    var categories = Array.from(new Set(DATA.rows.map(function (r) { return r.category || 'Other'; }))).sort();
    var chains = Array.from(new Set(DATA.rows.flatMap(function (r) { return r.chains || []; }))).sort();
    var search = el('input', { type: 'search', id: 'q', placeholder: 'Search name, category or chain', value: state.q, 'aria-label': 'Search the board' });
    search.addEventListener('input', function () { state.q = search.value; writeHash(); render(); });
    var pre = el('button', { type: 'button', 'aria-pressed': state.tab === 'pre-token' ? 'true' : 'false', text: 'Pre-token board', onclick: function () { state.tab = 'pre-token'; render(); } });
    var live = el('button', { type: 'button', 'aria-pressed': state.tab === 'live' ? 'true' : 'false', text: 'Live tokens (the peers)', onclick: function () { state.tab = 'live'; render(); } });
    return el('div', { class: 'controls' },
      el('div', { class: 'field' }, el('label', { for: 'q', text: 'Search' }), search),
      selectField('category', 'Category', [{ value: 'all', label: 'All categories' }].concat(categories.map(function (c) { return { value: c, label: c }; })), state.category, function (v) { state.category = v; }),
      selectField('chain', 'Chain', [{ value: 'all', label: 'All chains' }].concat(chains.map(function (c) { return { value: c, label: c }; })), state.chain, function (v) { state.chain = v; }),
      selectField('tier', 'Conviction tier', ['all', 'Prime', 'Strong', 'Watch', 'Early'].map(function (t) { return { value: t, label: t === 'all' ? 'All tiers' : t }; }), state.tier, function (v) { state.tier = v; }),
      el('div', { class: 'field' }, el('span', { class: 'sub', text: 'Board' }), el('div', { class: 'tabs' }, pre, live)),
      el('span', { class: 'count', text: state.tab === 'pre-token' ? rows().length + ' of ' + DATA.board_size + ' rows shown' : DATA.live.length + ' traded peers shown' })
    );
  }

  function sortHeader(key, label) {
    return el('th', { scope: 'col' },
      el('button', { type: 'button', onclick: function () { if (state.sort === key) state.dir = -state.dir; else { state.sort = key; state.dir = key === 'name' || key === 'age' ? 1 : -1; } render(); } },
        label,
        state.sort === key ? el('span', { 'aria-hidden': 'true', text: state.dir < 0 ? ' \u25bc' : ' \u25b2' }) : null
      )
    );
  }

  function boardTable() {
    var list = sortedRows(rows());
    if (list.length === 0) {
      return el('div', { class: 'panel' }, el('div', { class: 'empty' },
        el('h2', { text: 'Nothing on the scope matches that filter' }),
        el('p', { text: 'Clear the search or widen the category, chain or tier filter to see the board again.' }),
        el('button', { class: 'button primary', type: 'button', text: 'Clear filters', onclick: function () { state.q = ''; state.category = 'all'; state.chain = 'all'; state.tier = 'all'; writeHash(); render(); } })
      ));
    }
    // Bars keep the whole board's absolute scale, so a filtered view does not
    // promote its own top row to a full bar: rank 1's value is the ruler.
    var max = (DATA.rows[0] && DATA.rows[0].implied_value_usd) || 1;
    var tbody = el('tbody');
    list.forEach(function (r) {
      var growthClass = r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg';
      var tr = el('tr', {
        'data-selected': state.selected === r.slug ? 'true' : 'false',
        tabindex: '0',
        onclick: function () { openDetail(r.slug); },
        onkeydown: function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); openDetail(r.slug); } }
      },
        el('td', { class: 'num', text: String(r.rank) }),
        el('td', null, el('div', { class: 'name' },
          el('b', { text: r.name }),
          el('span', { class: 'sub', text: (r.category || 'Other') + ' \u00b7 ' + (r.chains && r.chains.length ? r.chains.slice(0, 3).join(', ') : 'an unnamed chain') })
        )),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + growthClass, text: fmtPct(r.change_7d) }),
        el('td', { class: 'num', text: fmtMult(r.peer_multiple) }),
        el('td', null, el('span', { class: 'score' },
          el('span', { class: 'track', 'aria-hidden': 'true' }, el('i', { style: 'width:' + r.launch_score + '%' })),
          el('span', { class: 'num', text: String(r.launch_score) })
        ), ' ', el('span', { class: 'tier ' + r.tier, text: r.tier })),
        el('td', null, el('div', { class: 'implied' },
          el('div', { class: 'bar', 'aria-hidden': 'true' }, el('i', { style: 'width:' + Math.max(3, Math.round((r.implied_value_usd / max) * 100)) + '%' })),
          el('span', { class: 'num', text: fmtUsd(r.implied_value_usd) })
        )),
        el('td', null, el('span', { class: 'status', text: 'no token' }))
      );
      tbody.appendChild(tr);
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { text: 'Pre-token protocols ranked by implied value. The peer multiple is the median market-cap / TVL of traded protocols in the same category, shrunk toward the market median. Select any row for its full workings and farm plan.' }),
          el('thead', null, el('tr', null,
            sortHeader('implied', 'Rank'),
            sortHeader('name', 'Protocol'),
            sortHeader('tvl', 'TVL'),
            sortHeader('growth', '7d'),
            el('th', { scope: 'col', text: 'Peer \u00d7' }),
            sortHeader('score', 'Launch score'),
            sortHeader('implied', 'Implied value'),
            el('th', { scope: 'col', text: 'Token' })
          )),
          tbody
        )
      )
    );
  }

  function liveTable() {
    var tbody = el('tbody');
    DATA.live.forEach(function (r) {
      tbody.appendChild(el('tr', null,
        el('td', null, el('span', { class: 'status live', text: r.symbol ? '$' + r.symbol : 'trades' })),
        el('td', null, el('div', { class: 'name' }, el('b', { text: r.name }), el('span', { class: 'sub', text: (r.category || 'Other') + ' \u00b7 ' + (r.chains && r.chains.length ? r.chains.slice(0, 2).join(', ') : 'an unnamed chain') }))),
        el('td', { class: 'num', text: fmtUsd(r.tvl_usd) }),
        el('td', { class: 'num ' + (r.change_7d !== null && r.change_7d >= 0 ? 'pos' : 'neg'), text: fmtPct(r.change_7d) }),
        el('td', { class: 'num', text: fmtUsd(r.mcap_usd) }),
        el('td', { class: 'num', text: fmtMult(r.multiple) })
      ));
    });
    return el('div', { class: 'panel' },
      el('div', { class: 'table-wrap' },
        el('table', null,
          el('caption', { text: 'The peers: these protocols already trade, so their market cap is a fact, not a model. Their category medians are the multiples the pre-token board is priced with \u2014 they are never ranked as launches.' }),
          el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Token' }), el('th', { scope: 'col', text: 'Protocol' }), el('th', { scope: 'col', text: 'TVL' }), el('th', { scope: 'col', text: '7d' }), el('th', { scope: 'col', text: 'Market cap' }), el('th', { scope: 'col', text: 'Cap / TVL' }))),
          tbody
        )
      )
    );
  }

  function modelPanel() {
    var m = DATA.model;
    return el('section', { class: 'panel model' },
      el('h2', { text: 'How an implied value is priced' }),
      el('p', { class: 'sub', text: 'One function scores every protocol from the snapshot\u2019s own figures. No name is special-cased, no row is hand-picked, and the page recomputes every row so the board can be audited from the screen.' }),
      el('div', { class: 'formula', text: 'implied = TVL \u00d7 peer multiple (category median cap/TVL, shrunk by ' + m.shrink_peers + ' toward the market median) \u00d7 launch factor (' + m.launch_base + ' + ' + m.launch_span + ' \u00d7 category launch rate) \u00d7 growth \u00d7 maturity \u00d7 breadth' }),
      el('div', { class: 'model-grid' },
        el('div', null, el('b', { text: 'Peer multiple' }), el('p', { text: 'What the market actually pays for a dollar of TVL in this category. A category with few traded peers borrows most of its multiple from the whole market, so two lucky peers cannot set a price.' })),
        el('div', null, el('b', { text: 'Launch factor' }), el('p', { text: 'The share of the category that has ever issued a token, shrunk the same way. Categories that habitually launch are priced up; categories that habitually do not are priced down, never to zero.' })),
        el('div', null, el('b', { text: 'Growth, maturity, breadth' }), el('p', { text: 'Seven-day TVL change clamped to [' + m.growth_floor + '%, +' + m.growth_cap + '%] and weighted ' + m.growth_weight + '; a three-year maturity ramp for time run with no token (unknown age counts as ' + m.unknown_age_days + ' days); and +' + (m.breadth_per_chain * 100) + '% per extra chain, up to ' + m.breadth_max_chains + '.' })),
        el('div', null, el('b', { text: 'Launch score & tiers' }), el('p', { text: 'A separate 0\u2013100 readiness score (category launch habit, scale, age, momentum) shown as Prime, Strong, Watch or Early. It orders nothing: the ranking is the implied value alone, so the two can be disagreed with independently.' }))
      )
    );
  }

  function peersPanel() {
    var tbody = el('tbody');
    DATA.categories.forEach(function (c) {
      tbody.appendChild(el('tr', null,
        el('td', { text: c.category }),
        el('td', { class: 'num', text: String(c.peers) }),
        el('td', { class: 'num', text: fmtMult(c.multiple) }),
        el('td', { class: 'num', text: Math.round(c.launch_rate * 100) + '%' })
      ));
    });
    return el('section', { class: 'panel peers' },
      el('h2', { text: 'The peer table behind the prices' }),
      el('p', { class: 'sub', text: 'Every category on the board, the traded peers that price it, the shrunk multiple used, and how often that category has launched a token before. Thin categories sit close to the market median by construction.' }),
      el('div', { class: 'table-wrap' }, el('table', null,
        el('thead', null, el('tr', null, el('th', { scope: 'col', text: 'Category' }), el('th', { scope: 'col', text: 'Traded peers' }), el('th', { scope: 'col', text: 'Multiple used' }), el('th', { scope: 'col', text: 'Launch rate' }))),
        tbody
      ))
    );
  }

  var dialog = el('dialog', { class: 'detail', id: 'detail', 'aria-labelledby': 'detail-title' });
  dialog.addEventListener('close', function () { state.selected = null; writeHash(); });

  function openDetail(slug) {
    var row = DATA.rows.filter(function (r) { return r.slug === slug; })[0];
    if (!row) return;
    state.selected = slug;
    writeHash();
    dialog.textContent = '';
    var recomputed = impliedOf(row, DATA.model);
    dialog.appendChild(el('div', { class: 'detail-head' },
      el('div', null,
        el('span', { class: 'sub', text: 'Rank ' + row.rank + ' of ' + DATA.board_size + ' \u00b7 ' + row.tier + ' \u00b7 launch score ' + row.launch_score + '/100' }),
        el('h2', { id: 'detail-title', text: row.name }),
        el('p', { class: 'sub', text: (row.category || 'Other') + ' on ' + (row.chains && row.chains.length ? row.chains.join(', ') : 'an unnamed chain') + ' \u00b7 listed ' + (row.listed_at || 'date unknown') + ' \u00b7 no token on record' })
      ),
      el('button', { class: 'close', type: 'button', 'aria-label': 'Close details', text: 'Close', onclick: function () { dialog.close(); } })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Implied value, step by step' }),
      el('div', { class: 'equation' },
        el('div', null, el('span', { text: 'TVL' }), el('b', { class: 'num', text: fmtUsd(row.tvl_usd) })),
        el('div', null, el('span', { text: 'Peer multiple (' + row.peers + ' traded peers)' }), el('b', { class: 'num', text: fmtMult(row.peer_multiple) })),
        el('div', null, el('span', { text: 'Launch factor (rate ' + Math.round(row.launch_rate * 100) + '%)' }), el('b', { class: 'num', text: String(row.launch_factor) })),
        el('div', null, el('span', { text: '7d growth ' + fmtPct(row.change_7d) }), el('b', { class: 'num', text: fmtMult(row.growth_multiplier) })),
        el('div', null, el('span', { text: 'Maturity (' + fmtAge(row.age_days) + ' tokenless)' }), el('b', { class: 'num', text: fmtMult(row.maturity_multiplier) })),
        el('div', null, el('span', { text: 'Breadth (' + (row.chains || []).length + ' chains)' }), el('b', { class: 'num', text: fmtMult(row.breadth_multiplier) })),
        el('div', null, el('span', { text: 'Implied value' }), el('b', { class: 'num', text: fmtUsd(row.implied_value_usd) }))
      ),
      el('p', { class: 'sub', text: 'The page recomputes this row as ' + fmtUsd(recomputed) + (recomputed === row.implied_value_usd ? ' \u2014 the same number board.json carries.' : ' \u2014 which differs from the board, so the data would be stale.') + ' An estimate of what a launch could be worth if the record held, not a price and not a prediction that a token will be issued.' })
    ));
    dialog.appendChild(el('section', { class: 'detail-section' },
      el('h3', { text: 'Farm plan' }),
      el('ol', { class: 'steps' }, row.farm_steps.map(function (s) {
        var at = s.indexOf(' Cost: ');
        var action = at >= 0 ? s.slice(0, at) : s;
        var tail = at >= 0 ? s.slice(at + 1) : '';
        return el('li', null, el('b', { text: action }), el('span', { class: 'cost', text: tail }));
      })),
      el('p', { class: 'risk', text: 'Farming is a bet, not a yield promise: a protocol may never issue a token, points may be worth nothing, and smart-contract and bridge risk sit with the position for the whole hold. Size every position as money you can leave there and afford to lose.' })
    ));
    if (typeof dialog.showModal === 'function') {
      if (!dialog.open) dialog.showModal();
    } else {
      dialog.setAttribute('open', '');
    }
  }

  function render() {
    app.textContent = '';
    var shell = el('div', { class: 'shell' });
    shell.appendChild(header());
    shell.appendChild(lede());
    shell.appendChild(controls());
    shell.appendChild(state.tab === 'pre-token' ? boardTable() : liveTable());
    if (state.tab === 'pre-token') {
      shell.appendChild(modelPanel());
      shell.appendChild(peersPanel());
    }
    shell.appendChild(el('footer', { text: 'Source: ' + DATA.source + '. Snapshot sealed: the page runs offline and every figure on it comes from that one file. Implied values are this entry\u2019s model (' + DATA.model_version + '), not make.fun\u2019s and not financial advice.' }));
    app.appendChild(shell);
    app.setAttribute('aria-busy', 'false');
    if (!dialog.isConnected) app.appendChild(dialog);
    if (state.selected) openDetail(state.selected);
  }

  readHash();
  render();
  window.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && dialog.open) dialog.close();
  });
})();
