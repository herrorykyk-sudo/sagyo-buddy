export type Kind =
  | 'idle' | 'think' | 'read' | 'write' | 'search' | 'web' | 'run' | 'video'
  | 'voice' | 'upload' | 'helper' | 'memo' | 'publish' | 'ask' | 'done' | 'error'

export type Step = { id: string; kind: Kind; label: string; detail: string; at: number; end?: number; ok?: boolean }

export type Buddy = {
  kind: Kind
  label: string
  detail: string
  since: number
  turnStart: number
  turnActive: boolean
  stepsThisTurn: number
}

declare module 'claude-code' {
  interface PluginState {
    'sagyo-buddy': {
      buddy: Shaped<Buddy>
      steps: Shaped<Step[]>
      tick: Shaped<number>
    }
  }
}
