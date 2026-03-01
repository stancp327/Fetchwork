import { LinkingOptions } from '@react-navigation/native';
import { RootStackParamList } from '../types/navigation';

export const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['fetchwork://', 'https://fetchwork.net'],
  config: {
    screens: {
      Auth: {
        screens: {
          Login:          'login',
          Register:       'register',
          ForgotPassword: 'forgot-password',
        },
      },
      Main: {
        screens: {
          Home: 'home',
          Jobs: {
            screens: {
              BrowseJobs: 'jobs',
              JobDetail:  'jobs/:id',
              PostJob:    'post-job',
              MyJobs:     'my-jobs',
            },
          },
          Services: {
            screens: {
              BrowseServices: 'services',
              ServiceDetail:  'services/:id',
            },
          },
          Messages: {
            screens: {
              ConversationList: 'messages',
              MessageThread:    'messages/:conversationId',
            },
          },
          Profile: {
            screens: {
              MyProfile:    'profile',
              EditProfile:  'profile/edit',
              Verification: 'profile/verification',
            },
          },
        },
      },
    },
  },
};
