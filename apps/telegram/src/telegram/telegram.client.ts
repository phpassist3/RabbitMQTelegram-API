import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { AxiosError } from 'axios';
import { firstValueFrom } from 'rxjs';

interface SendMessageOptions {
  parseMode?: 'HTML' | 'MarkdownV2';
  disableWebPagePreview?: boolean;
}

interface TelegramResponse<T> {
  ok: boolean;
  result?: T;
  description?: string;
  error_code?: number;
}

@Injectable()
export class TelegramClient {
  private readonly logger = new Logger(TelegramClient.name);
  private readonly baseUrl: string;

  constructor(
    private readonly http: HttpService,
    config: ConfigService,
  ) {
    const token = config.getOrThrow<string>('telegram.botToken');
    this.baseUrl = `https://api.telegram.org/bot${token}`;
  }

  async sendMessage(chatId: string, text: string, options: SendMessageOptions = {}): Promise<void> {
    const body = {
      chat_id: chatId,
      text,
      parse_mode: options.parseMode ?? 'HTML',
      disable_web_page_preview: options.disableWebPagePreview ?? true,
    };

    try {
      const response = await firstValueFrom(
        this.http.post<TelegramResponse<unknown>>(`${this.baseUrl}/sendMessage`, body),
      );

      if (!response.data?.ok) {
        const code = response.data?.error_code ?? 'unknown';
        const desc = response.data?.description ?? 'no description';
        throw new Error(`telegram api error_code=${code}: ${desc}`);
      }
    } catch (err) {
      if (this.isAxiosError(err)) {
        const status = err.response?.status;
        const data = err.response?.data as TelegramResponse<unknown> | undefined;
        const desc = data?.description ?? err.message;
        // Lift any HTTP-layer failure to a normal Error so the subscriber retries it.
        throw new Error(`telegram api ${status ?? 'network'}: ${desc}`);
      }
      throw err;
    }
  }

  private isAxiosError(err: unknown): err is AxiosError {
    return Boolean(err) && typeof err === 'object' && (err as AxiosError).isAxiosError === true;
  }
}
