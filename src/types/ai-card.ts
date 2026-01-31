/**
 * AI Card Types for DingTalk
 */

export interface AICardInstance {
  cardInstanceId: string;
  accessToken?: string;
  inputingStarted: boolean;
}

export const AICardStatus = {
  PROCESSING: '1',
  INPUTING: '2',
  FINISHED: '3',
  EXECUTING: '4',
  FAILED: '5',
} as const;

export type AICardStatusValue = (typeof AICardStatus)[keyof typeof AICardStatus];
