declare module "csv-parser" {
  import { Transform } from "stream";

  interface Options {
    separator?: string;
    newline?: string;
    headers?: string[] | boolean;
    mapHeaders?: (args: { header: string; index: number }) => string | null;
    mapValues?: (args: { header: string; index: number; value: any }) => any;
    skipLines?: number;
    maxRowBytes?: number;
    strict?: boolean;
  }

  export default function csv(options?: Options): Transform;
}