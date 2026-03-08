import { NavigatorScreenParams } from '@react-navigation/native';

export type AuthStackParamList = {
  Welcome:         undefined;
  Login:           { redirectTo?: string } | undefined;
  Register:        { ref?: string } | undefined;
  ForgotPassword:  undefined;
};

export type JobsStackParamList = {
  BrowseJobs:     undefined;
  JobDetail:      { id: string };
  PostJob:        undefined;
  MyJobs:         undefined;
  ProposalDetail: { id: string; jobId: string };
  JobProposals:   { jobId: string; jobTitle?: string };
  JobProgress:    { jobId: string; jobTitle?: string };
};

export type ServicesStackParamList = {
  BrowseServices:        undefined;
  ServiceDetail:         { id: string };
  BookService:           { serviceId: string; pkg: 'basic' | 'standard' | 'premium' };
  MyServices:            undefined;
  MyBundles:             undefined;
  AvailabilityManager:   { serviceId: string };
  ServiceOrderProgress:  { serviceId: string; orderId: string; serviceTitle?: string };
};

export type MessagesStackParamList = {
  ConversationList: undefined;
  MessageThread:    { conversationId: string; recipientName?: string };
};

export type ProfileStackParamList = {
  Earnings: undefined;
  Skills:   undefined;
  MyProfile:         undefined;
  EditProfile:       undefined;
  Verification:      undefined;
  Settings:          undefined;
  DiscoverySettings: undefined;
  Notifications:     undefined;
  Teams:             undefined;
  TeamDetail:        { teamId: string };
  Wallet:            undefined;
  Payments:          undefined;
  Contracts:         undefined;
  Bookings:          undefined;
  BookingDetail:     { id: string };
  GroupSlots:        { serviceId: string };
  EscrowConfirm:     { jobId?: string; orderId?: string; amount: number; freelancerName: string; title: string };
  TipScreen:         { jobId: string; freelancerName: string; freelancerId: string };
};

export type MoreStackParamList = {
  More:       undefined;
  Referrals:  undefined;
  JobAlerts:  undefined;
  Analytics:  undefined;
};

export type MainTabParamList = {
  Home:     undefined;
  Jobs:     NavigatorScreenParams<JobsStackParamList>;
  Services: NavigatorScreenParams<ServicesStackParamList>;
  Messages: NavigatorScreenParams<MessagesStackParamList>;
  Profile:  NavigatorScreenParams<ProfileStackParamList>;
};

export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Main: NavigatorScreenParams<MainTabParamList>;
};
