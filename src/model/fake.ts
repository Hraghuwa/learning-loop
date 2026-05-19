import { ModelPort, Message, CompleteOpts } from './types'

export class FakeModel implements ModelPort {
  calls: Message[][] = []
  private i = 0
  constructor(private scripted: string[]) {}

  async complete(messages: Message[], _opts?: CompleteOpts): Promise<string> {
    this.calls.push(messages)
    if (this.i >= this.scripted.length) throw new Error('FakeModel: no scripted response left')
    return this.scripted[this.i++]
  }

  async embed(text: string): Promise<number[]> {
    const v = new Array(8).fill(0)
    for (let k = 0; k < text.length; k++) v[k % 8] += text.charCodeAt(k) * (k + 1)
    return v
  }
}
