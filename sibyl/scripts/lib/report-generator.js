const { formatHeat } = require('./signals');

const STATUS_ICON = {
  new: '🆕',
  rising: '🔥',
  holding: '⏳',
  steady: '👀',
  cooling: '⬇️'
};

const CATEGORY_ICON = {
  游戏: '🕹️',
  电竞: '🎮',
  篮球: '🏀',
  足球: '⚽',
  体育: '🏅'
};

const BASKETBALL_HINTS = /篮球|NBA|CBA|总决赛|季后赛|湖人|勇士|快船|火箭|马刺|尼克斯|詹姆斯|乔丹|科比|霍华德|文班亚马|哈登|库里|杜兰特|东契奇|约基奇|塔图姆|布朗/i;
const FOOTBALL_HINTS = /足球|世界杯|欧冠|英超|西甲|意甲|法甲|德甲|葡萄牙|法国队|阿根廷|巴萨|皇马|曼城|利物浦|梅西|C罗|姆巴佩|哈兰德|利瓦科维奇|亨利/i;

const KNOWN_TOPIC_TERMS = [
  '梅西', 'C罗', '姆巴佩', '哈兰德', '詹姆斯', '乔丹', '科比', '霍华德',
  '文班亚马', 'Faker', 'BLG', 'T1', 'HLE', 'MSI', 'LNG', 'EDG', 'XLG',
  'Missing', '英雄联盟', '王者荣耀', 'NBA', '世界杯'
];

const DEFAULT_BROADCAST_SEED_PLATFORMS = ['weibo', 'douyin'];
const PLATFORM_LABELS = {
  weibo: '微博',
  douyin: '抖音',
  tieba: '贴吧',
  hupu: '虎扑'
};

function formatTime(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  const beijing = new Date(d.getTime() + 8 * 60 * 60 * 1000);
  return beijing.toISOString().replace('T', ' ').slice(0, 16);
}

function formatClock(date = new Date()) {
  return formatTime(date).slice(11, 16);
}

function formatGrowth(cluster) {
  if (cluster.growthRate === null || cluster.growthRate === undefined) return '首次出现';
  const percent = Math.round(cluster.growthRate * 100);
  if (percent > 0) return `比上轮高 ${percent}%`;
  if (percent < 0) return `比上轮低 ${Math.abs(percent)}%`;
  return '和上轮接近';
}

function pickCategory(cluster) {
  return cluster.category || '未分类';
}

function clusterText(cluster) {
  return [
    cluster.mainSignal?.title,
    ...(cluster.keywords || []),
    ...(cluster.signals || []).flatMap(signal => [signal.title, signal.board])
  ].filter(Boolean).join(' ');
}

function visualCategory(cluster) {
  const category = pickCategory(cluster);
  if (category !== '体育') return category;

  const text = clusterText(cluster);
  if (BASKETBALL_HINTS.test(text)) return '篮球';
  if (FOOTBALL_HINTS.test(text)) return '足球';
  return '体育';
}

function categoryIcon(cluster) {
  return CATEGORY_ICON[visualCategory(cluster)] || CATEGORY_ICON[cluster.category] || '▫️';
}

function platformNamesForCluster(cluster) {
  const names = (cluster.signals || [])
    .filter(signal => signal.platform === 'weibo' || signal.platform === 'douyin')
    .map(signal => signal.platformLabel)
    .filter(Boolean);
  const uniqueNames = [...new Set(names)];
  if (uniqueNames.length > 0) return uniqueNames.join('、');
  return [...new Set((cluster.signals || []).map(signal => signal.platformLabel).filter(Boolean))].join('、') || '未知';
}

function explainWhy(cluster) {
  const category = pickCategory(cluster);
  const platformText = platformNamesForCluster(cluster);
  const coverageText = cluster.platformCount > 1 ? '多平台' : '单平台';
  const hitCountText = cluster.previousScore ? '连续命中' : '首次命中';
  return `${platformText}${coverageText}${hitCountText}${category}品类关键词，${basisStatusText(cluster)}。`;
}

function basisStatusText(cluster) {
  return {
    new: '本轮首次进入候选',
    rising: '当前热度上升中',
    holding: '当前持续在榜',
    steady: '当前热度平稳',
    cooling: '当前热度回落中'
  }[cluster.status] || `当前${cluster.statusLabel || '状态待观察'}`;
}

function scoreToPercent(rawScore = 0) {
  const score = Number(rawScore) || 0;
  const anchors = [
    [0, 0],
    [20, 30],
    [50, 50],
    [80, 65],
    [120, 75],
    [180, 85],
    [250, 92],
    [350, 97],
    [500, 100]
  ];

  for (let i = 1; i < anchors.length; i++) {
    const [prevRaw, prevDisplay] = anchors[i - 1];
    const [nextRaw, nextDisplay] = anchors[i];
    if (score <= nextRaw) {
      const ratio = (score - prevRaw) / (nextRaw - prevRaw);
      return Math.round(prevDisplay + ratio * (nextDisplay - prevDisplay));
    }
  }

  return 100;
}

function scoreLevel(displayScore) {
  if (displayScore >= 85) return '强热点';
  if (displayScore >= 60) return '关注后续';
  return '观察';
}

function formatDisplayScore(rawScore) {
  const displayScore = scoreToPercent(rawScore);
  return `${displayScore}/100（${scoreLevel(displayScore)}）`;
}

function formatSignalBrief(signal) {
  const rank = signal.rank ? `#${signal.rank}` : '未排名';
  const heat = signal.heat ? ` ${formatHeat(signal.heat)}` : '';
  const board = signal.board ? `${signal.platformLabel}/${signal.board}` : signal.platformLabel;
  return `${board}${rank}${heat}`;
}

function signalDisplayOrder(signal) {
  const platformOrder = {
    weibo: 0,
    douyin: 1,
    hupu: 2,
    tieba: 3
  };
  return [
    platformOrder[signal.platform] ?? 9,
    signal.rank || 999
  ];
}

function compareSignalsForDisplay(a, b) {
  const left = signalDisplayOrder(a);
  const right = signalDisplayOrder(b);
  if (left[0] !== right[0]) return left[0] - right[0];
  return left[1] - right[1];
}

function summarizeFoldedSignals(signals, maxItems = 2) {
  const displayed = signals.slice(0, maxItems).map(formatSignalBrief);
  if (signals.length > maxItems) {
    return `${displayed.join('、')}等${signals.length}条`;
  }
  return displayed.join('、');
}

function buildHeatLine(cluster) {
  const sortedSignals = (cluster.signals || []).slice().sort(compareSignalsForDisplay);
  if (sortedSignals.length === 0) return (cluster.platformSummary || []).slice(0, 3).join(' ｜ ');

  const visible = sortedSignals.slice(0, 3).map(formatSignalBrief);
  const folded = sortedSignals.slice(3);
  const foldedHotSearch = folded.filter(signal => signal.platform === 'weibo' || signal.platform === 'douyin');
  const foldedCommunity = folded.filter(signal => signal.platform === 'tieba' || signal.platform === 'hupu');

  if (foldedHotSearch.length > 0) {
    visible.push(`其他热搜：${summarizeFoldedSignals(foldedHotSearch)}`);
  }
  if (foldedCommunity.length > 0) {
    visible.push(`社区补充：${summarizeFoldedSignals(foldedCommunity)}`);
  }

  return visible.join(' ｜ ');
}

function buildChangeLine(cluster) {
  if (cluster.hourlyTrend?.sampleCount >= 2) {
    const trend = cluster.hourlyTrend;
    const parts = [cluster.statusLabel];
    if (trend.dropFromPeak > 0) {
      parts.push(`较小时最高点低 ${Math.round(trend.dropFromPeak * 100)}%`);
    } else {
      parts.push('处于小时内高点');
    }
    if (trend.peakHeat) {
      const rank = trend.peakRank ? `#${trend.peakRank} ` : '';
      const platform = trend.peakPlatformLabel || '主平台';
      const time = trend.peakAt ? `（${formatClock(trend.peakAt)}）` : '';
      parts.push(`${platform}最高 ${rank}${formatHeat(trend.peakHeat)}${time}`);
    }
    parts.push(`覆盖 ${cluster.platformCount} 个平台`);
    return parts.join(' ｜ ');
  }

  const parts = [
    cluster.statusLabel,
    formatGrowth(cluster),
    `覆盖 ${cluster.platformCount} 个平台`
  ];
  return parts.join(' ｜ ');
}

function buildSuggestion(cluster) {
  if (cluster.aiSuggestion) {
    cluster.suggestionSource = 'AI生成';
    return cluster.aiSuggestion;
  }

  cluster.suggestionSource = '规则生成';
  if (cluster.status === 'cooling') {
    return '不作为当日首消主入口，保留观察；回升或扩散再跟进。';
  }
  if (cluster.platformCount >= 3) {
    return '可作为当日首消切入点，优先准备话题素材和承接内容。';
  }
  if (cluster.status === 'rising') {
    return '热度上升中，补齐背景和搜索词，观察是否适合当日放大。';
  }
  if (cluster.status === 'new') {
    return '先看一轮排名和评论情绪，确认首消吸引力后再放大。';
  }
  if (cluster.status === 'holding') {
    return '保留为当日备选触点，重点看是否出现新进展带动首消。';
  }
  return '暂不作为当日首消主入口，等排名前移或跨平台扩散再跟进。';
}

function bestSignalForPlatform(cluster, platform) {
  return (cluster.signals || []).find(signal => signal.platform === platform);
}

function fallbackTopicTerm(cluster) {
  const keywords = [...new Set(cluster.keywords || [])]
    .filter(keyword => String(keyword).trim().length >= 2)
    .slice(0, 4);
  return keywords.length ? keywords.join(' ') : inferTopicTerm(cluster.mainSignal.title);
}

function includesTerm(text, term) {
  return text.toLowerCase().includes(String(term).toLowerCase());
}

function inferTopicTerm(title = '') {
  const text = String(title)
    .replace(/^原创\s*/i, '')
    .replace(/[《》“”"']/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  const entities = KNOWN_TOPIC_TERMS.filter(term => includesTerm(text, term));
  if (entities.length) return entities.slice(0, 3).join(' ');

  const segments = text
    .split(/[：:，,。！？?；;｜|\-—\s]+/)
    .map(segment => segment.trim())
    .filter(Boolean);
  const concise = segments.find(segment =>
    segment.length >= 2 &&
    segment.length <= 18 &&
    !/^(原创|如何看待|怎么看|为什么|有没有|大家|他们|这个|那个|也期待)$/.test(segment)
  );

  return concise || text.slice(0, 18);
}

function platformTopicTerm(cluster, platform) {
  const platformSignal = bestSignalForPlatform(cluster, platform);
  return platformSignal?.title || fallbackTopicTerm(cluster);
}

function platformSearchLink(cluster, platform, directLabel, fallbackLabel, urlBuilder) {
  const platformSignal = bestSignalForPlatform(cluster, platform);
  const term = platformTopicTerm(cluster, platform);
  const encoded = encodeURIComponent(term);
  const label = platformSignal ? directLabel : fallbackLabel;
  return `[${label}](${urlBuilder(encoded)})`;
}

function hupuLink(cluster) {
  const hupuSignal = bestSignalForPlatform(cluster, 'hupu');
  if (hupuSignal?.url && /\/\d+\.html(?:[?#].*)?$/.test(hupuSignal.url)) {
    return `[查看虎扑热帖](${hupuSignal.url})`;
  }

  const encoded = encodeURIComponent(fallbackTopicTerm(cluster));
  return `[搜索虎扑关键词](https://bbs.hupu.com/search?q=${encoded})`;
}

function detailLinks(cluster) {
  return [
    platformSearchLink(cluster, 'weibo', '查看微博话题', '搜索微博关键词', encoded => `https://s.weibo.com/weibo?q=${encoded}`),
    platformSearchLink(cluster, 'douyin', '查看抖音话题', '搜索抖音关键词', encoded => `https://www.douyin.com/search/${encoded}`),
    hupuLink(cluster)
  ].join(' ｜ ');
}

function seedPlatforms(config = {}) {
  return Array.isArray(config.seedPlatforms) && config.seedPlatforms.length
    ? config.seedPlatforms
    : DEFAULT_BROADCAST_SEED_PLATFORMS;
}

function seedPlatformText(config = {}) {
  return seedPlatforms(config)
    .map(platform => PLATFORM_LABELS[platform] || platform)
    .join('或');
}

function hasBroadcastSeed(cluster, config = {}) {
  const requiredPlatforms = new Set(seedPlatforms(config));
  return (cluster.signals || []).some(signal => requiredPlatforms.has(signal.platform));
}

function eligibleReportClusters(clusters, config = {}) {
  if (config.requireSeedPlatforms === false) return clusters;
  return clusters.filter(cluster => hasBroadcastSeed(cluster, config));
}

function communityOnlyClusters(clusters, config = {}) {
  if (config.showCommunityWatchlist === false) return [];
  return clusters
    .filter(cluster => !hasBroadcastSeed(cluster, config))
    .filter(cluster => (cluster.signals || []).some(signal => signal.platform === 'hupu' || signal.platform === 'tieba'))
    .sort((a, b) => b.score - a.score)
    .slice(0, config.communityWatchlistN || 3);
}

function selectReportClusters(clusters, config = {}) {
  const topN = config.topN || 8;
  const minScore = config.minScore || 0;
  return eligibleReportClusters(clusters, config)
    .filter(cluster => cluster.score >= minScore)
    .slice(0, topN);
}

function renderCluster(cluster, index) {
  const icon = STATUS_ICON[cluster.status] || '👀';
  const category = categoryIcon(cluster);
  const lines = [];

  lines.push(`### ${index + 1}. ${category} ${icon} ${cluster.mainSignal.title}`);
  lines.push('');
  lines.push(`**综合分：${formatDisplayScore(cluster.score)}**`);
  lines.push('');
  lines.push(`**入选依据：** ${explainWhy(cluster)}`);
  lines.push('');
  lines.push(`**平台表现：** ${buildHeatLine(cluster)}`);
  lines.push('');
  lines.push(`**趋势变化：** ${buildChangeLine(cluster)}`);
  lines.push('');
  lines.push(`**处理建议：** ${buildSuggestion(cluster)}`);
  lines.push('');
  lines.push(detailLinks(cluster));
  lines.push('');
  lines.push('---');
  lines.push('');

  return lines.join('\n');
}

function generateOverview(selected, clusters, eligibleClusters, meta, config = {}) {
  const risingCount = selected.filter(cluster => cluster.status === 'rising').length;
  const newCount = selected.filter(cluster => cluster.status === 'new').length;
  const crossPlatformCount = selected.filter(cluster => cluster.platformCount >= 2).length;
  const rawCount = meta.rawSignalCount || meta.signalCount || 0;
  const keptCount = meta.signalCount || 0;
  const seedText = seedPlatformText(config);

  return [
    `本轮采集 ${rawCount} 条信号，入池 ${keptCount} 条，聚合为 ${clusters.length} 个话题。`,
    `其中 ${eligibleClusters.length} 个话题命中${seedText}热搜，进入播报候选。`,
    `本轮入选 ${selected.length} 个；其中新上榜 ${newCount} 个，热度上升 ${risingCount} 个。`,
    `多平台覆盖话题 ${crossPlatformCount} 个，优先关注后续扩散。`
  ];
}

function generateReport(clusters, meta = {}, config = {}) {
  const topN = config.topN || 8;
  const eligibleClusters = eligibleReportClusters(clusters, config);
  const selected = selectReportClusters(clusters, config);

  const lines = [];
  lines.push('# 热点综合播报');
  lines.push('');
  lines.push(`播报时间：${formatTime(meta.generatedAt || new Date())}`);
  lines.push('');

  if (selected.length === 0) {
    lines.push(`本轮暂无命中${seedPlatformText(config)}热搜且达到入选标准的热点。`);
    return lines.join('\n');
  }

  generateOverview(selected, clusters, eligibleClusters, meta, config).forEach(line => lines.push(line));
  lines.push('');
  lines.push('---');
  lines.push('');

  selected.forEach((cluster, index) => {
    lines.push(renderCluster(cluster, index));
  });

  const watchlist = eligibleClusters.slice(topN, topN + 5);
  if (watchlist.length > 0) {
    lines.push('### 观察列表');
    lines.push('');
    watchlist.forEach(cluster => {
      const heat = cluster.platformSummary.slice(0, 2).join(' ｜ ');
      lines.push(`- ${cluster.mainSignal.title}：${cluster.statusLabel} ｜ ${heat}`);
    });
    lines.push('');
  }

  const communityWatchlist = communityOnlyClusters(clusters, config);
  if (communityWatchlist.length > 0) {
    lines.push('### 社区观察');
    lines.push('');
    communityWatchlist.forEach(cluster => {
      const category = visualCategory(cluster);
      const heat = buildHeatLine(cluster);
      lines.push(`- ${category} ｜ ${cluster.mainSignal.title} ｜ 综合分 ${formatDisplayScore(cluster.score)} ｜ ${heat} ｜ 未命中微博/抖音`);
    });
    lines.push('');
  }

  return lines.join('\n').trim() + '\n';
}

module.exports = {
  generateReport,
  formatTime,
  selectReportClusters,
  hasBroadcastSeed
};
