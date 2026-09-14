import React, { useEffect, useState } from 'react';
import { BoardTabs } from './components.jsx';
import { TYPES, TYPE_META, typeLabel, typePath, itemPath } from './catalog.js';

const fmt = (n, l) => n === null || n === undefined ? '—' : new Intl.NumberFormat(l === 'zh' ? 'zh-CN' : 'en-US').format(n);
const api = (url) => fetch(url).then(async r => { const j = await r.json(); if (!r.ok) throw new Error(j.error || 'Request failed'); return j; });

export function TypeBar({ l, type, navigate }) {
  return (
    <nav className="type-bar" aria-label={l === 'zh' ? '资产类型' : 'Asset types'}>
      {TYPES.map(id => (
        <a
          key={id}
          className="type-bar-link"
          href={typePath(l, id)}
          aria-current={type === id ? 'page' : undefined}
          onClick={e => navigate(e, typePath(l, id))}
        >
          {TYPE_META[id][l === 'zh' ? 'zh' : 'en']}
        </a>
      ))}
    </nav>
  );
}

export function TypeSubnav({ l, type, page, query, navigate }) {
  const items = [
    { id: 'trending', href: typePath(l, type), label: l === 'zh' ? 'Trending' : 'Trending' },
    { id: 'ranking', href: typePath(l, type, 'ranking', query), label: l === 'zh' ? '排行' : 'Rankings' },
    { id: 'charts', href: typePath(l, type, 'charts', query), label: l === 'zh' ? '图表' : 'Charts' },
    { id: 'official', href: typePath(l, type, 'official', query), label: l === 'zh' ? '官方' : 'Official' }
  ];
  return (
    <BoardTabs
      value={['trending', 'ranking', 'charts', 'official'].includes(page) ? page : 'trending'}
      onChange={id => {
        const target = items.find(x => x.id === id);
        if (target) navigate({ preventDefault() {}, button: 0 }, target.href.split('?')[0], target.href.split('?')[1] || '');
      }}
      label={l === 'zh' ? '视图' : 'Views'}
      items={items.map(x => ({ id: x.id, label: x.label }))}
    />
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
          <h1>{l === 'zh' ? <>发现 skill、插件、组件<br />与开源仓库。</> : 'Find skills, plugins, components, and repos.'}</h1>
          <p className="hero-copy">{l === 'zh' ? '同类太多时，看排行、图表和一组可选项。官方与重复会标出来，选哪个由你决定。' : 'When a category is crowded, use rankings, charts, and a short set of options. Official and duplicate marks are facts. You choose.'}</p>
        </div>
        <div className="hero-data">
          <div className="data-status">{data?.source === 'demo' ? t.demo : t.live}</div>
          <div className="hero-stat"><b>{fmt(types.reduce((sum, x) => sum + (x.count || 0), 0), l)}</b><span>{l === 'zh' ? '收录条目' : 'Tracked items'}</span></div>
          <p>{t.sample}</p>
        </div>
      </section>
      <section className="charts-scene type-home-grid" id="types">
        <div className="visuals-heading"><div><h2>{l === 'zh' ? '从类型开始' : 'Start with a type'}</h2><p>{l === 'zh' ? '每一类都有 Trending、排行和图表。' : 'Each type has Trending, rankings, and charts.'}</p></div></div>
        <div className="chart-grid type-card-grid">
          {types.map(item => (
            <article className="chart-card type-card" key={item.id}>
              <div className="chart-card-head"><h3>{item[l === 'zh' ? 'zh' : 'en']}</h3><span className="data-badge">{fmt(item.count, l)}</span></div>
              <p className="type-card-copy">{l === 'zh' ? '前几名、官方标记、同类重复，自己选。' : 'Top results, official marks, and duplicates — you pick.'}</p>
              <div className="type-card-links">
                <a href={typePath(l, item.id)} onClick={e => navigate(e, typePath(l, item.id))}>Trending</a>
                <a href={typePath(l, item.id, 'ranking')} onClick={e => navigate(e, typePath(l, item.id, 'ranking'))}>{l === 'zh' ? '排行' : 'Rankings'}</a>
                <a href={typePath(l, item.id, 'charts')} onClick={e => navigate(e, typePath(l, item.id, 'charts'))}>{l === 'zh' ? '图表' : 'Charts'}</a>
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
      <p className="eyebrow">{typeLabel(type, l)}</p>
      <h1>{label}</h1>
      <p className="method-intro">{l === 'zh' ? '下面是一组选项，不是唯一答案。完整排行在推荐下面。' : 'A set of options, not a single answer. The full ranking follows.'}</p>
      <div className="method-grid recommend-grid">
        {(data.recommend || []).map(item => (
          <article key={item.id}>
            <h2>{item.recommendRank}. {item.full_name}</h2>
            <p>{(l === 'zh' ? item.recommendNote?.zh : item.recommendNote?.en) || item.description}</p>
            <a className="rail-link" href={itemPath(l, type, item.slug || item.id)} onClick={e => { e.preventDefault(); navigate(e, itemPath(l, type, item.slug || item.id)); }}>{l === 'zh' ? '查看详情' : 'Open details'} ↗</a>
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
                <div className="repo-tags">
                  {item.official && <span>Official</span>}
                  {item.similarCount > 0 && <span>+{item.similarCount} similar</span>}
                  {(item.topics || []).slice(0, 3).map(x => <span key={x}>{x}</span>)}
                </div>
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
  return (
    <main className="simple-page method-page">
      <p className="eyebrow">{typeLabel(type, l)}</p>
      <h1>{l === 'zh' ? '对比' : 'Compare'}</h1>
      <p className="method-intro">{l === 'zh' ? '并排看事实，选哪个由你决定。最多三条。' : 'Facts side by side. You choose. Up to three items.'}</p>
      {items.length < 2 ? <p>{l === 'zh' ? '请从排行勾选 2～3 条再对比。' : 'Pick 2–3 items from a ranking first.'}</p> : (
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

export function SearchPage({ l, t, q, navigate }) {
  const [query, setQuery] = useState(q || '');
  const [data, setData] = useState(null);
  useEffect(() => {
    if (!query) { setData({ items: [] }); return; }
    api(`/api/search?q=${encodeURIComponent(query)}`).then(setData).catch(() => setData({ items: [] }));
  }, [query]);
  return (
    <main className="simple-page">
      <h1>{l === 'zh' ? '搜索' : 'Search'}</h1>
      <form className="subscribe-form" onSubmit={e => { e.preventDefault(); navigate({ preventDefault() {}, button: 0 }, `/${l}/search`, `q=${encodeURIComponent(query)}`); }}>
        <div className="field"><label htmlFor="global-search">{t.search}</label><input id="global-search" value={query} onChange={e => setQuery(e.target.value)} placeholder={t.searchHint} /></div>
      </form>
      <div className="repo-list" style={{ marginTop: 32 }}>
        {(data?.items || []).map(item => (
          <article className="repo-row" key={`${item.type}-${item.id}`}>
            <div className="repo-identity">
              <span className="rank-num"></span>
              <div>
                <a className="repo-name" href={itemPath(l, item.type, item.slug || item.id)} onClick={e => { e.preventDefault(); navigate(e, itemPath(l, item.type, item.slug || item.id)); }}>{item.full_name}</a>
                <p>{item.description}</p>
                <div className="repo-tags"><span>{typeLabel(item.type, l)}</span>{item.official && <span>Official</span>}</div>
              </div>
            </div>
          </article>
        ))}
      </div>
      {data && !data.items?.length && query && <p className="state">{t.empty}</p>}
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
      <a href={typePath(l, type, 'ranking')} onClick={e => { e.preventDefault(); navigate(e, typePath(l, type, 'ranking')); }}>← {t.list}</a>
      <p className="eyebrow">{item.mode === 'demo' ? t.demo : t.live} · {typeLabel(type, l)}</p>
      <h1>{item.full_name}</h1>
      <p className="detail-description">{item.description}</p>
      <div className="repo-tags">
        {item.official && <span>Official</span>}
        {item.category && <a href={typePath(l, type, `c/${item.category}`)} onClick={e => { e.preventDefault(); navigate(e, typePath(l, type, `c/${item.category}`)); }}>{item.categoryLabel?.[l === 'zh' ? 'zh' : 'en'] || item.category}</a>}
        {(item.topics || []).slice(0, 6).map(x => <span key={x}>{x}</span>)}
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
