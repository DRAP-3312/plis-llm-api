export interface Candidate {
  uci: string;
  score: number;
  tags: string[];
}

export interface CandidatesResult {
  bestScore: number;
  candidates: Candidate[];
}
