import React, { useEffect, useState } from 'react';
import { TYPES, TYPE_META, typeLabel, typePath, itemPath, trendingCopy } from './catalog.js';

const fmt = (n, l) => n === null || n === undefined ? '—' : new Intl.NumberFormat(l === 'zh' ? 'zh-CN' : 'en-US').format(n);
const api = (url) => fetch(url).then(async r => { const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Request failed'); return j; });

function preservedView(page) {
  if (page === 'charts') return 'charts';
  if (page === 'official') return 'official';
  if (page === 'trending') return '';
  return 'ranking';
}

export function TagActions({ l, type, item, navigate, showMeta = false }) {
  const id = String(item.slug || item.id);
  const categoryHref = item.category ? typePath(l, type, `c/${item.category}`) : '';
  const compareQuery = `ids=${encodeURIComponent(id)}`;
  const categoryLabel = item.categoryLabel?.[l === 'zh' ? 'zh' : 'en'] || item.category;
  const go = (href, query) => e => { e.preventDefault(); navigate(e, href, query); };
  return (
    <div className="repo-tags">
      {item.official && <span>Official</span>}
      {item.similarCount > 0 && categoryHref && (
        <a className="tag-btn" href={categoryHref} onClick={go(categoryHref)}>+{item.similarCount} similar</a>
      )}
      {item.category && categoryHref && (
        <a className="tag-btn" href={categoryHref} onClick={go(categoryHref)}>{categoryLabel}</a>
      )}
      {showMeta && item.language && <span>{item.language}</span>}
      {showMeta && (item.topics || []).slice(0, 2).map(x => <span key={x}>{x}</span>)}
      <a className="tag-btn tag-btn-action" href={typePath(l, type, 'compare', compareQuery)} onClick={go(typePath(l, type, 'compare'), compareQuery)}>
        {l === 'zh' ? '对比同类' : 'Compare'}
      </a>
    </div>
  );
}

export function BackBtn({ href, onClick, children }) {
  return <a className="back-btn" href={href} onClick={onClick}>{children}</a>;
}

function TypeSwitcher({ l, type, page, query = '', navigate }) {
  const [open, setOpen] = useState(false);
  const view = preservedView(page);
  const q = query;
  useEffect(() => {
    if (!open) return;
    const close = e => { if (!e.target.closest('.type-switch')) setOpen(false); };
    addEventListener('mousedown', close);
    return () => removeEventListener('mousedown', close);
  }, [open]);
  return (
    <div className="type-switch">
      <button type="button" className="type-switch-btn" aria-expanded={open} aria-haspopup="listbox" onClick={() => setOpen(v => !v)}>
        {typeLabel(type, l)} <span aria-hidden="true">▾</span>
      </button>
      {open && (
        <ul className="type-switch-menu" role="listbox">
          {TYPES.map(id => (
            <li key={id} role="option" aria-selected={id === type}>
              <a
                href={typePath(l, id, view, q)}
                aria-current={id === type ? 'page' : undefined}
                onClick={e => { setOpen(false); navigate(e, typePath(l, id, view), q); }}
              >
                {TYPE_META[id][l === 'zh' ? 'zh' : 'en']}
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ViewBar({ l, type, page, query = '', navigate }) {
  if (!type) return null;
  const current = page === 'charts' ? 'charts' : page === 'trending' ? 'trending' : page === 'official' ? 'official' : 'ranking';
  const views = [
    { id: 'trending', href: typePath(l, type), label: 'Trending' },
    { id: 'ranking', href: typePath(l, type, 'ranking', query), label: l === 'zh' ? '排行' : 'Rankings' },
    { id: 'charts', href: typePath(l, type, 'charts', query), label: l === 'zh' ? '图表' : 'Charts' },
    { id: 'official', href: typePath(l, type, 'official'), label: l === 'zh' ? '官方' : 'Official' }
  ];
  return (
    <nav className="view-bar" aria-label={l === 'zh' ? '类型与视图' : 'Type and views'}>
      <TypeSwitcher l={l} type={type} page={page} query={current === 'trending' || current === 'official' ? '' : query} navigate={navigate} />
      <div className="view-bar-tabs">
        {views.map(item => (
          <a
            key={item.id}
            className="view-bar-link"
            href={item.href}
            aria-current={current === item.id ? 'page' : undefined}
            onClick={e => {
              const [pathOnly, q] = item.href.split('?');
              navigate(e, pathOnly, q || '');
            }}
          >
            {item.label}
          </a>
        ))}
      </div>
    </nav>
  );
}

export function TypeTrending({ l, t, type, navigate }) {
  const copy = trendingCopy(type, l);
  const [period, setPeriod] = useState('day');
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    setLoading(true);
    setError('');
    api(`/api/${type}/rankings?board=hot&period=${period}&limit=12`).then(setData).catch(e => setError(e.message)).finally(() => setLoading(false));
  }, [type, period]);
  const items = data?.items || [];
  const featured = items.slice(0, 3);
  const rest = items.slice(3);
  return (
    <main className="page-shell trending-page">
      <header className="trending-lead">
        <div>
          <p className="eyebrow">{typeLabel(type, l)} · Trending</p>
          <h1>{copy.title}</h1>
          <p className="hero-copy">{copy.sub}</p>
        </div>
        <div className="trending-lead-meta">
          <div className="data-status">{loading ? t.loading : data?.source === 'demo' ? t.demo : t.live}</div>
          <div className="hero-stat"><b>{fmt(data?.total, l)}</b><span>{typeLabel(type, l)}</span></div>
        </div>
      </header>
      <div className="trending-periods" role="tablist" aria-label={t.period}>
        {['day', 'week', 'month'].map(id => (
          <button key={id} type="button" className={period === id ? 'is-active' : ''} onClick={() => setPeriod(id)}>{t[id]}</button>
        ))}
      </div>
      {loading ? <div className="skeletons" aria-label={t.loading}>{[1, 2, 3].map(x => <div key={x} />)}</div> : error ? <div className="state"><p>{t.error}</p></div> : !featured.length ? <div className="state">{data?.dataInsufficient ? t.insufficient : t.empty}</div> : (
        <>
          <section className="trending-featured" aria-label={l === 'zh' ? '近窗口前三' : 'Top movers'}>
            {featured.map(item => {
              const id = String(item.slug || item.id);
              return (
                <article className="trending-card" key={item.id}>
                  <span className="rank-num">{String(item.rank).padStart(2, '0')}</span>
                  <a className="repo-name" href={itemPath(l, type, id)} onClick={e => { e.preventDefault(); navigate(e, itemPath(l, type, id)); }}>{item.full_name} <span>↗</span></a>
                  <p>{item.description || '—'}</p>
                  <div className="trending-card-metrics">
                    <div><small>{t.gain}</small><strong className="positive">{item.gain == null ? t.insufficient : `+${fmt(item.gain, l)}`}</strong></div>
                    <div><small>{t.score}</small><strong>{fmt(item.score, l)}</strong></div>
                    <div><small>{t.stars}</small><strong>{fmt(item.stars, l)}</strong></div>
                  </div>
                  <TagActions l={l} type={type} item={item} navigate={navigate} />
                </article>
              );
            })}
          </section>
          {rest.length > 0 && (
            <section className="trending-rest">
              <div className="section-heading"><div><h2>{l === 'zh' ? '同样在动' : 'Also moving'}</h2><p>{l === 'zh' ? '完整排行和筛选在 Rankings。' : 'Full filters live on Rankings.'}</p></div>
                <a className="hero-ranking-link" href={typePath(l, type, 'ranking')} onClick={e => navigate(e, typePath(l, type, 'ranking'))}>{l === 'zh' ? '查看排行' : 'Open rankings'}</a>
              </div>
              <div className="repo-list">
                {rest.map(item => {
                  const id = String(item.slug || item.id);
                  return (
                    <article className="repo-row" key={item.id}>
                      <div className="repo-identity">
                        <span className="rank-num">{String(item.rank).padStart(2, '0')}</span>
                        <div>
                          <a className="repo-name" href={itemPath(l, type, id)} onClick={e => { e.preventDefault(); navigate(e, itemPath(l, type, id)); }}>{item.full_name} <span>↗</span></a>
                          <p>{item.description || '—'}</p>
                          <TagActions l={l} type={type} item={item} navigate={navigate} />
                        </div>
                      </div>
                      <div className="metric primary-metric"><small>{t.gain}</small><strong className={item.gain != null ? 'positive' : ''}>{item.gain == null ? t.insufficient : `+${fmt(item.gain, l)}`}</strong></div>
                    </article>
                  );
                })}
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}

export function TypeHome({ l, t, navigate }) {
  const [data, setData] = useState(null);
  useEffect(() => { api('/api/types').then(setData).catch(() => setData({ types: TYPES.map(id => ({ id, ...TYPE_META[id], count: 0 })) })); }, []);
  const types = data?.types || [];
  return (
    <main className="page-shell type-home">
      <section className="hero" id="intro">
        <div className="hero-intro">
          <h1>{l === 'zh' ? <>发现 skill、插件、Agent<br />组件与开源仓库。</> : 'Find skills, plugins, agents, components, and repos.'}</h1>
          <p className="hero-copy">{l === 'zh' ? '同类太多时，看排行、图表和一组可选项。官方与重复会标出来，选哪个由你决定。' : 'When a category is crowded, use rankings, charts, and a short set of options. Official and duplicate marks are facts. You choose.'}</p>
        </div>
        <div className="hero-data">
          <div className="data-status">{data?.source === 'demo' ? t.demo : t.live}</div>
          <div className="hero-stat"><b>{fmt(types.reduce((sum, x) => sum + (x.count || 0), 0), l)}</b><span>{l === 'zh' ? '收录条目' : 'Tracked items'}</span></div>
          <p>{t.sample}</p>
        </div>
      </section>
      <section className="charts-scene type-home-grid" id="types">
        <div className="visuals-heading"><div><h2>{l === 'zh' ? '从类型开始' : 'Start with a type'}</h2><p>{l === 'zh' ? '每一类都有 Trending、排行、图表和官方。' : 'Each type has Trending, rankings, charts, and Official.'}</p></div></div>
        <div className="chart-grid type-card-grid">
          {types.map(item => (
            <article className="chart-card type-card" key={item.id}>
              <div className="chart-card-head"><h3><a href={typePath(l, item.id)} onClick={e => navigate(e, typePath(l, item.id))}>{item[l === 'zh' ? 'zh' : 'en']}</a></h3><span className="data-badge">{fmt(item.count, l)}</span></div>
              <p className="type-card-copy">{l === 'zh' ? '前几名、官方标记、同类重复，自己选。' : 'Top results, official marks, and duplicates — you pick.'}</p>
              <div className="type-card-links">
                <a href={typePath(l, item.id)} onClick={e => navigate(e, typePath(l, item.id))}>Trending</a>
                <a href={typePath(l, item.id, 'ranking')} onClick={e => navigate(e, typePath(l, item.id, 'ranking'))}>{l === 'zh' ? '排行' : 'Rankings'}</a>
                <a href={typePath(l, item.id, 'charts')} onClick={e => navigate(e, typePath(l, item.id, 'charts'))}>{l === 'zh' ? '图表' : 'Charts'}</a>
                <a href={typePath(l, item.id, 'official')} onClick={e => navigate(e, typePath(l, item.id, 'official'))}>{l === 'zh' ? '官方' : 'Official'}</a>
              </div>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}

export function CategoryPage({ l, t, type, category, navigate }) {
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  useEffect(() => {
    api(`/api/${type}/categories/${encodeURIComponent(category)}`).then(setData).catch(e => setError(e.message));
  }, [type, category]);
  if (!data && !error) return <main className="simple-page">{t.loading}</main>;
  if (error) return <main className="simple-page">{t.error}</main>;
  const label = data.label?.[l === 'zh' ? 'zh' : 'en'] || category;
  return (
    <main className="simple-page method-page">
      <BackBtn href={typePath(l, type, 'ranking')} onClick={e => { e.preventDefault(); navigate(e, typePath(l, type, 'ranking')); }}>{l === 'zh' ? '← 返回排行' : '← Back to rankings'}</BackBtn>
      <p className="eyebrow">{typeLabel(type, l)}</p>
      <h1>{label}</h1>
      <p className="method-intro">{l === 'zh' ? '下面是一组选项，不是唯一答案。完整排行在推荐下面。' : 'A set of options, not a single answer. The full ranking follows.'}</p>
      <div className="method-grid recommend-grid">
        {(data.recommend || []).map(item => (
          <article key={item.id}>
            <h2>{item.recommendRank}. {item.full_name}</h2>
            <p>{(l === 'zh' ? item.recommendNote?.zh : item.recommendNote?.en) || item.description}</p>
            <a className="tag-btn tag-btn-action" href={typePath(l, type, 'compare', `ids=${encodeURIComponent(item.slug || item.id)}`)} onClick={e => { e.preventDefault(); navigate(e, typePath(l, type, 'compare'), `ids=${encodeURIComponent(item.slug || item.id)}`); }}>{l === 'zh' ? '对比同类' : 'Compare'}</a>
          </article>
        ))}
      </div>
      {!data.recommend?.length && <p>{l === 'zh' ? '这一类暂无单独推荐组，请看完整排行。' : 'No recommended set yet. Use the full ranking.'}</p>}
      <div className="section-heading" style={{ marginTop: 48 }}><div><h2>{l === 'zh' ? '完整排行' : 'Full ranking'}</h2></div></div>
      <div className="repo-list">
        {(data.ranking?.items || []).map(item => (
          <article className="repo-row" key={item.id}>
            <div className="repo-identity">
              <span className="rank-num">{String(item.rank).padStart(2, '0')}</span>
              <div>
                <a className="repo-name" href={itemPath(l, type, item.slug || item.id)} onClick={e => { e.preventDefault(); navigate(e, itemPath(l, type, item.slug || item.id)); }}>{item.full_name}</a>
                <p>{item.description}</p>
                <TagActions l={l} type={type} item={item} navigate={navigate} />
              </div>
            </div>
            <div className="metric primary-metric"><small>{t.gain}</small><strong>{item.gain == null ? t.insufficient : `+${fmt(item.gain, l)}`}</strong></div>
          </article>
        ))}
      </div>
    </main>
  );
}

export function ComparePage({ l, t, type, ids, navigate }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    api(`/api/${type}/compare?ids=${encodeURIComponent(ids)}`).then(setData).catch(() => setData({ items: [] }));
  }, [type, ids]);
  if (!data) return <main className="simple-page">{t.loading}</main>;
  const items = data.items || [];
  const fields = [
    ['official', l === 'zh' ? '官方' : 'Official', item => item.official ? (l === 'zh' ? '是' : 'Yes') : (l === 'zh' ? '否' : 'No')],
    ['stars', t.stars, item => fmt(item.stars, l)],
    ['gain', t.gain, item => item.gain == null ? t.insufficient : `+${fmt(item.gain, l)}`],
    ['similar', l === 'zh' ? '同类' : 'Similar', item => fmt(item.similarCount, l)],
    ['push', l === 'zh' ? '距上次更新（天）' : 'Days since update', item => fmt(item.pushDays, l)],
    ['evidence', l === 'zh' ? '官方依据' : 'Official evidence', item => item.officialEvidence || '—']
  ];
  const label = items[0]?.categoryLabel?.[l === 'zh' ? 'zh' : 'en'] || items[0]?.category;
  return (
    <main className="simple-page method-page">
      <BackBtn href={typePath(l, type, 'ranking')} onClick={e => { e.preventDefault(); navigate(e, typePath(l, type, 'ranking')); }}>{l === 'zh' ? '← 返回排行' : '← Back to rankings'}</BackBtn>
      <p className="eyebrow">{typeLabel(type, l)}{label ? ` · ${label}` : ''}</p>
      <h1>{l === 'zh' ? '同类对比' : 'Compare peers'}</h1>
      <p className="method-intro">{l === 'zh' ? '同一类别里并排看事实，选哪个由你决定。最多三条。' : 'Same category, facts side by side. You choose. Up to three items.'}</p>
      {items.length < 2 ? <p>{l === 'zh' ? '这一类还没有可对比的同类。' : 'No peers in this category to compare yet.'}</p> : (
        <div className="compare-table-wrap">
          <table className="compare-table">
            <thead><tr><th></th>{items.map(item => <th key={item.id}><a href={itemPath(l, type, item.slug || item.id)} onClick={e => { e.preventDefault(); navigate(e, itemPath(l, type, item.slug || item.id)); }}>{item.full_name}</a></th>)}</tr></thead>
            <tbody>
              {fields.map(([key, label, render]) => (
                <tr key={key}><th>{label}</th>{items.map(item => <td key={item.id}>{render(item)}</td>)}</tr>
              ))}
              <tr><th>{l === 'zh' ? '推荐语' : 'Note'}</th>{items.map(item => <td key={item.id}>{(l === 'zh' ? item.recommendNote?.zh : item.recommendNote?.en) || '—'}</td>)}</tr>
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

export function HeaderSearch({ l, t, navigate, q = '' }) {
  const [value, setValue] = useState(q);
  useEffect(() => { setValue(q); }, [q]);
  return (
    <form className="header-search" role="search" onSubmit={e => {
      e.preventDefault();
      const next = value.trim();
      if (!next) return;
      navigate({ preventDefault() {}, button: 0 }, `/${l}/search`, `q=${encodeURIComponent(next)}`);
    }}>
      <span aria-hidden="true">⌕</span>
      <input
        type="search"
        value={value}
        onChange={e => setValue(e.target.value)}
        placeholder={l === 'zh' ? '搜索 Skill、插件、Agent、仓库…' : 'Search skills, plugins, agents, repos…'}
        aria-label={l === 'zh' ? '搜索' : 'Search'}
        autoComplete="off"
      />
      {value && <button type="button" className="header-search-clear" aria-label={l === 'zh' ? '清除' : 'Clear'} onClick={() => setValue('')}>×</button>}
    </form>
  );
}

export function SearchPage({ l, t, q, typeFilter = '', navigate }) {
  const [data, setData] = useState(null);
  useEffect(() => {
    if (!q) { setData({ items: [] }); return; }
    const controller = new AbortController();
    const params = new URLSearchParams({ q });
    if (typeFilter) params.set('type', typeFilter);
    fetch(`/api/search?${params}`, { signal: controller.signal })
      .then(async r => { const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Request failed'); return j; })
      .then(setData)
      .catch(e => { if (e.name !== 'AbortError') setData({ items: [] }); });
    return () => controller.abort();
  }, [q, typeFilter]);
  const items = data?.items || [];
  const groups = TYPES.map(id => ({ id, items: items.filter(item => item.type === id) })).filter(group => group.items.length);
  const setFilter = id => navigate({ preventDefault() {}, button: 0 }, `/${l}/search`, `q=${encodeURIComponent(q)}${id ? `&type=${id}` : ''}`);
  return (
    <main className="search-page">
      <BackBtn href={`/${l}/home`} onClick={e => { e.preventDefault(); navigate(e, `/${l}/home`); }}>{l === 'zh' ? '← 返回首页' : '← Back to home'}</BackBtn>
      <div className="search-chips" role="tablist" aria-label={l === 'zh' ? '类型' : 'Types'}>
        <button type="button" className={!typeFilter ? 'is-active' : ''} onClick={() => setFilter('')}>{l === 'zh' ? '全部' : 'All'}</button>
        {TYPES.map(id => (
          <button key={id} type="button" className={typeFilter === id ? 'is-active' : ''} onClick={() => setFilter(id)}>{typeLabel(id, l)}</button>
        ))}
      </div>
      {!q && <p className="search-hint">{l === 'zh' ? '输入后按回车搜索。点 Logo 或「返回首页」可回首页。' : 'Press Enter to search. Use the logo or Back to home to return.'}</p>}
      {q && data && !items.length && <p className="state">{t.empty}</p>}
      {groups.map(group => (
        <section className="search-group" key={group.id}>
          <div className="search-group-head">
            <h2>{typeLabel(group.id, l)}</h2>
            <span>{l === 'zh' ? `${group.items.length} 条` : `${group.items.length} results`}</span>
          </div>
          <div className="search-cards">
            {group.items.map(item => (
              <article className="search-card" key={`${item.type}-${item.id}`}>
                <span className="search-card-kicker">{item.official ? 'Official' : typeLabel(item.type, l)}</span>
                <a className="repo-name" href={itemPath(l, item.type, item.slug || item.id)} onClick={e => { e.preventDefault(); navigate(e, itemPath(l, item.type, item.slug || item.id)); }}>{item.full_name}</a>
                <p>{item.description || '—'}</p>
                <TagActions l={l} type={item.type} item={item} navigate={navigate} />
              </article>
            ))}
          </div>
        </section>
      ))}
    </main>
  );
}

export function ItemDetail({ l, t, type, id, navigate }) {
  const [item, setItem] = useState(null);
  const [msg, setMsg] = useState('');
  useEffect(() => {
    api(`/api/${type}/items/${encodeURIComponent(id)}`).then(setItem).catch(() => setMsg(t.error));
  }, [type, id]);
  if (!item) return <main className="simple-page">{msg || t.loading}</main>;
  const note = l === 'zh' ? item.recommendNote?.zh : item.recommendNote?.en;
  return (
    <main className="simple-page repo-detail">
      <BackBtn href={typePath(l, type, 'ranking')} onClick={e => { e.preventDefault(); navigate(e, typePath(l, type, 'ranking')); }}>{l === 'zh' ? '← 返回排行' : '← Back to rankings'}</BackBtn>
      <p className="eyebrow">{item.mode === 'demo' ? t.demo : t.live} · {typeLabel(type, l)}</p>
      <h1>{item.full_name}</h1>
      <p className="detail-description">{item.description}</p>
      <div className="repo-tags">
        {item.official && <span>Official</span>}
        {item.category && <a className="tag-btn" href={typePath(l, type, `c/${item.category}`)} onClick={e => { e.preventDefault(); navigate(e, typePath(l, type, `c/${item.category}`)); }}>{item.categoryLabel?.[l === 'zh' ? 'zh' : 'en'] || item.category}</a>}
        {(item.topics || []).slice(0, 6).map(x => <span key={x}>{x}</span>)}
        <a className="tag-btn tag-btn-action" href={typePath(l, type, 'compare', `ids=${encodeURIComponent(item.slug || item.id)}`)} onClick={e => { e.preventDefault(); navigate(e, typePath(l, type, 'compare'), `ids=${encodeURIComponent(item.slug || item.id)}`); }}>{l === 'zh' ? '对比同类' : 'Compare'}</a>
      </div>
      {item.officialEvidence && <p>{l === 'zh' ? '官方依据：' : 'Official evidence: '}{item.officialEvidence}</p>}
      {note && <p>{l === 'zh' ? '和相邻选项的差别：' : 'How it differs: '}{note}</p>}
      <div className="detail-metrics">
        <div><small>{t.stars}</small><strong>{fmt(item.stars, l)}</strong></div>
        <div><small>{t.gain}</small><strong>{item.gain == null ? t.insufficient : `+${fmt(item.gain, l)}`}</strong></div>
        <div><small>{t.forks}</small><strong>{fmt(item.forks, l)}</strong></div>
      </div>
      {item.install && <p><code>{item.install}</code></p>}
      {item.url && <a className="primary inline" href={item.url} target="_blank" rel="noopener noreferrer">{type === 'website' ? (l === 'zh' ? '打开网站' : 'Open site') : t.github} ↗</a>}
      {(item.similar || []).length > 0 && (
        <>
          <h2 style={{ marginTop: 48 }}>{l === 'zh' ? `同类 ${item.similarCount} 条` : `${item.similarCount} similar`}</h2>
          <div className="repo-list">
            {item.similar.map(row => (
              <article className="repo-row" key={row.id}>
                <div className="repo-identity">
                  <div>
                    <a className="repo-name" href={itemPath(l, type, row.slug || row.id)} onClick={e => { e.preventDefault(); navigate(e, itemPath(l, type, row.slug || row.id)); }}>{row.full_name}</a>
                    <p>{row.description}</p>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
