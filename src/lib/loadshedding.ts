// ============================================
// GENESIS STUDIO — Load Shedding (EskomSePush)
// ============================================

// EskomSePush API: https://eskomsepush.gumroad.com/l/api
const ESP_API_KEY = process.env.ESKOMSEPUSH_API_KEY || "";
const ESP_BASE_URL = "https://developer.sepush.co.za/business/2.0";

export interface LoadSheddingStatus {
  stage: number; // 0 = no load shedding, 1-8 = stage level
  stageName: string;
  note: string;
  updated: string;
}

export interface AreaSchedule {
  areaName: string;
  events: Array<{
    start: string;
    end: string;
    note: string;
  }>;
  nextEvent?: {
    start: string;
    end: string;
    note: string;
  };
}

/**
 * Get current load shedding stage nationally.
 */
export async function getLoadSheddingStatus(): Promise<LoadSheddingStatus> {
  if (!ESP_API_KEY) {
    return { stage: 0, stageName: "Unknown", note: "EskomSePush API not configured", updated: new Date().toISOString() };
  }

  try {
    const res = await fetch(`${ESP_BASE_URL}/status`, {
      headers: { token: ESP_API_KEY },
      next: { revalidate: 1800 }, // Cache 30 minutes
    });

    if (!res.ok) {
      return { stage: 0, stageName: "Unknown", note: "API unavailable", updated: new Date().toISOString() };
    }

    const data = await res.json();
    const status = data.status?.eskom;
    const stage = parseInt(status?.stage || "0");
    const stageName = stage === 0 ? "No Load Shedding" : `Stage ${stage}`;

    return {
      stage,
      stageName,
      note: status?.stage_updated || "",
      updated: new Date().toISOString(),
    };
  } catch {
    return { stage: 0, stageName: "Unknown", note: "Failed to fetch", updated: new Date().toISOString() };
  }
}

/**
 * Get load shedding schedule for a specific area.
 */
export async function getAreaSchedule(areaId: string): Promise<AreaSchedule | null> {
  if (!ESP_API_KEY || !areaId) return null;

  try {
    const res = await fetch(`${ESP_BASE_URL}/area?id=${encodeURIComponent(areaId)}`, {
      headers: { token: ESP_API_KEY },
      next: { revalidate: 3600 },
    });

    if (!res.ok) return null;

    const data = await res.json();
    const events = (data.events || []).map((e: { start: string; end: string; note: string }) => ({
      start: e.start,
      end: e.end,
      note: e.note || "",
    }));

    const now = new Date();
    const nextEvent = events.find((e: { start: string }) => new Date(e.start) > now);

    return {
      areaName: data.info?.name || areaId,
      events,
      nextEvent,
    };
  } catch {
    return null;
  }
}

/**
 * Search for an area by text query.
 */
export async function searchArea(query: string): Promise<Array<{ id: string; name: string; region: string }>> {
  if (!ESP_API_KEY || !query) return [];

  try {
    const res = await fetch(`${ESP_BASE_URL}/areas_search?text=${encodeURIComponent(query)}`, {
      headers: { token: ESP_API_KEY },
    });

    if (!res.ok) return [];
    const data = await res.json();

    return (data.areas || []).map((a: { id: string; name: string; region: string }) => ({
      id: a.id,
      name: a.name,
      region: a.region,
    }));
  } catch {
    return [];
  }
}
