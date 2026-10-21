/**
 * 模型配置加载（模式 2 · 独立 CLI）
 * 从 .env / 环境变量读取 LLM 配置，供 agent 创建模型实例使用。
 *
 * 变量约定（与 .env.example 一致）：
 *   OPENAI_API_KEY   必填，API 密钥
 *   OPENAI_BASE_URL  可选，OpenAI 兼容端点（DeepSeek / MoonShot 等）
 *   DEFAULT_MODEL    可选，默认模型名
 *
 * 加载优先级：环境变量 > .env（Bun 运行时自动加载 .env 到 process.env）。
 */

/** 模型配置 */
export interface ModelConfig {
  apiKey: string
  baseURL?: string
  model: string
}

/**
 * 归一化 base URL：部分 OpenAI 兼容端点需带 /v1 才能命中 chat/completions。
 * 已含版本号（/v1、/v2…）则原样保留，否则补 /v1。
 *
 * 仅在 `OPENAI_APPEND_V1` 非 'false' 时补后缀——Azure OpenAI、路径路由型网关
 * 需要保留原始 URL，可在 .env 设 `OPENAI_APPEND_V1=false` 关闭。
 */
function normalizeBaseURL(raw: string): string {
  const trimmed = raw.trim().replace(/\/+$/, '')
  if (!trimmed) return trimmed
  const appendV1 =
    process.env.OPENAI_APPEND_V1?.trim().toLowerCase() !== 'false'
  if (!appendV1) return trimmed
  return /\/v\d+$/i.test(trimmed) ? trimmed : `${trimmed}/v1`
}

/**
 * 读取并校验模型配置。
 * 缺少 API key / 模型名时抛出明确错误，引导用户配置 .env（不做厂商特定兜底）。
 */
export function loadModelConfig(): ModelConfig {
  const apiKey = process.env.OPENAI_API_KEY?.trim()
  if (!apiKey) {
    throw new Error(
      '缺少 OPENAI_API_KEY。请复制 .env.example 为 .env 并填写 API key：\n' +
        '  cp .env.example .env'
    )
  }

  const model = process.env.DEFAULT_MODEL?.trim()
  if (!model) {
    throw new Error(
      '缺少 DEFAULT_MODEL（模型名因供应商而异，不做默认兜底）。\n' +
        '请在 .env 填写，例如 DeepSeek 用 DEFAULT_MODEL=deepseek-chat。'
    )
  }

  const rawBaseURL = process.env.OPENAI_BASE_URL?.trim()

  return {
    apiKey,
    baseURL: rawBaseURL ? normalizeBaseURL(rawBaseURL) : undefined,
    model
  }
}
