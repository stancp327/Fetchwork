export type ServiceType = 'one_time' | 'recurring';
export type BillingCycle = 'per_session' | 'weekly' | 'monthly';
export type LocationType = 'online' | 'in_person' | 'both';

export interface ServicePackage {
  title: string;
  description: string;
  price: number;
  deliveryTime?: number;
  revisions?: number;
  sessionsIncluded?: number;
}

export interface ServiceRecurring {
  sessionDuration: number;
  billingCycle: BillingCycle;
  sessionsPerCycle?: number;
  locationType: LocationType;
  trialEnabled?: boolean;
  trialPrice?: number;
}

export interface Service {
  _id: string;
  title: string;
  description: string;
  category: string;
  serviceType: ServiceType;
  pricing: {
    basic: ServicePackage;
    standard?: ServicePackage;
    premium?: ServicePackage;
  };
  recurring?: ServiceRecurring;
  freelancer: {
    _id: string;
    firstName: string;
    lastName: string;
    profilePicture?: string;
    rating?: number;
  };
  skills?: string[];
  rating?: number;
  totalOrders?: number;
  totalReviews?: number;
  isFeatured?: boolean;
  status: string;
  createdAt: string;
}
