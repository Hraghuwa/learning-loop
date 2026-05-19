export interface Message { role: 'system' | 'user' | 'assistant'; content: string }
export interface CompleteOpts { temperature?: number; json?: boolean }

export interface ModelPort {
  complete(messages: Message[], opts?: CompleteOpts): Promise<string>
  embed(text: string): Promise<number[]>
}
