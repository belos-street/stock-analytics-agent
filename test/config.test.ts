import { describe, test, expect, beforeEach, afterEach } from 'bun:test'
import { loadModelConfig } from '../src/agent/config'

/**
 * 模型配置加载单元测试（纯离线，操作 process.env）
 *
 * 注意：Bun 启动时会把 .env 载入 process.env，故测试前先备份环境变量、
 * 用例内显式设置、结束后恢复，避免互相污染。
 */

const ENV_KEYS = ['OPENAI_API_KEY', 'OPENAI_BASE_URL', 'DEFAULT_MODEL'] as const
let savedEnv: Record<string, string | undefined> = {}

beforeEach(() => {
  // 备份并清空相关环境变量，保证每个用例从干净状态开始
  savedEnv = {}
  for (const key of ENV_KEYS) {
    savedEnv[key] = process.env[key]
    delete process.env[key]
  }
})

afterEach(() => {
  // 恢复环境变量
  for (const key of ENV_KEYS) {
    const value = savedEnv[key]
    if (value === undefined) {
      delete process.env[key]
    } else {
      process.env[key] = value
    }
  }
})

describe('loadModelConfig', () => {
  test('缺少 API key 时抛出错误并提示配置 .env', () => {
    expect(() => loadModelConfig()).toThrow('缺少 OPENAI_API_KEY')
  })

  test('空字符串 API key 视为未配置', () => {
    process.env.OPENAI_API_KEY = '   '
    expect(() => loadModelConfig()).toThrow('缺少 OPENAI_API_KEY')
  })

  test('读取 API key 与默认模型', () => {
    process.env.OPENAI_API_KEY = 'sk-test'
    const config = loadModelConfig()
    expect(config.apiKey).toBe('sk-test')
    expect(config.model).toBe('deepseek-v4-flash')
    expect(config.baseURL).toBeUndefined()
  })

  test('DEFAULT_MODEL 显式指定时优先生效', () => {
    process.env.OPENAI_API_KEY = 'sk-test'
    process.env.DEFAULT_MODEL = 'gpt-4o-mini'
    const config = loadModelConfig()
    expect(config.model).toBe('gpt-4o-mini')
  })

  test('API key 两端空白被裁剪', () => {
    process.env.OPENAI_API_KEY = '  sk-pad  '
    const config = loadModelConfig()
    expect(config.apiKey).toBe('sk-pad')
  })
})

describe('base URL 归一化（经 loadModelConfig 间接测）', () => {
  test('裸域名自动补 /v1', () => {
    process.env.OPENAI_API_KEY = 'sk-test'
    process.env.OPENAI_BASE_URL = 'https://api.deepseek.com'
    const config = loadModelConfig()
    expect(config.baseURL).toBe('https://api.deepseek.com/v1')
  })

  test('已有 /v1 不重复补全', () => {
    process.env.OPENAI_API_KEY = 'sk-test'
    process.env.OPENAI_BASE_URL = 'https://api.deepseek.com/v1'
    const config = loadModelConfig()
    expect(config.baseURL).toBe('https://api.deepseek.com/v1')
  })

  test('更高版本号路径保留（/v2 不被误改成 /v1）', () => {
    process.env.OPENAI_API_KEY = 'sk-test'
    process.env.OPENAI_BASE_URL = 'https://example.com/v2'
    const config = loadModelConfig()
    expect(config.baseURL).toBe('https://example.com/v2')
  })

  test('末尾斜杠被清理后再补 /v1', () => {
    process.env.OPENAI_API_KEY = 'sk-test'
    process.env.OPENAI_BASE_URL = 'https://api.moonshot.cn/'
    const config = loadModelConfig()
    expect(config.baseURL).toBe('https://api.moonshot.cn/v1')
  })

  test('多个末尾斜杠同样被清理', () => {
    process.env.OPENAI_API_KEY = 'sk-test'
    process.env.OPENAI_BASE_URL = 'https://example.com///'
    const config = loadModelConfig()
    expect(config.baseURL).toBe('https://example.com/v1')
  })
})
