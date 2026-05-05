const API_URL = import.meta.env.VITE_API_URL || "";

export function authHeaders(token) {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function throwApiError(res, fallbackMessage) {
  const text = await res.text().catch(() => "");
  let message = fallbackMessage;

  if (text) {
    try {
      const data = JSON.parse(text);
      message = data.message || data.error || data.reason || fallbackMessage;
    } catch {
      message = text;
    }
  }

  const error = new Error(message);
  error.status = res.status;
  throw error;
}

function normalizeParkingSlot(slot) {
  if (!slot) return null;

  return {
    ...slot,
    slotDate: slot.slotDate,
    parkingCapacity: slot.parkingCapacity,
    parkingRate: slot.parkingRate,
    availableSpaces: slot.availableSpaces ?? slot.parkingCapacity,
  };
}

function normalizeParkingReservation(reservation) {
  if (!reservation) return null;

  return {
    ...reservation,
    parkingSlotId: reservation.parkingSlotId,
    parkingSlotTitle: reservation.parkingSlotTitle,
    slotDate: reservation.slotDate,
    reservedSpaces: reservation.reservedSpaces,
  };
}

function normalizeAdminStats(stats) {
  if (!stats) return null;

  return {
    ...stats,
    totalParkingSlots: stats.totalParkingSlots ?? 0,
    confirmedParkingReservations: stats.confirmedParkingReservations ?? 0,
    cancelledParkingReservations: stats.cancelledParkingReservations ?? 0,
    parkingRevenue: stats.parkingRevenue ?? 0,
  };
}

function normalizeUserDetails(userDetails) {
  if (!userDetails) return null;

  const parkingReservations = (userDetails.parkingReservations ?? [])
    .map((reservation) => ({
      ...reservation,
      parkingSlotTitle: reservation.parkingSlotTitle,
      reservedSpaces: reservation.reservedSpaces,
    }));

  return {
    ...userDetails,
    parkingReservations,
  };
}

function normalizeEvent(event) {
  if (!event) return null;

  return {
    ...event,
    parkingRequired: event.parkingRequired ?? false,
    parkingSlotId: event.parkingSlotId ?? null,
    parkingPrice: event.parkingPrice ?? null,
    parkingCapacity: event.parkingCapacity ?? null,
    parkingAvailableSpaces: event.parkingAvailableSpaces ?? event.parkingCapacity ?? null,
  };
}

function serializeParkingReservationPayload(payload) {
  const { parkingSlotId, reservedSpaces, ...rest } = payload;

  return {
    ...rest,
    parkingSlotId,
    reservedSpaces,
  };
}

function serializeParkingSlotPayload(payload) {
  const { slotDate, parkingCapacity, parkingRate, ...rest } = payload;

  return {
    ...rest,
    slotDate,
    parkingCapacity,
    parkingRate,
  };
}

function serializeEventPayload(payload) {
  const {
    parkingRequired,
    parkingPrice,
    parkingCapacity,
    ...rest
  } = payload;

  return {
    ...rest,
    parkingRequired,
    parkingPrice,
    parkingCapacity,
  };
}

function serializeEventRegistrationPayload(payload) {
  const { addParking, reservedSpaces, ...rest } = payload;

  return {
    ...rest,
    addParking,
    reservedSpaces,
  };
}

async function handleResponse(res, defaultMessage) {
  if (res.ok) {
    try {
      return await res.json();
    } catch {
      return null;
    }
  }

  let message = defaultMessage;
  try {
    const data = await res.json();
    if (data?.message) message = data.message;
    else if (data?.error) message = data.error;
    else if (typeof data === "string") message = data;
  } catch {
    try {
      const text = await res.text();
      if (text) message = text;
    } catch {
      message = defaultMessage;
    }
  }

  const lowerDefault = (defaultMessage || "").toLowerCase();
  const isReservation = lowerDefault.includes("réservation") || lowerDefault.includes("reservation");

  if (!message || message === defaultMessage) {
    if (res.status === 409 && isReservation) {
      message = "Cet espace est déjà réservé sur ce créneau. Merci de choisir un autre horaire.";
    } else if (res.status === 403 && isReservation) {
      message = "Accès refusé pour cette réservation : vérifiez le créneau ou reconnectez-vous.";
    } else if (res.status === 400 && isReservation) {
      message = "Réservation refusée : horaires ou paiement invalides pour ce créneau.";
    }
  }

  throw new Error(message);
}

async function fetchParkingSlotsResponse() {
  const res = await fetch(`${API_URL}/api/public/parking/sessions`);
  if (!res.ok) throw new Error("Erreur lors du chargement des sessions");
  return res.json();
}

async function postParkingReservation(payload, token) {
  const res = await fetch(`${API_URL}/api/public/parking/reservations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token),
    },
    body: JSON.stringify(payload),
  });
  return handleResponse(res, "Erreur lors de la réservation parking");
}

async function fetchMyParkingReservationsResponse(token) {
  const res = await fetch(`${API_URL}/api/public/parking/reservations/me`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Impossible de récupérer les réservations");
  return res.json();
}

async function deleteParkingReservationRequest(id, token) {
  const res = await fetch(`${API_URL}/api/public/parking/reservations/${id}/cancel`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  return handleResponse(res, "Erreur lors de l'annulation");
}

async function fetchAdminParkingSlotsResponse(token) {
  const res = await fetch(`${API_URL}/api/admin/parking/sessions`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Erreur récupération sessions (admin)");
  return res.json();
}

async function fetchAdminParkingSlotResponse(id, token) {
  const res = await fetch(`${API_URL}/api/admin/parking/sessions/${id}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Session introuvable");
  return res.json();
}

async function postAdminParkingSlot(payload, token) {
  const res = await fetch(`${API_URL}/api/admin/parking/sessions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token),
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Erreur création session (admin)");
  return res.json();
}

async function putAdminParkingSlot(id, payload, token) {
  const res = await fetch(`${API_URL}/api/admin/parking/sessions/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token),
    },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Erreur modification session (admin)");
  return res.json();
}

async function deleteAdminParkingSlotRequest(id, token) {
  const res = await fetch(`${API_URL}/api/admin/parking/sessions/${id}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Erreur suppression session (admin)");
}

async function fetchAdminParkingReservationsResponse(token) {
  const res = await fetch(`${API_URL}/api/admin/reservations/parking`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Erreur récupération réservations parking (admin)");
  return res.json();
}

export async function loginRequest(email, password) {
  const res = await fetch(`${API_URL}/api/auth/login`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });
  if (!res.ok) {
    if (res.status === 403) {
      // Get the status message from the response
      const text = await res.text();
      if (text.includes("BANNED")) {
        throw new Error("ACCOUNT_BANNED");
      } else if (text.includes("DELETED")) {
        throw new Error("ACCOUNT_DELETED");
      } else if (text.includes("INACTIVE")) {
        throw new Error("ACCOUNT_INACTIVE");
      }
      throw new Error("ACCOUNT_SUSPENDED");
    }
    throw new Error("Email ou mot de passe incorrect");
  }
  return res.json();
}

export async function registerRequest(data) {
  const res = await fetch(`${API_URL}/api/auth/register`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Erreur d'inscription");
  return res.json();
}

export async function forgotPasswordRequest(email) {
  const res = await fetch(`${API_URL}/api/auth/forgot-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email }),
  });
  if (!res.ok) throw new Error("Erreur lors de l'envoi de l'email");
  return res.json();
}

export async function resetPasswordRequest(token, newPassword) {
  const res = await fetch(`${API_URL}/api/auth/reset-password`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ token, newPassword }),
  });
  if (!res.ok) throw new Error("Erreur lors de la réinitialisation du mot de passe");
  return res.json();
}

export async function logoutRequest(token) {
  const res = await fetch(`${API_URL}/api/auth/logout`, {
    method: "POST",
    headers: authHeaders(token),
  });
  // Don't throw on error - logout should succeed client-side even if server fails
  return res.ok;
}

export async function getEspaces() {
  const res = await fetch(`${API_URL}/api/public/espaces`);
  if (!res.ok) throw new Error("Erreur lors du chargement des espaces");
  return res.json();
}

export async function getEspaceReservationsForCalendar(espaceId, year, month) {
  const res = await fetch(`${API_URL}/api/public/reservations/espace/${espaceId}/calendar?year=${year}&month=${month}`);
  if (!res.ok) throw new Error("Erreur lors du chargement des réservations");
  return res.json();
}

export async function getReservationsByUser(id, token) {
  const res = await fetch(`${API_URL}/api/public/reservations/user/${id}`, {
    headers: authHeaders(token),
  });
  return handleResponse(res, "Impossible de récupérer les réservations");
}

export async function getMyReservations(token) {
  const res = await fetch(`${API_URL}/api/public/reservations/me`, {
    headers: authHeaders(token),
  });
  return handleResponse(res, "Impossible de récupérer les réservations");
}

export async function createReservation(payload, token) {
  const res = await fetch(`${API_URL}/api/public/reservations`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token),
    },
    body: JSON.stringify(payload),
  });
  return handleResponse(res, "Erreur lors de la création de la réservation");
}

export async function cancelReservation(id, token) {
  const res = await fetch(`${API_URL}/api/public/reservations/${id}/cancel`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  return handleResponse(res, "Erreur lors de l'annulation");
}

export async function requestPremiumRoomReservation(payload, token) {
  const res = await fetch(`${API_URL}/api/public/reservations/premium-room`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token),
    },
    body: JSON.stringify(payload),
  });
  return handleResponse(res, "Erreur lors de la demande de réservation");
}

export async function payApprovedReservation(id, paymentIntentId, token) {
  const res = await fetch(`${API_URL}/api/public/reservations/${id}/pay`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token),
    },
    body: JSON.stringify({ paymentIntentId }),
  });
  return handleResponse(res, "Erreur lors du paiement de la réservation");
}

export async function getPublicEvents() {
  const res = await fetch(`${API_URL}/api/public/events`);
  if (!res.ok) throw new Error("Erreur lors du chargement des événements");
  const events = await res.json();
  return events.map(normalizeEvent);
}

export async function registerToEvent(payload, token) {
  const res = await fetch(`${API_URL}/api/public/events/register`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token),
    },
    body: JSON.stringify(serializeEventRegistrationPayload(payload)),
  });
  return handleResponse(res, "Erreur lors de l'inscription");
}

export async function getMyEventRegistrations(token) {
  const res = await fetch(`${API_URL}/api/public/events/registrations/me`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Impossible de récupérer les inscriptions");
  return res.json();
}

export async function cancelEventRegistration(id, token) {
  const res = await fetch(`${API_URL}/api/public/events/registrations/${id}/cancel`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  return handleResponse(res, "Erreur lors de l'annulation");
}

export async function getParkingSlots() {
  const slots = await fetchParkingSlotsResponse();
  return slots.map(normalizeParkingSlot);
}

export async function getParkingSlot(id) {
  const slots = await getParkingSlots();
  return slots.find((slot) => slot.id === Number(id)) || null;
}

export async function createParkingReservation(payload, token) {
  return postParkingReservation(serializeParkingReservationPayload(payload), token);
}

export async function getMyParkingReservations(token) {
  const reservations = await fetchMyParkingReservationsResponse(token);
  return reservations.map(normalizeParkingReservation);
}

export async function cancelParkingReservation(id, token) {
  return deleteParkingReservationRequest(id, token);
}

export async function getMyProfile(token) {
  const res = await fetch(`${API_URL}/api/user/me`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Erreur chargement profil");
  return res.json();
}

export async function updateMyProfile(data, token) {
  const res = await fetch(`${API_URL}/api/user/me`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token),
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Erreur mise à jour profil");
  return res.json();
}

export async function changeMyPassword(data, token) {
  const res = await fetch(`${API_URL}/api/user/change-password`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token),
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Erreur changement mot de passe");
}

export async function adminGetEspaces(token) {
  const res = await fetch(`${API_URL}/api/admin/espaces`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Erreur récupération espaces (admin)");
  return res.json();
}

export async function adminGetEspace(id, token) {
  const res = await fetch(`${API_URL}/api/admin/espaces/${id}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Espace introuvable");
  return res.json();
}

export async function adminCreateEspace(data, token) {
  const res = await fetch(`${API_URL}/api/admin/espaces`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token),
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Erreur création espace (admin)");
  return res.json();
}

export async function adminUpdateEspace(id, data, token) {
  const res = await fetch(`${API_URL}/api/admin/espaces/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token),
    },
    body: JSON.stringify(data),
  });
  if (!res.ok) throw new Error("Erreur modification espace (admin)");
  return res.json();
}

export async function adminDeleteEspace(id, token) {
  const res = await fetch(`${API_URL}/api/admin/espaces/${id}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Erreur suppression espace (admin)");
}

export async function adminGetEvents(token) {
  const res = await fetch(`${API_URL}/api/admin/events`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Erreur récupération événements (admin)");
  const events = await res.json();
  return events.map(normalizeEvent);
}

export async function adminCreateEvent(data, token) {
  const res = await fetch(`${API_URL}/api/admin/events`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token),
    },
    body: JSON.stringify(serializeEventPayload(data)),
  });
  if (!res.ok) throw new Error("Erreur création événement (admin)");
  return res.json();
}

export async function adminUpdateEvent(id, data, token) {
  const res = await fetch(`${API_URL}/api/admin/events/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token),
    },
    body: JSON.stringify(serializeEventPayload(data)),
  });
  if (!res.ok) throw new Error("Erreur modification événement (admin)");
  return res.json();
}

export async function adminDeleteEvent(id, token) {
  const res = await fetch(`${API_URL}/api/admin/events/${id}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Erreur suppression événement (admin)");
}

export async function adminGetParkingSlots(token) {
  const slots = await fetchAdminParkingSlotsResponse(token);
  return slots.map(normalizeParkingSlot);
}

export async function adminGetParkingSlot(id, token) {
  const slot = await fetchAdminParkingSlotResponse(id, token);
  return normalizeParkingSlot(slot);
}

export async function adminCreateParkingSlot(payload, token) {
  return postAdminParkingSlot(serializeParkingSlotPayload(payload), token);
}

export async function adminUpdateParkingSlot(id, payload, token) {
  return putAdminParkingSlot(id, serializeParkingSlotPayload(payload), token);
}

export async function adminDeleteParkingSlot(id, token) {
  return deleteAdminParkingSlotRequest(id, token);
}

export async function adminGetAllReservations(token) {
  const res = await fetch(`${API_URL}/api/admin/reservations/all`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Erreur récupération réservations (admin)");
  return res.json();
}

export async function adminGetAllSpaceReservations(token) {
  const res = await fetch(`${API_URL}/api/admin/reservations/spaces`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Erreur récupération réservations espaces (admin)");
  return res.json();
}

export async function adminGetAllEventRegistrations(token) {
  const res = await fetch(`${API_URL}/api/admin/reservations/events`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Erreur récupération inscriptions événements (admin)");
  return res.json();
}

export async function adminGetAllParkingReservations(token) {
  const reservations = await fetchAdminParkingReservationsResponse(token);
  return reservations.map(normalizeParkingReservation);
}

export async function adminGetStats(token) {
  const res = await fetch(`${API_URL}/api/admin/stats`, {
    headers: authHeaders(token),
  });
  if (!res.ok) await throwApiError(res, "Erreur récupération statistiques");
  const stats = await res.json();
  return normalizeAdminStats(stats);
}

export async function adminGetPendingReservations(token) {
  const res = await fetch(`${API_URL}/api/admin/reservations/pending`, {
    headers: authHeaders(token),
  });
  if (!res.ok) await throwApiError(res, "Erreur récupération réservations en attente");
  return res.json();
}

export async function adminApproveReservation(id, approved, rejectionReason, token) {
  const res = await fetch(`${API_URL}/api/admin/reservations/${id}/approve`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token),
    },
    body: JSON.stringify({ approved, rejectionReason }),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || "Erreur approbation réservation");
  }
  return res.json();
}

export async function organizerCreateEvent(data, token) {
  const res = await fetch(`${API_URL}/api/organizer/events`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token),
    },
    body: JSON.stringify(serializeEventPayload(data)),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || "Erreur création événement");
  }
  return res.json();
}

export async function organizerGetMyEvents(token) {
  const res = await fetch(`${API_URL}/api/organizer/events/my`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Erreur récupération événements");
  const events = await res.json();
  return events.map(normalizeEvent);
}

export async function organizerGetMyEvent(id, token) {
  const res = await fetch(`${API_URL}/api/organizer/events/my/${id}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Événement introuvable");
  const event = await res.json();
  return normalizeEvent(event);
}

export async function organizerUpdateMyEvent(id, data, token) {
  const res = await fetch(`${API_URL}/api/organizer/events/my/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token),
    },
    body: JSON.stringify(serializeEventPayload(data)),
  });
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.message || "Erreur modification événement");
  }
  return res.json();
}

export async function organizerCancelMyEvent(id, token) {
  const res = await fetch(`${API_URL}/api/organizer/events/my/${id}`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Erreur annulation événement");
}

export async function adminGetPendingEvents(token) {
  const res = await fetch(`${API_URL}/api/admin/events/pending`, {
    headers: authHeaders(token),
  });
  if (!res.ok) await throwApiError(res, "Erreur récupération événements en attente");
  return res.json();
}

export async function adminApproveEvent(id, approved, rejectionReason, token) {
  const res = await fetch(`${API_URL}/api/admin/events/${id}/approve`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token),
    },
    body: JSON.stringify({ approved, rejectionReason }),
  });
  if (!res.ok) throw new Error("Erreur approbation événement");
  return res.json();
}

export async function adminGetUsers(token) {
  const res = await fetch(`${API_URL}/api/admin/users`, {
    headers: authHeaders(token),
  });
  if (!res.ok) await throwApiError(res, "Erreur récupération utilisateurs");
  return res.json();
}

export async function adminUpdateUserRole(id, role, token) {
  const res = await fetch(`${API_URL}/api/admin/users/${id}/role`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token),
    },
    body: JSON.stringify({ role }),
  });
  if (!res.ok) throw new Error("Erreur modification rôle utilisateur");
  return res.json();
}

export async function adminUpdateUserStatus(id, status, token) {
  const res = await fetch(`${API_URL}/api/admin/users/${id}/status`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...authHeaders(token),
    },
    body: JSON.stringify({ status }),
  });
  if (!res.ok) throw new Error("Erreur modification statut utilisateur");
  return res.json();
}

export async function adminBanUser(id, token) {
  const res = await fetch(`${API_URL}/api/admin/users/${id}/ban`, {
    method: "POST",
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Erreur lors du bannissement de l'utilisateur");
  return res.json();
}

export async function adminReactivateUser(id, token) {
  const res = await fetch(`${API_URL}/api/admin/users/${id}/reactivate`, {
    method: "POST",
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Erreur lors de la réactivation de l'utilisateur");
  return res.json();
}

export async function adminGetUserDetails(id, token) {
  const res = await fetch(`${API_URL}/api/admin/users/${id}/details`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Erreur récupération détails utilisateur");
  const userDetails = await res.json();
  return normalizeUserDetails(userDetails);
}

export async function deleteMyAccount(token) {
  const res = await fetch(`${API_URL}/api/user/me`, {
    method: "DELETE",
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Erreur lors de la suppression du compte");
  return true;
}

// Audit Logs
export async function adminGetAuditLogs(token, page = 0, size = 20) {
  const res = await fetch(`${API_URL}/api/admin/audit?page=${page}&size=${size}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Erreur récupération logs d'audit");
  return res.json();
}

export async function adminGetAuditLogsFiltered(token, filters = {}, page = 0, size = 20) {
  const params = new URLSearchParams({ page, size });
  if (filters.userId) params.append("userId", filters.userId);
  if (filters.action) params.append("action", filters.action);
  if (filters.entityType) params.append("entityType", filters.entityType);
  if (filters.startDate) params.append("startDate", filters.startDate);
  if (filters.endDate) params.append("endDate", filters.endDate);

  const res = await fetch(`${API_URL}/api/admin/audit/filter?${params}`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Erreur récupération logs d'audit filtrés");
  return res.json();
}

export async function adminGetAuditActions(token) {
  const res = await fetch(`${API_URL}/api/admin/audit/actions`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Erreur récupération actions d'audit");
  return res.json();
}

export async function adminGetAuditEntityTypes(token) {
  const res = await fetch(`${API_URL}/api/admin/audit/entity-types`, {
    headers: authHeaders(token),
  });
  if (!res.ok) throw new Error("Erreur récupération types d'entités");
  return res.json();
}
