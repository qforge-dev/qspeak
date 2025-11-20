import { v4 } from "uuid";

export abstract class Communicator {
  public abstract cast<T = any>(topic: string, data?: T): void;
  public abstract call<T = any, R = any>(topic: string, data: T): Promise<R>;
  public abstract handleCast<T>(topic: string, callback: (message: IMessage<T>) => void): () => void;
  public abstract handleCall<T, R>(topic: string, callback: (message: IMessage<T>) => R | Promise<R>): () => void;

  public static buildMessage = <T = any>(topic: string, data: T, senderId: string, id?: string): IMessage<T> => {
    return {
      id: id ?? v4(),
      topic,
      data,
      senderId,
    };
  };
}

export interface IMessage<T = any> {
  id: string;
  topic: string;
  data: T;
  senderId: string;
}

export type CommunicatorCast<T extends Record<string, any>> = <Topic extends keyof T>(
  topic: Topic,
  data?: T[Topic]["request"],
) => void;

export type CommunicatorCall<T extends Record<string, any>> = <Topic extends keyof T>(
  topic: Topic,
  data?: T[Topic]["request"],
) => Promise<T[Topic]["response"]>;

export type CommunicatorHandleCast<T extends Record<string, any>> = <Topic extends keyof T>(
  topic: Topic,
  callback: (message: IMessage<T[Topic]["request"]>) => void,
) => () => void;

export type CommunicatorHandleCall<T extends Record<string, any>> = <Topic extends keyof T>(
  topic: Topic,
  callback: (message: IMessage<T[Topic]["request"]>) => Promise<T[Topic]["response"]>,
) => () => void;
