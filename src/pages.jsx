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

function HomeIcon({ name }) {
  const p = { viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', strokeWidth: '1.7', strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true };
  if (name === 'skill') return <svg {...p}><path d="M13 2 4 14h7l-1 8 9-12h-7l1-8z" /></svg>;
  if (name === 'plugin') return <svg {...p}><rect x="3" y="8" width="13" height="11" rx="2" /><path d="M8 8V5M12 8V5M16 13h4M20 11v4" /></svg>;
  if (name === 'agent') return <svg {...p}><rect x="5" y="8" width="14" height="11" rx="3" /><circle cx="9.5" cy="13.5" r="1" fill="currentColor" stroke="none" /><circle cx="14.5" cy="13.5" r="1" fill="currentColor" stroke="none" /><path d="M12 8V4M9 4h6" /></svg>;
  if (name === 'components') return <svg {...p}><rect x="3" y="3" width="8" height="8" rx="1" /><rect x="13" y="3" width="8" height="8" rx="1" /><rect x="3" y="13" width="8" height="8" rx="1" /><rect x="13" y="13" width="8" height="8" rx="1" /></svg>;
  if (name === 'website') return <svg {...p}><circle cx="12" cy="12" r="9" /><path d="M3 12h18M12 3a15 15 0 0 1 0 18M12 3a15 15 0 0 0 0 18" /></svg>;
  if (name === 'github-repo') return <svg {...p}><circle cx="6" cy="6" r="2.2" /><circle cx="6" cy="18" r="2.2" /><circle cx="18" cy="12" r="2.2" /><path d="M8 7.2c2.4 2 2.4 7.6 0 9.6M8.2 6h5.2a4.6 4.6 0 0 1 4.6 5" /></svg>;
  if (name === 'dup') return <svg {...p}><rect x="8" y="8" width="12" height="12" rx="1.5" /><path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8a2 2 0 0 0 2 2h2" /></svg>;
  if (name === 'official') return <svg {...p}><path d="M12 3 4.5 6.5v5.2c0 5 3.4 7.8 7.5 9.3 4.1-1.5 7.5-4.3 7.5-9.3V6.5L12 3z" /><path d="m8.8 12 2.2 2.2 4.4-4.4" /></svg>;
  if (name === 'choose') return <svg {...p}><path d="M9 6h12M9 12h12M9 18h8" /><path d="M4 6h.01M4 12h.01M4 18h.01" /></svg>;
  if (name === 'pulse') return <svg {...p}><path d="M3 12h4l2.5-6 4 12 2.5-6H21" /></svg>;
  if (name === 'trending') return <svg {...p}><path d="M3 17 10 10l4 4 7-7" /><path d="M14 7h7v7" /></svg>;
  if (name === 'rank') return <svg {...p}><path d="M8 6h13M8 12h13M8 18h9" /><path d="M4 6V5M4 12v-1M4 18v-1" /></svg>;
  if (name === 'charts') return <svg {...p}><path d="M4 19V9M10 19V5M16 19v-7M22 19H2" /></svg>;
  return null;
}

const TYPE_BLURB = {
  skill: { zh: '可复用的指令与工作流。', en: 'Reusable instructions and workflows.' },
  plugin: { zh: '编辑器插件和 MCP 服务。', en: 'Editor plugins and MCP servers.' },
  agent: { zh: '能实际跑起来的 Agent。', en: 'Agents people are actually running.' },
  components: { zh: 'UI 组件与 registry。', en: 'UI primitives and registries.' },
  website: { zh: '开源工具站与目录。', en: 'Open-source tools and directories.' },
  'github-repo': { zh: '仓库近窗口热度，不是总榜。', en: 'Repos moving now, not the all-time list.' }
};

export function TypeHome({ l, t, navigate }) {
  const [data, setData] = useState(null);
  const zh = l === 'zh';
  useEffect(() => { api('/api/types').then(setData).catch(() => setData({ types: TYPES.map(id => ({ id, ...TYPE_META[id], count: 0 })) })); }, []);
  useEffect(() => {
    const nodes = document.querySelectorAll('.type-home .home-reveal');
    const io = new IntersectionObserver(entries => {
      entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('is-in'); });
    }, { threshold: 0.12, rootMargin: '0px 0px -6% 0px' });
    nodes.forEach(n => io.observe(n));
    return () => io.disconnect();
  }, [data]);
  const types = data?.types?.length ? data.types : TYPES.map(id => ({ id, ...TYPE_META[id], count: 0 }));
  const total = types.reduce((sum, x) => sum + (x.count || 0), 0);
  const max = Math.max(1, ...types.map(x => x.count || 0));
  const go = (path) => e => { e.preventDefault(); navigate(e, path); };
  return (
    <main className="page-shell type-home">
      <section className="hero is-active" id="intro">
        <div className="hero-intro">
          <p className="eyebrow">Trend Top</p>
          <h1>{zh ? <>同类太多时，<br />看正在涨的前几名。</> : <>When a category is crowded,<br />start with what is moving.</>}</h1>
          <p className="hero-copy">{zh
            ? '开源 Skill、插件、Agent、组件、网站和仓库每天都在迭代。目录里已经能搜到，痛点是重复多、官方难辨、不知道这一类该看哪几个。'
            : 'Open-source skills, plugins, agents, components, sites, and repos change every day. You can already find them. The hard part is duplicates, unofficial copies, and too many options.'}</p>
          <p className="hero-copy">{zh
            ? 'Trend Top 按类型给出 Trending、排行、图表和官方标记。推荐是一组选项，选哪个由你。'
            : 'Trend Top ranks each type with Trending, rankings, charts, and official marks. Recommendations are a set of options. You choose.'}</p>
          <div className="hero-actions">
            <a className="primary" href="#types">{zh ? '从类型开始' : 'Start with a type'}</a>
            <a className="secondary-link" href={`/${l}/method`} onClick={go(`/${l}/method`)}>{zh ? '关于方法' : 'How it works'}</a>
          </div>
        </div>
        <div className="hero-data home-hero-panel">
          <div className="data-status">{data?.source === 'demo' ? t.demo : data ? t.live : t.loading}</div>
          <div className="hero-stat"><b>{fmt(total, l)}</b><span>{zh ? '六类收录' : 'Across six types'}</span></div>
          <div className="home-bars" aria-hidden="true">
            {types.map((item, i) => (
              <div className="home-bar-row" key={item.id} style={{ '--i': i, '--w': `${18 + ((item.count || 0) / max) * 82}%` }}>
                <span>{item[zh ? 'zh' : 'en']}</span>
                <b><i /></b>
              </div>
            ))}
          </div>
          <p>{t.sample}</p>
        </div>
      </section>

      <section className="home-pitch home-reveal" aria-labelledby="home-pitch-title">
        <div className="visuals-heading">
          <div>
            <h2 id="home-pitch-title">{zh ? '不是又一个目录' : 'Not another directory'}</h2>
            <p>{zh ? '能搜到不够。站要解决的是噪音、官方和选择权。' : 'Being searchable is not enough. The site is for noise, official sources, and choice.'}</p>
          </div>
        </div>
        <div className="home-pitch-grid">
          {[
            { icon: 'dup', zh: ['太多重复', '同名 Skill、换皮插件收进同类。先看一组，而不是刷一百条。'], en: ['Too many lookalikes', 'Same-name skills and reskins are clustered. See a set, not a hundred rows.'] },
            { icon: 'official', zh: ['分得清官方', '厂商源和社区仿写分开标。官方是事实，不是我们替你锁死的赢家。'], en: ['Official is marked', 'Vendor sources and copies are labelled. Official is a fact, not a winner we picked.'] },
            { icon: 'choose', zh: ['每类前几名', '推荐默认 2–4 个选项，写清差异。选哪个由你。'], en: ['A short top set', 'Recommendations are two to four options, with the differences written out. You choose.'] },
            { icon: 'pulse', zh: ['每天都在变', 'Trending、排行和图表跟名次走。订阅把变动推过来。'], en: ['It moves every day', 'Trending, rankings, and charts follow the rank. Subscribe for the shifts.'] }
          ].map(card => (
            <article className="home-pitch-card" key={card.icon}>
              <span className="home-icon-wrap"><HomeIcon name={card.icon} /></span>
              <h3>{zh ? card.zh[0] : card.en[0]}</h3>
              <p>{zh ? card.zh[1] : card.en[1]}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="home-views home-reveal" aria-labelledby="home-views-title">
        <div className="visuals-heading">
          <div>
            <h2 id="home-views-title">{zh ? '每一类都这样看' : 'Every type works the same way'}</h2>
            <p>{zh ? '先选类型，再选 Trending、排行、图表或官方。' : 'Pick a type, then Trending, Rankings, Charts, or Official.'}</p>
          </div>
        </div>
        <div className="home-view-grid">
          {[
            { icon: 'trending', name: 'Trending', zh: '近窗口里正在涨的。', en: 'What is rising in this window.' },
            { icon: 'rank', name: zh ? '排行' : 'Rankings', zh: '完整名次、筛选和对比。', en: 'Full ranks, filters, and compare.' },
            { icon: 'charts', name: zh ? '图表' : 'Charts', zh: '曲线和对照，看谁在超车。', en: 'Curves and comparisons. Who is overtaking.' },
            { icon: 'official', name: zh ? '官方' : 'Official', zh: '只看有官方标记的来源。', en: 'Official sources only.' }
          ].map(view => (
            <article className="home-view-card" key={view.icon}>
              <span className="home-icon-wrap"><HomeIcon name={view.icon} /></span>
              <h3>{view.name}</h3>
              <p>{zh ? view.zh : view.en}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="home-types home-reveal" id="types">
        <div className="visuals-heading">
          <div>
            <h2>{zh ? '从类型开始' : 'Start with a type'}</h2>
            <p>{zh ? '六类分开排。点进去就是这一类的 Trending。' : 'Six types, ranked separately. Open one to land on its Trending view.'}</p>
          </div>
        </div>
        <div className="type-card-grid">
          {types.map(item => (
            <article className="type-card" key={item.id}>
              <div className="type-card-top">
                <span className="home-icon-wrap"><HomeIcon name={item.id} /></span>
                <span className="data-badge">{fmt(item.count, l)}</span>
              </div>
              <h3><a href={typePath(l, item.id)} onClick={go(typePath(l, item.id))}>{item[zh ? 'zh' : 'en']}</a></h3>
              <p className="type-card-copy">{(TYPE_BLURB[item.id] || TYPE_BLURB['github-repo'])[zh ? 'zh' : 'en']}</p>
              <div className="type-card-links">
                <a href={typePath(l, item.id)} onClick={go(typePath(l, item.id))}>Trending</a>
                <a href={typePath(l, item.id, 'ranking')} onClick={go(typePath(l, item.id, 'ranking'))}>{zh ? '排行' : 'Rankings'}</a>
                <a href={typePath(l, item.id, 'charts')} onClick={go(typePath(l, item.id, 'charts'))}>{zh ? '图表' : 'Charts'}</a>
                <a href={typePath(l, item.id, 'official')} onClick={go(typePath(l, item.id, 'official'))}>{zh ? '官方' : 'Official'}</a>
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
