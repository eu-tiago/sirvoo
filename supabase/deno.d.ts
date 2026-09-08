declare const Deno: {
  env: {
    get(name: string): string | undefined
  }
  serve(handler: (req: Request) => Promise<Response> | Response): void
}

declare module 'npm:@supabase/supabase-js@2' {
  export function createClient(url: string, key: string, options?: unknown): any
}
