const fs = require('fs');
const path = require('path');
const { callAIModel } = require('../../../elixir-summarizer/scripts/elixir-summarizer');

function readJson(file) {
  try {
    if (file && fs.existsSync(file)) {
      return JSON.parse(fs.readFileSync(file, 'utf8'));
    }
  } catch (e) {
    return null;
  }
  return null;
}

function loadModelConfig(customConfig = {}) {
  if (customConfig.ai && customConfig.ai.apiKey) return customConfig.ai;

  const candidates = [
    process.env.OPENCLAW_CONFIG,
    '/root/.openclaw/openclaw.json',
    path.join(process.env.HOME || '', '.openclaw', 'openclaw.json')
  ].filter(Boolean);

  for (const file of candidates) {
    const config = readJson(file);
    const modelConfig = config?.models?.providers?.aliyun;
    if (modelConfig?.apiKey) return modelConfig;
  }

  return null;
}

function buildPrompt(cluster) {
  const platformLine = cluster.platformSummary.slice(0, 4).join(' ｜ ');

  return `你是给用增市场团队看的热点综合播报助手。请为下面这个热点写一句“处理建议”。

业务目标：
- 用增市场关注“当日首次消费内容去高活DAU”
- 重点判断热点能否吸引非高活用户在当天完成第一次内容消费
- 处理建议要服务市场侧选题、投放、话题素材和内容承接判断

“处理建议”的含义：
- 给用增市场判断这个热点是否适合作为当日首消内容入口、如何跟进、需要观察什么风险
- 不是给事件当事人、球队、选手、产品方的建议
- 不要回答标题里的争议问题，不要评判比赛战术、球员首发、选手表现或产品对错

要求：
- 只输出一句中文建议，不要解释
- 不超过50个汉字
- 表述自然、具体、可执行
- 不要使用“建议你”“可以考虑”“AI”等字样
- 不要编造不存在的信息
- 必须围绕用增市场判断表达，例如首消切入、内容承接、话题素材、搜索词、评论情绪、是否放大、风险控制

热点标题：${cluster.mainSignal.title}
大类：${cluster.category || '未知'}
状态：${cluster.statusLabel}
综合分：${cluster.score}
平台表现：${platformLine}
覆盖平台数：${cluster.platformCount || 1}`;
}

function cleanSuggestion(text = '') {
  return String(text)
    .replace(/^["'“”]+|["'“”]+$/g, '')
    .replace(/^处理建议[:：]\s*/, '')
    .replace(/\s+/g, '')
    .trim()
    .slice(0, 80);
}

function isSuggestionUsable(text = '') {
  const suggestion = String(text);
  if (!suggestion) return false;

  const marketSignals = /用增|首消|首次消费|DAU|非高活|去高活|入口|触点|承接|素材|搜索词|跟进|观察|监测|扩散|传播|评论|情绪|舆情|争议|风险|节奏|排名|热度|平台|背景|放大|优先|暂缓|保留|市场|切入|二次传播/;
  if (!marketSignals.test(suggestion)) return false;

  const offScopeSignals = /首发必要性|战术适配|战术安排|阵容安排|上场时间|俱乐部状态|球队应当|选手应当|球员应当|产品方应当|是否应该首发|该不该首发/;
  if (offScopeSignals.test(suggestion)) return false;

  return true;
}

async function applyAISuggestions(clusters, config = {}) {
  if (config.aiSuggestions === false) return clusters;

  const modelConfig = loadModelConfig(config);
  if (!modelConfig) return clusters;

  const limit = Math.min(config.aiSuggestionLimit || config.topN || 8, clusters.length);
  for (const cluster of clusters.slice(0, limit)) {
    try {
      const result = await callAIModel(buildPrompt(cluster), modelConfig, 1);
      if (result.success && result.content) {
        const suggestion = cleanSuggestion(result.content);
        if (isSuggestionUsable(suggestion)) {
          cluster.aiSuggestion = suggestion;
        }
      }
    } catch (e) {
      // AI建议失败不影响主流程，报告生成会使用规则兜底。
    }
  }

  return clusters;
}

module.exports = {
  applyAISuggestions,
  buildPrompt,
  cleanSuggestion,
  isSuggestionUsable
};
