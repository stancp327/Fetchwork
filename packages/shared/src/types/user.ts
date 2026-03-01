export type UserRole = 'client' | 'freelancer';
export type VerificationLevel = 'none' | 'email' | 'phone' | 'identity' | 'full';
export type BadgeType = 'email_verified' | 'id_verified' | 'top_rated' | 'bg_checked';
export type AvailabilityStatus = 'available' | 'busy' | 'away' | 'offline';

export interface UserLocation {
  locationType: 'remote' | 'local' | 'both';
  city?: string;
  state?: string;
  country?: string;
  zipCode?: string;
}

export interface User {
  _id: string;
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  profilePicture?: string;
  headline?: string;
  bio?: string;
  skills?: string[];
  hourlyRate?: number;
  rating?: number;
  totalReviews?: number;
  completedJobs?: number;
  totalEarnings?: number;
  isEmailVerified?: boolean;
  isVerified?: boolean;
  verificationLevel?: VerificationLevel;
  badges?: BadgeType[];
  availabilityStatus?: AvailabilityStatus;
  avgResponseTime?: number;
  location?: UserLocation;
  isAdmin?: boolean;
  createdAt?: string;
}
