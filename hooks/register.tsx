import { atom, read, update } from 'claude-code'
import type { Register } from 'claude-code'

import type { Buddy, Kind, Step } from '../types'

const PANE = 'sagyo-buddy'
const TITLE = 'いまのClaude'

const IDLE: Buddy = {
  kind: 'idle',
  label: 'ひと休み中',
  detail: '次の指示を待っています',
  since: 0,
  turnStart: 0,
  turnActive: false,
  stepsThisTurn: 0,
}

const buddy = atom({ plugin: 'sagyo-buddy', key: 'buddy' } as const, IDLE, { shape: 'buddy-1' })
const steps = atom({ plugin: 'sagyo-buddy', key: 'steps' } as const, [] as Step[], { shape: 'steps-1' })
const tick = atom({ plugin: 'sagyo-buddy', key: 'tick' } as const, 0, { shape: 'tick-1' })

// ---------- what is Claude doing? ----------

type Desc = { kind: Kind; label: string; detail: string }

const cut = (s: unknown, n = 60): string => {
  const t = typeof s === 'string' ? s.replace(/\s+/g, ' ').trim() : ''
  return t.length > n ? t.slice(0, n - 1) + '…' : t
}

function describe(e: { tool: string } & Record<string, unknown>): Desc {
  const t = e.tool
  const arg = (k: string) => e[k]
  if (t === 'Read') return { kind: 'read', label: 'ファイルを読んでいます', detail: cut(String(arg('file_path') ?? '').split('/').pop()) }
  if (t === 'Glob' || t === 'Grep') return { kind: 'search', label: 'ファイルの中を探しています', detail: cut(arg('pattern')) }
  if (t === 'Write' || t === 'Edit' || t === 'NotebookEdit')
    return { kind: 'write', label: 'ファイルを書いています', detail: cut(String(arg('file_path') ?? '').split('/').pop()) }
  if (t === 'Bash') return { kind: 'run', label: 'コマンドを実行しています', detail: cut(arg('description') || arg('command')) }
  if (t === 'WebSearch') return { kind: 'web', label: 'Webで調べています', detail: cut(arg('query')) }
  if (t === 'WebFetch') return { kind: 'web', label: 'Webページを読んでいます', detail: cut(arg('url')) }
  if (t === 'Agent' || t === 'Task') return { kind: 'helper', label: '作業役に仕事を任せています', detail: cut(arg('description')) }
  if (t === 'Skill') return { kind: 'read', label: '手順書を読み込んでいます', detail: cut(arg('skill')) }
  if (t === 'ToolSearch') return { kind: 'think', label: '道具を準備しています', detail: '' }
  if (t === 'TaskCreate' || t === 'TaskUpdate') return { kind: 'think', label: 'やることリストを更新しています', detail: cut(arg('subject')) }
  if (t === 'AskUserQuestion') return { kind: 'ask', label: 'あなたの返事を待っています', detail: '' }
  if (t === 'SendUserMessage') return { kind: 'publish', label: 'メッセージを送っています', detail: '' }
  if (t === 'SendUserFile') return { kind: 'publish', label: 'ファイルを渡しています', detail: '' }
  if (t === 'Artifact') return { kind: 'publish', label: 'ページを公開しています', detail: '' }
  if (t === 'propose_skills') return { kind: 'memo', label: 'スキルを提案しています', detail: '' }
  if (t.startsWith('mcp__memory__')) return { kind: 'memo', label: 'メモを整理しています', detail: cut(arg('path')) }
  if (t.startsWith('mcp__remote-devices__')) return { kind: 'run', label: 'あなたのパソコンで作業しています', detail: '' }
  if (t.startsWith('mcp__Higgsfield__')) {
    const n = t.slice('mcp__Higgsfield__'.length)
    const cmd = String(arg('command') ?? '')
    if (n === 'sandbox_exec') {
      if (/higgsedit render/.test(cmd)) return { kind: 'video', label: '動画をレンダリングしています', detail: '数分かかります' }
      if (/higgsedit (frame|build)/.test(cmd)) return { kind: 'video', label: '画面を確認しています', detail: 'プレビューを作成中' }
      if (/upload\.higgsfield|curl -sf -o \/dev\/null -w "HTTP/.test(cmd)) return { kind: 'upload', label: '動画をアップロードしています', detail: '' }
      if (/whisper|WhisperModel/.test(cmd)) return { kind: 'voice', label: '声を聞き取って確認しています', detail: '' }
      if (/mix\.py|ebur128|loudnorm/.test(cmd)) return { kind: 'voice', label: '音を整えています', detail: '' }
      if (/\.bg\/.*\.exit/.test(cmd)) return { kind: 'video', label: 'レンダリングの完了を待っています', detail: '' }
      return { kind: 'run', label: '制作環境で作業しています', detail: '' }
    }
    if (n.startsWith('generate_audio')) return { kind: 'voice', label: 'ナレーションを作っています', detail: '' }
    if (n.startsWith('generate_video')) return { kind: 'video', label: '動画を生成しています', detail: '' }
    if (n.startsWith('generate_image')) return { kind: 'write', label: '画像を生成しています', detail: '' }
    if (n === 'jobs_wait') return { kind: 'think', label: '生成の完了を待っています', detail: '' }
    if (n.startsWith('media_upload_widget')) return { kind: 'ask', label: 'アップロードを待っています', detail: '素材を選んでください' }
    if (n.startsWith('media_')) return { kind: 'upload', label: '素材をやり取りしています', detail: '' }
    if (n === 'show_result' || n === 'register_what_if_result') return { kind: 'done', label: '完成品を届けています', detail: '' }
    return { kind: 'run', label: 'Higgsfieldで作業しています', detail: cut(n) }
  }
  if (t.startsWith('mcp__')) return { kind: 'run', label: '外部ツールを使っています', detail: cut(t.split('__').pop()) }
  return { kind: 'think', label: '作業しています', detail: cut(t) }
}

// ---------- the character ----------

const PROP: Record<Kind, string> = {
  idle: '☕', think: '💭', read: '📖', write: '✏️', search: '🔍', web: '🌐', run: '⌨️', video: '🎬',
  voice: '🎙️', upload: '☁️', helper: '🤝', memo: '📝', publish: '📤', ask: '✋', done: '🎉', error: '⚠️',
}
const ACCENT: Record<Kind, string> = {
  idle: '#9aa5b1', think: '#a78bfa', read: '#60a5fa', write: '#34d399', search: '#38bdf8', web: '#22d3ee',
  run: '#f59e0b', video: '#f472b6', voice: '#fb7185', upload: '#60a5fa', helper: '#a3e635', memo: '#fbbf24',
  publish: '#2dd4bf', ask: '#facc15', done: '#facc15', error: '#ef4444',
}

function characterSvg(kind: Kind): string {
  const a = ACCENT[kind]
  const busy = kind !== 'idle' && kind !== 'ask' && kind !== 'done'
  const bob = kind === 'done' ? '0 0; 0 -10; 0 0' : busy ? '0 0; 0 -3; 0 0' : '0 0; 0 -1.5; 0 0'
  const bobDur = kind === 'done' ? '0.5s' : busy ? '0.6s' : '2.4s'
  const typing = kind === 'run' || kind === 'write' || kind === 'memo'
  const armL = typing ? '<animateTransform attributeName="transform" type="rotate" values="-10 70 120; 12 70 120; -10 70 120" dur="0.25s" repeatCount="indefinite"/>' : ''
  const armR = typing ? '<animateTransform attributeName="transform" type="rotate" values="10 170 120; -12 170 120; 10 170 120" dur="0.25s" begin="0.12s" repeatCount="indefinite"/>' : ''
  const wave = kind === 'ask' || kind === 'done' ? '<animateTransform attributeName="transform" type="rotate" values="0 170 118; -35 170 118; 0 170 118" dur="0.7s" repeatCount="indefinite"/>' : armR
  const eyes = kind === 'idle'
    ? '<path d="M98 96 q8 6 16 0" stroke="#3b2418" stroke-width="4" fill="none" stroke-linecap="round"/><path d="M126 96 q8 6 16 0" stroke="#3b2418" stroke-width="4" fill="none" stroke-linecap="round"/>'
    : `<g><ellipse cx="106" cy="96" rx="6" ry="8" fill="#3b2418"><animate attributeName="ry" values="8;8;1;8" keyTimes="0;0.92;0.96;1" dur="3.2s" repeatCount="indefinite"/></ellipse><ellipse cx="134" cy="96" rx="6" ry="8" fill="#3b2418"><animate attributeName="ry" values="8;8;1;8" keyTimes="0;0.92;0.96;1" dur="3.2s" repeatCount="indefinite"/></ellipse><circle cx="108" cy="93" r="2" fill="#fff"/><circle cx="136" cy="93" r="2" fill="#fff"/></g>`
  const mouth = kind === 'done' || kind === 'helper'
    ? '<path d="M110 112 q10 12 20 0" fill="#7a2e1e"/>'
    : kind === 'error' ? '<path d="M110 118 q10 -8 20 0" stroke="#7a2e1e" stroke-width="4" fill="none" stroke-linecap="round"/>'
    : '<path d="M112 114 q8 6 16 0" stroke="#7a2e1e" stroke-width="4" fill="none" stroke-linecap="round"/>'
  const desk = typing
    ? '<rect x="72" y="142" width="96" height="10" rx="3" fill="#cbd5e1"/><rect x="84" y="112" width="72" height="32" rx="4" fill="#475569"/><rect x="88" y="116" width="64" height="24" rx="2" fill="#93c5fd"><animate attributeName="opacity" values="0.7;1;0.7" dur="0.8s" repeatCount="indefinite"/></rect>'
    : ''
  const sparks = kind === 'done'
    ? '<g fill="#facc15"><circle cx="40" cy="40" r="5"><animate attributeName="cy" values="60;20;60" dur="1s" repeatCount="indefinite"/></circle><circle cx="200" cy="50" r="5"><animate attributeName="cy" values="70;25;70" dur="0.9s" repeatCount="indefinite"/></circle><circle cx="180" cy="20" r="4" fill="#f472b6"><animate attributeName="cy" values="40;10;40" dur="1.1s" repeatCount="indefinite"/></circle></g>'
    : ''
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 240 200" width="240" height="200">
<defs><radialGradient id="bg" cx="50%" cy="40%" r="70%"><stop offset="0" stop-color="${a}" stop-opacity="0.35"/><stop offset="1" stop-color="${a}" stop-opacity="0"/></radialGradient>
<linearGradient id="body" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#f4a383"/><stop offset="1" stop-color="#d9775b"/></linearGradient></defs>
<rect width="240" height="200" rx="18" fill="url(#bg)"/>
${sparks}
<ellipse cx="120" cy="182" rx="56" ry="7" fill="#000" opacity="0.15"/>
<g><animateTransform attributeName="transform" type="translate" values="${bob}" dur="${bobDur}" repeatCount="indefinite"/>
  <g transform="translate(120 34)"><path d="M0 -14 L4 -4 L14 0 L4 4 L0 14 L-4 4 L-14 0 L-4 -4 Z" fill="#fbbf77"><animateTransform attributeName="transform" type="rotate" values="0;360" dur="${busy ? '2s' : '8s'}" repeatCount="indefinite"/></path></g>
  <line x1="120" y1="46" x2="120" y2="58" stroke="#d9775b" stroke-width="4"/>
  <rect x="62" y="56" width="116" height="104" rx="46" fill="url(#body)"/>
  <ellipse cx="96" cy="110" rx="9" ry="5" fill="#ff8f8f" opacity="0.55"/><ellipse cx="144" cy="110" rx="9" ry="5" fill="#ff8f8f" opacity="0.55"/>
  ${eyes}${mouth}
  <g><path d="M70 120 q-16 8 -10 26" stroke="#d9775b" stroke-width="10" fill="none" stroke-linecap="round"/>${armL}</g>
  <g><path d="M170 120 q16 8 10 26" stroke="#d9775b" stroke-width="10" fill="none" stroke-linecap="round"/>${wave}</g>
  ${desk}
</g>
<g transform="translate(186 30)"><circle r="24" fill="#fff" stroke="${a}" stroke-width="3"/><text y="9" text-anchor="middle" font-size="26">${PROP[kind]}</text>
<animateTransform attributeName="transform" type="translate" values="186 30; 186 24; 186 30" dur="1.6s" repeatCount="indefinite"/></g>
</svg>`
}

const ASCII: Record<Kind, string> = {
  idle: '( -‿- ) zz', think: '( •_• ) …', read: '( •ω• )📖', write: '( •̀ᴗ•́ )✏', search: '( •_• )🔍', web: '( •o• )🌐',
  run: '( •̀ω•́ )⌨', video: '( ★ω★ )🎬', voice: '( •o• )🎙', upload: '( •ᴗ• )☁', helper: '( ^ω^ )🤝', memo: '( •ᴗ• )📝',
  publish: '( ^ᴗ^ )📤', ask: '( •ω• )✋', done: '\\( ^ω^ )/ 🎉', error: '( ;_; )⚠',
}

// ---------- helpers ----------

const fmtDur = (ms: number) => {
  const s = Math.max(0, Math.round(ms / 1000))
  return s < 60 ? `${s}秒` : `${Math.floor(s / 60)}分${String(s % 60).padStart(2, '0')}秒`
}

let ticker: { cancel: () => void } | undefined

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.command.register({ name: 'sagyo', description: 'Claudeの作業状況パネルを開く' })
    void $.ui.open({ id: PANE, title: TITLE })
    return next(e)
  })

  on('command.run', { command: 'sagyo' }, async $ => {
    await $.ui.open({ id: PANE, title: TITLE })
    return { text: '作業状況パネルを開きました。' }
  })

  on('turn.start', async ($, e, next) => {
    if (!(e as { agentId?: string }).agentId) try {
      const now = await $.clock.now()
      await update($, buddy, (): Buddy => ({ kind: 'think', label: '依頼を読んで考えています', detail: cut(e.text, 50), since: now, turnStart: now, turnActive: true, stepsThisTurn: 0 }))
      ticker?.cancel()
      ticker = $.clock.every(1000, () => { void update($, tick, n => n + 1).catch(() => {}) }) as unknown as { cancel: () => void }
    } catch { /* ignore */ }
    return next(e)
  })

  on('turn.complete', async ($, e, next) => {
    const out = await next(e)
    if (!(e as { agentId?: string }).agentId) try {
      ticker?.cancel(); ticker = undefined
      const now = await $.clock.now()
      const reason = (e as { reason?: string }).reason
      await update($, buddy, (b): Buddy => ({
        ...b,
        kind: reason === 'error' ? 'error' : reason === 'aborted' ? 'idle' : 'done',
        label: reason === 'error' ? 'エラーで止まりました' : reason === 'aborted' ? '止めました' : 'できました！',
        detail: `${b.stepsThisTurn}ステップ・${fmtDur(now - b.turnStart)}`,
        since: now,
        turnActive: false,
      }))
    } catch { /* ignore */ }
    return out
  })

  on('tool.call', async ($, e, next) => {
    // Display bookkeeping must never block or break the tool itself.
    const id = e.tool_use_id
    let started = 0
    let shown: Desc = { kind: 'think', label: '作業しています', detail: '' }
    try {
      const d = describe(e as unknown as { tool: string } & Record<string, unknown>)
      const sub = !!(e as { agentId?: string }).agentId
      started = await $.clock.now()
      shown = sub ? { kind: 'helper', label: '作業役が調べています', detail: d.label } : d
      const at = started
      await update($, steps, list => [...list, { id, kind: shown.kind, label: shown.label, detail: shown.detail, at }].slice(-40))
      await update($, buddy, b => ({ ...b, kind: shown.kind, label: shown.label, detail: shown.detail, since: at, stepsThisTurn: b.stepsThisTurn + 1 }))
    } catch { /* ignore display errors */ }
    let ok = true
    try {
      const ran = await next(e)
      ok = !(ran as { isError?: boolean } | undefined)?.isError
      return ran
    } catch (err) {
      ok = false
      throw err
    } finally {
      try {
        const end = await $.clock.now()
        await update($, steps, list => list.map(s => (s.id === id ? { ...s, end, ok } : s)))
        await update($, buddy, (b): Buddy => (b.turnActive && b.since === started ? { ...b, kind: 'think', label: '結果を見て考えています', detail: shown.label, since: end } : b))
      } catch { /* ignore display errors */ }
    }
  })

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const ui = $.ui.resolve(e) as unknown as Record<string, any>
    const { Box, Text } = ui
    const Svg = ui.Svg
    const b = await read($, buddy)
    const list = await read($, steps)
    await read($, tick)
    const now = await $.clock.now()
    const rows = Math.max(3, Math.min(8, ((e.viewport?.rows ?? 30) - 18)))
    const recent = list.slice(-rows).reverse()
    const turnTime = b.turnActive ? `作業開始から ${fmtDur(now - b.turnStart)}・${b.stepsThisTurn}ステップ目` : ''
    const stepTime = b.turnActive && b.since ? `この作業 ${fmtDur(now - b.since)}` : ''

    return (
      <Box flexDirection="column" gap={1}>
        {Svg ? (
          <Svg source={characterSvg(b.kind)} alt={`Claude：${b.label}`} width={240} height={200} isInteractive />
        ) : (
          <Text bold>{ASCII[b.kind]}</Text>
        )}
        <Box flexDirection="column">
          <Text size="title" weight="bold">{PROP[b.kind]} {b.label}</Text>
          {b.detail ? <Text dimColor>{b.detail}</Text> : null}
          {turnTime ? <Text size="footnote">{turnTime}{stepTime ? `（${stepTime}）` : ''}</Text> : null}
        </Box>
        <Box flexDirection="column">
          <Text size="footnote" weight="semibold">さっきまでの作業</Text>
          {recent.length === 0 && <Text dimColor>まだ作業はありません</Text>}
          {recent.map(s => (
            <Text dimColor={s.end !== undefined} size="footnote">
              {s.end === undefined ? '▶' : s.ok === false ? '✗' : '✓'} {PROP[s.kind]} {s.label}{s.detail ? ` — ${s.detail}` : ''}{s.end !== undefined ? `（${fmtDur(s.end - s.at)}）` : ''}
            </Text>
          ))}
        </Box>
      </Box>
    )
  })
}
