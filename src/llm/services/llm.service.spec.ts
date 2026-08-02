import { ConfigService } from '@nestjs/config';
import { LlmService } from './llm.service';
import { LlmValidatorService } from './llm-validator.service';
import {
  LlmClient,
  LlmNetworkError,
  LlmServerError,
} from '../clients/llm-client.interface';
import { BuiltPrompt } from '../llm.types';

function fakeConfig(values: Record<string, number>): ConfigService {
  return { get: (key: string) => values[key] } as unknown as ConfigService;
}

const prompt: BuiltPrompt = {
  system: 'system prompt',
  user: 'user prompt',
  hadActivePrediction: false,
};

function buildService(client: LlmClient, timeoutMs = 50): LlmService {
  return new LlmService(
    client,
    fakeConfig({ LLM_TIMEOUT_MS: timeoutMs, LLM_MAX_TOKENS: 200 }),
    new LlmValidatorService(),
  );
}

describe('LlmService', () => {
  it('forces silence with reason "timeout" when the client never resolves in time', async () => {
    const client: LlmClient = { complete: () => new Promise(() => {}) };
    const result = await buildService(client).getResponse(prompt);
    expect(result).toMatchObject({
      chosenCandidate: 0,
      comment: null,
      read: null,
      degradationLevel: 1,
      failureReason: 'timeout',
    });
  });

  it('classifies LlmServerError as "5xx"', async () => {
    const client: LlmClient = {
      complete: () => Promise.reject(new LlmServerError('boom')),
    };
    const result = await buildService(client).getResponse(prompt);
    expect(result.degradationLevel).toBe(1);
    expect(result.failureReason).toBe('5xx');
  });

  it('classifies LlmNetworkError as "network_error"', async () => {
    const client: LlmClient = {
      complete: () => Promise.reject(new LlmNetworkError('boom')),
    };
    const result = await buildService(client).getResponse(prompt);
    expect(result.failureReason).toBe('network_error');
  });

  it('classifies any other thrown error as "network_error"', async () => {
    const client: LlmClient = {
      complete: () => Promise.reject(new Error('weird provider error')),
    };
    const result = await buildService(client).getResponse(prompt);
    expect(result.failureReason).toBe('network_error');
  });

  it('delegates a successful raw response to LlmValidatorService', async () => {
    const client: LlmClient = {
      complete: () =>
        Promise.resolve({
          text: JSON.stringify({
            chosenCandidate: 2,
            skipComment: true,
            skipRead: true,
          }),
          tokensUsed: 42,
        }),
    };
    const result = await buildService(client).getResponse(prompt);
    expect(result.chosenCandidate).toBe(2);
    expect(result.degradationLevel).toBe(0);
    expect(result.failureReason).toBeNull();
  });

  it('never throws even when the client throws synchronously', async () => {
    const client: LlmClient = {
      complete: () => {
        throw new Error('sync boom');
      },
    };
    await expect(
      buildService(client).getResponse(prompt),
    ).resolves.toBeDefined();
  });
});
