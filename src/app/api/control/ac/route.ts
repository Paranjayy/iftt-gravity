import { NextResponse } from "next/server";
import { controlMiraieAC, getDashboardData } from "../../device-sync/actions";

export async function POST(req: Request) {
  try {
    const { command, deviceId } = await req.json();
    const config = await getDashboardData();
    if (!config.miraie?.devices?.length) return NextResponse.json({ error: "MirAie not linked" }, { status: 400 });

    const targetId = deviceId || config.miraie.devices[0].id;
    let payload: any = {};
    
    if (command === "on") payload.power = true;
    else if (command === "off") payload.power = false;
    else if (!isNaN(Number(command))) payload.temperature = Number(command);
    else payload.mode = command.toUpperCase();

    const res = await controlMiraieAC(targetId, payload);
    return NextResponse.json(res);
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
