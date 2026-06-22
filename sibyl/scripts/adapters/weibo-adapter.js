const { requestJson } = require('../lib/http');
const { makeSignal } = require('../lib/signals');

const DEFAULT_URL = 'https://weibo.com/ajax/side/hotSearch';

async function fetchWeiboSignals(config = {}) {
  const url = config.url || DEFAULT_URL;
  const data = await requestJson(url, {
    timeout: config.timeout || 12000,
    retries: config.retries ?? 1,
    headers: {
      Referer: 'https://weibo.com/hot/search',
      Accept: 'application/json, text/plain, */*'
    }
  });

  const items = data?.data?.realtime || [];
  const maxItems = config.maxItems || 50;
  return items.slice(0, maxItems).map((item, index) => {
    const title = item.word || item.note || item.word_scheme || '';
    const heat = item.num || item.raw_hot || item.raw_hot_value || 0;
    return makeSignal({
      platform: 'weibo',
      sourceType: 'hot_search',
      title,
      rank: index + 1,
      heat,
      heatText: item.num ? undefined : item.raw_hot,
      url: `https://s.weibo.com/weibo?q=%23${encodeURIComponent(title)}%23`,
      raw: item
    });
  }).filter(signal => signal.title);
}

module.exports = {
  fetchWeiboSignals
};
