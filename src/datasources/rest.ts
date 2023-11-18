import { Datasource } from "./interface";

const tryParseJson = (string) => {
  try {
    return JSON.parse(string);
  } catch (e) {
    return string;
  }
};

// TODO: pagination stuffz
export const createRestDatasource = <Shape extends object>(
  baseUrl: string,
  path: string,
): Datasource<Shape> => {
  const url = `${baseUrl}/${path}`;
  return {
    async get(id: string): Promise<Shape> {
      const response = await fetch(`${url}/${id}`);
      const textResult = await response.text();
      const result = tryParseJson(textResult);
      if (response.status > 299) {
        // TODO: better errors
        throw new Error(result);
      } else {
        return result;
      }
    },
    async list(_limit: number, page: number): Promise<{ nodes: Shape[] }> {
      const response = await fetch(`${url}?page=${page}`);
      const textResult = await response.text();
      const result = tryParseJson(textResult);
      if (response.status > 299) {
        // TODO: better errors
        throw new Error(result);
      } else {
        return { nodes: result.results };
      }
    },
  };
};
