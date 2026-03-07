import client from '../client';

export type LocationMode = 'remote' | 'at_freelancer' | 'at_client' | 'flexible';

export interface TimeWindow {
  startTime: string; // HH:MM
  endTime:   string;
}

export interface DaySchedule {
  dayOfWeek: number; // 0 = Sunday
  windows:   TimeWindow[];
}

export interface ServiceAvailabilityData {
  timezone:              string;
  slotDuration:          number;
  bufferTime:            number;
  capacity:              number;
  minNoticeHours:        number;
  maxAdvanceBookingDays: number;
  weeklySchedule:        DaySchedule[];
  isActive:              boolean;
}

export interface ResolvedAvailability extends ServiceAvailabilityData {
  isOverride: boolean;
}

export interface ServiceLocation {
  mode:         LocationMode;
  address:      string;
  travelRadius: number;
  notes:        string;
}

export interface ServiceAvailabilityResponse {
  availability:    ResolvedAvailability | null;
  serviceLocation: ServiceLocation | null;
}

export const availabilityApi = {
  getServiceAvailability: (serviceId: string): Promise<ServiceAvailabilityResponse> =>
    client.get(`/api/availability/service/${serviceId}`).then(r => r.data),

  updateServiceOverride: (serviceId: string, data: ServiceAvailabilityData): Promise<void> =>
    client.put(`/api/availability/service/${serviceId}`, data).then(r => r.data),

  deleteServiceOverride: (serviceId: string): Promise<void> =>
    client.delete(`/api/availability/service/${serviceId}/override`).then(r => r.data),

  updateServiceLocation: (serviceId: string, data: ServiceLocation): Promise<void> =>
    client.put(`/api/availability/service/${serviceId}/location`, data).then(r => r.data),
};
