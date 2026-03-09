import { NavigatorScreenParams } from '@react-navigation/native';

export type AuthStackParamList = {
  Welcome:         undefined;
  Login:           { redirectTo?: string } | undefined;
  Register:        { ref?: string } | undefined;
  ForgotPassword:  undefined;
};

export type JobsStackParamList = {
  BrowseJobs:        undefined;
  JobDetail:         { id: string };
  PostJob:           undefined;
  MyJobs:            undefined;
  ProposalDetail:    { id: string; jobId: string };
  JobProposals:      { jobId: string; jobTitle?: string };
  JobProgress:       { jobId: string; jobTitle?: string };
  BrowseFreelancers: undefined;
  FreelancerProfile: { id?: string; username?: string };
};

export type ServicesStackParamList = {
  BrowseServices:        undefined;
  ServiceDetail:         { id: string };
  BookService:           { serviceId: string; pkg: 'basic' | 'standard' | 'premium' };
  MyServices:            undefined;
  MyBundles:             undefined;
  CreateService:         undefined;
  AvailabilityManager:   { serviceId: string };
  ServiceOrderProgress:  { serviceId: string; orderId: string; serviceTitle?: string };
};

export type MessagesStackParamList = {
  ConversationList: undefined;
  MessageThread: {
    conversationId: string;
    recipientName?: string;
    /** _id of the other participant — required to initiate a call */
    recipientId?: string;
    /** Optional: pre-populated for the call button */
    recipientFirstName?: string;
    recipientLastName?: string;
  };
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
  Offers:            undefined;
  Referrals:         undefined;
  Bookings:          undefined;
  BookingDetail:     { id: string };
  GroupSlots:        { serviceId: string };
  EscrowConfirm:     { jobId?: string; orderId?: string; amount: number; freelancerName: string; title: string };
  TipScreen:         { jobId: string; freelancerName: string; freelancerId: string };
  WriteReview:       { jobId?: string; orderId?: string; serviceId?: string; targetName: string; targetId: string };
  ReviewList:        { freelancerId?: string; serviceId?: string; targetName: string };
  Disputes:          undefined;
  DisputeDetail:     { disputeId: string };
  FileDispute:       { jobId?: string; orderId?: string };
  Boosts:            undefined;
  Analytics:         undefined;
};

export type MoreStackParamList = {
  More:       undefined;
  Referrals:  undefined;
  JobAlerts:  undefined;
  Analytics:  undefined;
};

export type SearchStackParamList = {
  UniversalSearch: undefined;
};

export type MainTabParamList = {
  Home:     undefined;
  Jobs:     NavigatorScreenParams<JobsStackParamList>;
  Search:   NavigatorScreenParams<SearchStackParamList>;
  Services: NavigatorScreenParams<ServicesStackParamList>;
  Messages: NavigatorScreenParams<MessagesStackParamList>;
  Profile:  NavigatorScreenParams<ProfileStackParamList>;
};

export type RootStackParamList = {
  Auth: NavigatorScreenParams<AuthStackParamList>;
  Main: NavigatorScreenParams<MainTabParamList>;
};


