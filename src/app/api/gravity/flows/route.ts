import { NextResponse } from 'next/server';
import fs from 'fs/promises';
import path from 'path';

const configPath = path.join(process.cwd(), 'config.json');

type Flow = {
  id: string;
  name: string;
  trigger: string;
  action: 'scene' | 'speak' | 'ac_off';
  params?: Record<string, unknown>;
  enabled?: boolean;
  updatedAt?: string;
};

async function readConfig() {
  try {
    return JSON.parse(await fs.readFile(configPath, 'utf8'));
  } catch {
    return {};
  }
}

export async function GET() {
  const config = await readConfig();
  return NextResponse.json({ flows: config.zapit_flows ?? [] });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null) as Partial<Flow> | null;
  const trigger = body?.trigger?.trim().toLowerCase();
  const name = body?.name?.trim();
  const action = body?.action;
  if (!name || !trigger || !action || !['scene', 'speak', 'ac_off'].includes(action)) {
    return NextResponse.json({ error: 'A name, trigger, and supported action are required.' }, { status: 400 });
  }

  const config = await readConfig();
  const flow: Flow = {
    id: body.id || `flow-${crypto.randomUUID().slice(0, 8)}`,
    name,
    trigger,
    action,
    params: body.params ?? {},
    enabled: body.enabled !== false,
    updatedAt: new Date().toISOString(),
  };
  const flows: Flow[] = Array.isArray(config.zapit_flows) ? config.zapit_flows : [];
  const index = flows.findIndex((item) => item.id === flow.id || item.trigger === flow.trigger);
  if (index >= 0) flows[index] = flow;
  else flows.push(flow);
  config.zapit_flows = flows;
  await fs.writeFile(configPath, JSON.stringify(config, null, 2));
  return NextResponse.json({ flow, flows });
}
