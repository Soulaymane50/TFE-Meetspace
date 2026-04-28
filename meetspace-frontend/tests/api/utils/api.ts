import { APIRequestContext, expect } from "@playwright/test";

const API_URL = process.env.API_URL || "http://localhost:8080";

async function ensureOk(res: any) {
  if (!res.ok()) {
    let body = "";
    try {
      body = await res.text();
    } catch {
      body = "<no body>";
    }
    throw new Error(`HTTP ${res.status()}: ${body}`);
  }
}

export async function loginToken(request: APIRequestContext, email: string, password: string) {
  const res = await request.post(`${API_URL}/api/auth/login`, {
    data: { email, password },
  });
  await ensureOk(res);
  const json = await res.json();
  return json.token as string;
}

function authHeaders(token: string) {
  return { Authorization: `Bearer ${token}` };
}

export async function adminCreateEspace(request: APIRequestContext, token: string, name: string) {
  const res = await request.post(`${API_URL}/api/admin/espaces`, {
    headers: authHeaders(token),
    data: {
      name,
      type: "SALLE",
      capacity: 100,
      basePrice: 25.0,
      status: "AVAILABLE",
    },
  });
  await ensureOk(res);
  return await res.json();
}

export async function adminDeleteEspace(request: APIRequestContext, token: string, id: number) {
  const res = await request.delete(`${API_URL}/api/admin/espaces/${id}`, {
    headers: authHeaders(token),
  });
  await ensureOk(res);
}

export async function adminGetUsers(request: APIRequestContext, token: string) {
  const res = await request.get(`${API_URL}/api/admin/users`, {
    headers: authHeaders(token),
  });
  await ensureOk(res);
  return await res.json();
}

export async function adminUpdateUserRole(request: APIRequestContext, token: string, id: number, role: string) {
  const res = await request.put(`${API_URL}/api/admin/users/${id}/role`, {
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token),
    },
    data: { role },
  });
  await ensureOk(res);
  return await res.json();
}

export async function adminEnsureRole(request: APIRequestContext, adminToken: string, email: string, role: string) {
  const users = await adminGetUsers(request, adminToken);
  const user = users.find((u: any) => u.email === email);
  if (!user) {
    throw new Error(`User ${email} not found to set role ${role}`);
  }
  if (user.role !== role) {
    await adminUpdateUserRole(request, adminToken, user.id, role);
    const refreshed = await adminGetUsers(request, adminToken);
    const u2 = refreshed.find((u: any) => u.email === email);
    if (!u2 || u2.role !== role) {
      throw new Error(`Failed to set role ${role} for ${email}, current=${u2?.role}`);
    }
  }
}

export async function adminCreateEvent(
  request: APIRequestContext,
  token: string,
  title: string,
  start: string,
  end: string,
  spaceId: number
) {
  const res = await request.post(`${API_URL}/api/admin/events`, {
    headers: authHeaders(token),
    data: {
      title,
      description: "E2E test event description",
      startDateTime: start,
      endDateTime: end,
      capacity: 50,
      price: 0,
      status: "PUBLISHED",
      locationType: "EXISTING_SPACE",
      spaceId,
      location: "Test location",
    },
  });
  await ensureOk(res);
  return await res.json();
}

export async function adminDeleteEvent(request: APIRequestContext, token: string, id: number) {
  const res = await request.delete(`${API_URL}/api/admin/events/${id}`, {
    headers: authHeaders(token),
  });
  await ensureOk(res);
}

export async function adminCreateParkingSlot(request: APIRequestContext, token: string, title: string, date: string) {
  const res = await request.post(`${API_URL}/api/admin/parking/sessions`, {
    headers: authHeaders(token),
    data: {
      title,
      description: "E2E parking slot",
      slotDate: date,
      startTime: "09:00:00",
      endTime: "11:00:00",
      parkingCapacity: 30,
      parkingRate: 5.0,
      status: "OPEN",
    },
  });
  await ensureOk(res);
  return await res.json();
}

export async function adminDeleteParkingSlot(request: APIRequestContext, token: string, id: number) {
  const res = await request.delete(`${API_URL}/api/admin/parking/sessions/${id}`, {
    headers: authHeaders(token),
  });
  await ensureOk(res);
}

export async function userRegisterEvent(request: APIRequestContext, token: string, payload: any) {
  const res = await request.post(`${API_URL}/api/public/events/register`, {
    headers: authHeaders(token),
    data: payload,
  });
  await ensureOk(res);
  return await res.json();
}

export async function organizerCreateEvent(
  request: APIRequestContext,
  token: string,
  title: string,
  start: string,
  end: string,
  spaceId: number
) {
  const res = await request.post(`${API_URL}/api/organizer/events`, {
    headers: authHeaders(token),
    data: {
      title,
      description: "E2E organizer event",
      startDateTime: start,
      endDateTime: end,
      capacity: 30,
      price: 0,
      status: "PENDING_APPROVAL",
      locationType: "EXISTING_SPACE",
      spaceId,
      location: "Organizer location",
    },
  });
  await ensureOk(res);
  return await res.json();
}

export async function adminApproveEvent(request: APIRequestContext, token: string, id: number) {
  const res = await request.post(`${API_URL}/api/admin/events/${id}/approve`, {
    headers: authHeaders(token),
    data: { approved: true, rejectionReason: null },
  });
  await ensureOk(res);
  return await res.json();
}

export function isoDateTime(hoursFromNow: number) {
  const d = new Date(Date.now() + hoursFromNow * 3600 * 1000);
  return d.toISOString().split(".")[0];
}

export function isoDate(daysFromNow: number) {
  const d = new Date(Date.now() + daysFromNow * 24 * 3600 * 1000);
  return d.toISOString().split("T")[0];
}
