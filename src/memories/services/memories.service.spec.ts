import { MemoriesService } from './memories.service';
import { MemoriesRepository } from '../repositories/memories.repository';

describe('MemoriesService', () => {
  it('getRelevantMemories forwards the current games count for the reuse filter', async () => {
    const calls: unknown[] = [];
    const memoriesRepository = {
      findRelevantForPlayer: (...args: unknown[]) => {
        calls.push(args);
        return Promise.resolve([]);
      },
    } as unknown as MemoriesRepository;

    await new MemoriesService(memoriesRepository).getRelevantMemories(
      'player-1',
      7,
    );

    expect(calls).toEqual([['player-1', 7, 3]]);
  });

  it('markManyUsed marks every memory with the same games-count snapshot', async () => {
    const calls: unknown[] = [];
    const memoriesRepository = {
      markUsed: (...args: unknown[]) => {
        calls.push(args);
        return Promise.resolve();
      },
    } as unknown as MemoriesRepository;

    await new MemoriesService(memoriesRepository).markManyUsed(
      ['mem-1', 'mem-2'],
      9,
    );

    expect(calls).toEqual([
      ['mem-1', 9],
      ['mem-2', 9],
    ]);
  });
});
