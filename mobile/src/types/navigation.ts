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
};

export type ServicesStackParamList = {
  BrowseServices: undefined;
  ServiceDetail:  { id: string };
  BookService:    { serviceId: string; pkg: 'basic' | 'standard' | 'premium' };
  MyServices:     undefined;
  MyBundles:      undefined;
};

export type MessagesStackParamList = {
  ConversationList: undefined;
  MessageThread:    { conversationId: string; recipientName?: string };
};

export type ProfileStackParamList = {
  MyProfile:         undefined;
  EditProfile:       undefined;
  Verification:      undefined;
  Settings:          undefined;
  DiscoverySettings: undefined;
  Notifications:     undefined;
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
