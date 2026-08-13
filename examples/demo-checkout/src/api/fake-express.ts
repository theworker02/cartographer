/** Minimal stand-in so the fixture parses without real Express. */
export type Req = { body?: { total?: number }; params: { id: string } };
export type Res = { json: (v: unknown) => void };

type Handler = (req: Req, res: Res) => void;

export function Router() {
  const routes: Array<{ method: string; path: string; handler: Handler }> = [];
  return {
    post(path: string, handler: Handler) {
      routes.push({ method: "POST", path, handler });
    },
    get(path: string, handler: Handler) {
      routes.push({ method: "GET", path, handler });
    },
    _routes: routes,
  };
}
