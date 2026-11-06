import type { Request, Response } from 'express';
import appPromise from '../server';

export default async function handler(req: Request, res: Response) {
  const app = await appPromise;
  return app(req, res);
}
