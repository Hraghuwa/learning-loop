export type Domain = 'arithmetic' | 'verbal' | 'logic' | 'di' | 'visual'

export interface ProblemMeta {
  domain: Domain
  subDomain: string
  type: string
  difficulty: 1 | 2 | 3 | 4 | 5
  ambiguity: string[]
  isMCQ: boolean
  options?: string[]
}
