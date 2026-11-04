import type { InputByte } from '@kb/shared';

export interface InputSource {
  read(): [InputByte, InputByte];
  dispose(): void;
}
