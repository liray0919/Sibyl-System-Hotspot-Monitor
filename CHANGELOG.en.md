# Changelog

[中文](CHANGELOG.zh-CN.md) | [English README](README.en.md)

Author: Misaka Studio

All notable changes to Sibyl System Hotspot Monitor are recorded here.

## 1.2.5 - 2026-06-22

- Added `scripts/check-deploy.js` for post-deployment self-checks.
- The self-check covers webhooks, Weibo intelligent search, AI model configuration, system time zone, data directory, and manual confirmation items.
- The self-check only prints configured/missing status and does not expose real webhooks, AppSecrets, or model keys.

## 1.2.4 - 2026-06-22

- Added environment-variable support for Weibo intelligent search credentials and endpoints.
- Added `alerts.weiboAI` configuration for appId, appSecret, authUrl, and searchUrl.
- Kept `/root/.openclaw/openclaw.json` `channels.weibo` as a backward-compatible fallback.

## 1.2.3 - 2026-06-22

- Simplified public report score labels into three reader-facing levels: `观察`, `关注后续`, and `强热点`.
- Clarified that report scores are ranking indicators, not absolute cross-platform heat totals.
- Prepared the project for GitHub publication as `Sibyl System Hotspot Monitor`.

## 1.2.2 - 2026-06-22

- Added deployment guidance for explicit webhook environment variable injection in scheduled tasks.
- Added system time zone consistency checks for the Beijing-time reporting window.
- Clarified OpenClaw delivery mode expectations to avoid duplicate pushes.

## 1.2.1 - 2026-06-18

- Added the internal product document for Sibyl System.
- Documented product goals, user scenarios, architecture diagrams, data flow, deployment, reuse guidance, and risks.
- Added sharing notes for product and operational review contexts.

## 1.2.0 - 2026-06-18

- Added independent webhook configuration for instant alerts and hourly reports.
- Improved the alert summary chain with cache, legacy summary reuse, Weibo intelligent search, Elixir summarization, and AI search fallback.
- Added business-category filtering and conservative summary behavior for non-target topics.
- Added AI-assisted handling suggestions for hourly reports with rule-based fallback.

## 1.1.0 - 2026-06-18

- Upgraded to a unified snapshot architecture.
- Added shared 10-minute snapshots for instant alerts and hourly reports.
- Integrated Weibo and Douyin instant alerts into the Sibyl data flow.
- Added recent-snapshot trend analysis for hourly reports.
- Added Tieba and Hupu as supporting community signals.

## 1.0.0 - 2026-06-16

- Initial Sibyl implementation.
- Added multi-platform signal collection from Weibo, Douyin, Tieba, and Hupu.
- Added topic classification, event clustering, scoring, and Markdown report generation.
- Added enterprise WeChat report delivery support.
