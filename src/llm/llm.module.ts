import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { LlmService } from './services/llm.service';
import { OpenAiLlmClient } from './clients/openai-llm.client';
import { LLM_CLIENT, LlmClient } from './clients/llm-client.interface';

@Module({
  providers: [
    LlmService,
    OpenAiLlmClient,
    {
      provide: LLM_CLIENT,
      inject: [ConfigService, OpenAiLlmClient],
      useFactory: (
        configService: ConfigService,
        openAiClient: OpenAiLlmClient,
      ): LlmClient => {
        const provider = configService.get<string>('LLM_PROVIDER');
        switch (provider) {
          case 'openai':
            return openAiClient;
          // Sumar un proveedor nuevo (ej. 'anthropic') es: crear su
          // AnthropicLlmClient implementando LlmClient, agregarlo a
          // `providers` arriba, e inyectarlo aquí con un case más.
          default:
            throw new Error(`Unsupported LLM_PROVIDER: ${String(provider)}`);
        }
      },
    },
  ],
  exports: [LlmService],
})
export class LlmModule {}
