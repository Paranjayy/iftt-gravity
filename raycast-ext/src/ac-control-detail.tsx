import { List, ActionPanel, Action, showToast, Toast, Icon, Color } from "@raycast/api";
import { useState, useEffect } from "react";
import fetch from "node-fetch";

interface DeviceStatus {
  ts?: string;
  rssi?: number;
  ty?: string;
  ps?: string;
  actmp?: string;
  acfs?: string;
  acmd?: string;
  acvs?: number | string;
  achs?: number | string;
  rmtmp?: string;
  mo?: string;
  V?: string;
  actm?: [number, number];
}

interface MiraieDevice {
  deviceId: string;
  deviceName: string;
  homeId: string;
  status?: DeviceStatus;
}

interface HubState {
  online: boolean;
  uptime: number;
  stats?: {
    acMinutes?: number;
    ac?: {
      status: string;
      lastChanged: number;
      prevDuration?: string;
    };
  };
  ac_duration?: string;
  miraie?: {
    devices: MiraieDevice[];
  } | null;
}

export default function ACControlDetail() {
  const [state, setState] = useState<HubState | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    try {
      const res = await fetch("http://127.0.0.1:3030/status");
      const data = await res.json();
      setState(data as HubState);
      setError(null);
    } catch (e) {
      setError("Hub Offline");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    refresh();
    const timer = setInterval(refresh, 5000);
    return () => clearInterval(timer);
  }, []);

  async function runAction(name: string, endpoint: string) {
    const toast = await showToast({ style: Toast.Style.Animated, title: `Pulsing: ${name}...` });
    try {
      const res = await fetch(`http://127.0.0.1:3030${endpoint}`);
      if (!res.ok) throw new Error("Failed");
      toast.style = Toast.Style.Success;
      toast.title = `Confirmed: ${name}`;
      await refresh();
    } catch (e) {
      toast.style = Toast.Style.Failure;
      toast.title = "Action Failed";
      toast.message = "Hub Offline";
    }
  }

  // Get first AC device
  const device = state?.miraie?.devices?.[0];
  const acStatus = device?.status;

  // Format Helper Functions
  const getPowerStr = (ps?: string) => {
    if (!ps) return "Standby";
    return ps.toUpperCase() === "ON" ? "ON" : "OFF";
  };

  const getPowerColor = (ps?: string) => {
    if (!ps) return Color.Red;
    return ps.toLowerCase() === "on" ? Color.Green : Color.Red;
  };

  const getModeStr = (mode?: string) => {
    if (!mode) return "Unknown";
    return mode.charAt(0).toUpperCase() + mode.slice(1).toLowerCase();
  };

  const getFanSpeedStr = (speed?: string) => {
    if (!speed) return "Unknown";
    const speedStr = String(speed).toLowerCase();
    if (speedStr === "auto" || speedStr === "4") return "Auto";
    if (speedStr === "low" || speedStr === "1") return "Low";
    if (speedStr === "medium" || speedStr === "2" || speedStr === "med") return "Medium";
    if (speedStr === "high" || speedStr === "3") return "High";
    if (speedStr === "quiet" || speedStr === "5") return "Quiet";
    return speedStr.charAt(0).toUpperCase() + speedStr.slice(1);
  };

  const getVSwingStr = (swing?: number | string) => {
    if (swing === undefined) return "Unknown";
    const num = Number(swing);
    const map: Record<number, string> = {
      0: "Auto",
      1: "Up",
      2: "Position 2",
      3: "Position 3",
      4: "Position 4",
      5: "Down"
    };
    return map[num] || String(swing);
  };

  const getHSwingStr = (swing?: number | string) => {
    if (swing === undefined) return "Unknown";
    const num = Number(swing);
    const map: Record<number, string> = {
      0: "Auto",
      1: "Center",
      2: "Left",
      3: "Position 3",
      4: "Position 4",
      5: "Right"
    };
    return map[num] || String(swing);
  };

  const getPresetStr = (status?: DeviceStatus) => {
    if (!status) return "None";
    if (status.acpm === "on") return "Powerful";
    if (status.acem === "on") return "Eco";
    if (status.acec === "on") return "Clean";
    return "None";
  };

  const getTimerRemainingStr = (timestamp?: number) => {
    if (!timestamp || timestamp === -1) return "Not Set";
    const diffMs = (timestamp * 1000) - Date.now();
    if (diffMs <= 0) return "Not Set";
    const mins = Math.round(diffMs / 60000);
    const h = Math.floor(mins / 60);
    const m = mins % 60;
    return h > 0 ? `${h}h ${m}m remaining` : `${m}m remaining`;
  };

  const getTimerDateStr = (timestamp?: number) => {
    if (!timestamp || timestamp === -1) return "Not Set";
    const date = new Date(timestamp * 1000);
    return date.toLocaleString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false });
  };

  const calculateAcCost = (minutes: number) => {
    const units = (minutes / 60) * 1.65;
    let energyCharge = 0;
    if (units <= 50) energyCharge = units * 3.05;
    else if (units <= 100) energyCharge = (50 * 3.05) + (units - 50) * 3.50;
    else if (units <= 250) energyCharge = (50 * 3.05) + (50 * 3.50) + (units - 100) * 4.10;
    else energyCharge = (50 * 3.05) + (50 * 3.50) + (150 * 4.10) + (units - 250) * 4.60;
    
    const fpppa = units * 2.85;
    const subtotal = energyCharge + fpppa;
    const duty = subtotal * 0.15;
    const cost = subtotal + duty;
    return { units, cost };
  };

  const acMinutes = state?.stats?.acMinutes || 0;
  const { units: acUnits, cost: acCost } = calculateAcCost(acMinutes);

  // Commands Layout
  const commands = [
    {
      section: "General Controls",
      items: [
        {
          id: "power",
          title: acStatus?.ps === "on" ? "Turn Power OFF" : "Turn Power ON",
          icon: Icon.Power,
          endpoint: acStatus?.ps === "on" ? "/control/ac/off" : "/control/ac/on",
          name: acStatus?.ps === "on" ? "AC Off" : "AC On"
        },
        {
          id: "temp-up",
          title: "Temperature UP (+1°C)",
          icon: Icon.ChevronUp,
          endpoint: "/control/temp?dir=up",
          name: "Temp Up"
        },
        {
          id: "temp-down",
          title: "Temperature DOWN (-1°C)",
          icon: Icon.ChevronDown,
          endpoint: "/control/temp?dir=down",
          name: "Temp Down"
        }
      ]
    },
    {
      section: "HVAC Modes",
      items: [
        { id: "mode-cool", title: "Cool Mode", icon: Icon.Snowflake, endpoint: "/control/ac/mode?mode=cool", name: "Cool Mode" },
        { id: "mode-auto", title: "Auto Mode", icon: Icon.RotateClockwise, endpoint: "/control/ac/mode?mode=auto", name: "Auto Mode" },
        { id: "mode-dry", title: "Dry Mode", icon: Icon.Raindrop, endpoint: "/control/ac/mode?mode=dry", name: "Dry Mode" },
        { id: "mode-fan", title: "Fan Mode", icon: Icon.Circle, endpoint: "/control/ac/mode?mode=fan", name: "Fan Mode" },
        { id: "mode-heat", title: "Heat Mode", icon: Icon.Sun, endpoint: "/control/ac/mode?mode=heat", name: "Heat Mode" }
      ]
    },
    {
      section: "Fan Speeds",
      items: [
        { id: "fan-auto", title: "Auto Fan Speed", icon: Icon.RotateClockwise, endpoint: "/control/ac/set?acfs=auto", name: "Fan Auto" },
        { id: "fan-low", title: "Low Fan Speed", icon: Icon.StackedBars1, endpoint: "/control/ac/set?acfs=low", name: "Fan Low" },
        { id: "fan-medium", title: "Medium Fan Speed", icon: Icon.StackedBars2, endpoint: "/control/ac/set?acfs=medium", name: "Fan Medium" },
        { id: "fan-high", title: "High Fan Speed", icon: Icon.StackedBars3, endpoint: "/control/ac/set?acfs=high", name: "Fan High" },
        { id: "fan-quiet", title: "Quiet Fan Speed", icon: Icon.SpeakerOff, endpoint: "/control/ac/set?acfs=quiet", name: "Fan Quiet" }
      ]
    },
    {
      section: "Aesthetic Presets",
      items: [
        { id: "preset-tv", title: "TV Mode (Cool & Quiet)", icon: Icon.Video, endpoint: "/control/ac_tv", name: "TV Mode" },
        { id: "preset-powerful", title: "Powerful Boost Mode", icon: Icon.Bolt, endpoint: "/control/ac/powerful?ps=on", name: "Powerful Mode" },
        { id: "preset-eco", title: "Eco Mode (26°C)", icon: Icon.Leaf, endpoint: "/control/ac/set?acem=on&acpm=off&acec=off&actmp=26&cnv=0", name: "Eco Mode" },
        { id: "preset-clean", title: "Filter Clean Mode", icon: Icon.Eraser, endpoint: "/control/ac/set?acem=off&acpm=off&acec=on&cnv=0", name: "Clean Mode" },
        { id: "preset-none", title: "Clear Preset (Standard)", icon: Icon.RotateAntiClockwise, endpoint: "/control/ac/set?acem=off&acpm=off&acec=off&cnv=0", name: "Clear Preset" }
      ]
    },
    {
      section: "Vertical Swing",
      items: [
        { id: "swing-toggle", title: "Toggle Swing Mode", icon: Icon.Repeat, endpoint: "/control/ac/swing", name: "Swing Toggle" },
        { id: "swing-auto", title: "Auto Vertical Swing", icon: Icon.ChevronUpDown, endpoint: "/control/ac/set?acvs=0", name: "Swing Auto" },
        { id: "swing-up", title: "Position 1 (Up)", icon: Icon.ArrowUp, endpoint: "/control/ac/set?acvs=1", name: "Swing Up" },
        { id: "swing-down", title: "Position 5 (Down)", icon: Icon.ArrowDown, endpoint: "/control/ac/set?acvs=5", name: "Swing Down" }
      ]
    },
    {
      section: "Off Timer Scheduler",
      items: [
        { id: "timer-30m", title: "Turn Off in 30 Minutes", icon: Icon.Clock, endpoint: "/control/ac/timer?mins=30", name: "Off Timer 30m" },
        { id: "timer-1h", title: "Turn Off in 1 Hour", icon: Icon.Clock, endpoint: "/control/ac/timer?mins=60", name: "Off Timer 1h" },
        { id: "timer-2h", title: "Turn Off in 2 Hours", icon: Icon.Clock, endpoint: "/control/ac/timer?mins=120", name: "Off Timer 2h" },
        { id: "timer-3h", title: "Turn Off in 3 Hours", icon: Icon.Clock, endpoint: "/control/ac/timer?mins=180", name: "Off Timer 3h" },
        { id: "timer-clear", title: "Clear Active Timer", icon: Icon.Xmark, endpoint: "/control/ac/timer?mins=0", name: "Clear Timer" }
      ]
    }
  ];

  return (
    <List
      isLoading={isLoading}
      isShowingDetail={true}
      searchBarPlaceholder="Execute AC Precision command..."
    >
      {commands.map((group) => (
        <List.Section key={group.section} title={group.section}>
          {group.items.map((item) => (
            <List.Item
              key={item.id}
              title={item.title}
              icon={item.icon}
              actions={
                <ActionPanel>
                  <Action
                    title={item.title}
                    icon={item.icon}
                    onAction={() => runAction(item.name, item.endpoint)}
                  />
                  <Action
                    title="Force Refresh State"
                    icon={Icon.Repeat}
                    shortcut={{ modifiers: ["cmd"], key: "r" }}
                    onAction={refresh}
                  />
                </ActionPanel>
              }
              detail={
                <List.Item.Detail
                  metadata={
                    <List.Item.Detail.Metadata>
                      <List.Item.Detail.Metadata.TagList title="Device Status">
                        {error ? (
                          <List.Item.Detail.Metadata.TagList.Item text={error.toUpperCase()} color={Color.Red} />
                        ) : (
                          <List.Item.Detail.Metadata.TagList.Item
                            text={device?.status ? "ONLINE" : "OFFLINE"}
                            color={device?.status ? Color.Green : Color.Red}
                          />
                        )}
                      </List.Item.Detail.Metadata.TagList>

                      <List.Item.Detail.Metadata.TagList title="AC Power">
                        <List.Item.Detail.Metadata.TagList.Item
                          text={getPowerStr(acStatus?.ps)}
                          color={getPowerColor(acStatus?.ps)}
                        />
                      </List.Item.Detail.Metadata.TagList>

                      <List.Item.Detail.Metadata.Separator />
                      
                      <List.Item.Detail.Metadata.Label title="Telemetry Status" />
                      <List.Item.Detail.Metadata.Label
                        title="Set Temperature"
                        text={acStatus?.actmp ? `${parseFloat(acStatus.actmp).toFixed(0)}°C` : "--"}
                      />
                      <List.Item.Detail.Metadata.Label
                        title="HVAC Mode"
                        text={getModeStr(acStatus?.acmd)}
                      />
                      <List.Item.Detail.Metadata.Label
                        title="Fan Speed"
                        text={getFanSpeedStr(acStatus?.acfs)}
                      />
                      <List.Item.Detail.Metadata.Label
                        title="Active Preset"
                        text={getPresetStr(acStatus)}
                      />
                      <List.Item.Detail.Metadata.Label
                        title="Vertical Swing"
                        text={getVSwingStr(acStatus?.acvs)}
                      />
                      <List.Item.Detail.Metadata.Label
                        title="Horizontal Swing"
                        text={getHSwingStr(acStatus?.achs)}
                      />
                      <List.Item.Detail.Metadata.Label
                        title="Room Temperature"
                        text={acStatus?.rmtmp ? `${parseFloat(acStatus.rmtmp).toFixed(1)}°C` : "--"}
                      />

                      <List.Item.Detail.Metadata.Separator />
                      
                      <List.Item.Detail.Metadata.Label title="Off Timer Status" />
                      <List.Item.Detail.Metadata.Label
                        title="Time Remaining"
                        text={getTimerRemainingStr(acStatus?.actm?.[0])}
                      />
                      <List.Item.Detail.Metadata.Label
                        title="Scheduled Off Time"
                        text={getTimerDateStr(acStatus?.actm?.[0])}
                      />

                      <List.Item.Detail.Metadata.Separator />

                      <List.Item.Detail.Metadata.Label title="GERC Slab Energy Billing" />
                      <List.Item.Detail.Metadata.Label
                        title="Uptime Today"
                        text={acMinutes > 0 ? `${Math.floor(acMinutes / 60)}h ${acMinutes % 60}m` : "0m"}
                      />
                      <List.Item.Detail.Metadata.Label
                        title="Energy Consumed"
                        text={`${acUnits.toFixed(2)} kWh`}
                      />
                      <List.Item.Detail.Metadata.Label
                        title="Incremental Cost"
                        text={`₹${acCost.toFixed(2)}`}
                      />

                      <List.Item.Detail.Metadata.Separator />

                      <List.Item.Detail.Metadata.Label title="Hardware Properties" />
                      <List.Item.Detail.Metadata.Label title="Name" text={device?.deviceName || "Panasonic AC"} />
                      <List.Item.Detail.Metadata.Label title="Device ID" text={device?.deviceId || "--"} />
                      <List.Item.Detail.Metadata.Label title="Model ID" text={acStatus?.mo || "--"} />
                      <List.Item.Detail.Metadata.Label title="Firmware" text={acStatus?.V || "--"} />
                      <List.Item.Detail.Metadata.Label
                        title="Signal RSSI"
                        text={acStatus?.rssi ? `${acStatus.rssi} dBm` : "--"}
                      />
                    </List.Item.Detail.Metadata>
                  }
                />
              }
            />
          ))}
        </List.Section>
      ))}
    </List>
  );
}
