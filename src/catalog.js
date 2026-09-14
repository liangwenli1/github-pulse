export const TYPES = ['skill', 'plugin', 'components', 'website', 'github-repo'];
export const TYPE_META = {
  skill: { zh: 'Skill', en: 'Skills' },
  plugin: { zh: '插件 / MCP', en: 'Plugins' },
  components: { zh: '组件', en: 'Components' },
  website: { zh: '网站', en: 'Websites' },
  'github-repo': { zh: '仓库', en: 'Repositories' }
};
export const ASSET_BOARDS = {
  hot: ['近期热门', 'Trending now'],
  rising: ['升得最快', 'Fastest rising'],
  new: ['新秀', 'Newcomers'],
  official: ['官方', 'Official'],
  stars: ['关注最多', 'Most starred']
};
export const REPO_BOARDS = {
  hot: ['近期热门', 'Trending now'],
  rising: ['升星最快', 'Fastest rising'],
  new: ['新秀项目', 'Newcomers'],
  ai: ['AI 热门', 'AI & agents'],
  topics: ['语言 / 主题', 'Language & topics'],
  stars: ['总星数', 'All-time stars'],
  forks: ['Fork 最多', 'Most forked']
};
export const boardNames = type => type === 'github-repo' ? REPO_BOARDS : ASSET_BOARDS;
export const typeLabel = (type, l) => (TYPE_META[type] || TYPE_META['github-repo'])[l === 'zh' ? 'zh' : 'en'];
export const itemPath = (l, type, id) => `/${l}/${type}/${encodeURI(String(id))}`;
export const typePath = (l, type, page = '', query = '') => {
  const suffix = page ? `/${page}` : '';
  return `/${l}/${type}${suffix}${query ? `?${query}` : ''}`;
};
