import { compare, Operation as OperationType, deepClone, applyPatch } from "fast-json-patch";

export type Operation = OperationType;

export class JsonPatch {
  static compare<T extends object>(obj: T, newState: T): Operation[] {
    return compare(deepClone(obj), deepClone(newState));
  }

  static apply<T extends any>(obj: T, patch: Operation[]): T {
    return applyPatch(deepClone(obj), patch).newDocument;
  }
}
