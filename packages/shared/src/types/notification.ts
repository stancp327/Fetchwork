export interface Notification {
  _id: string;
  title: string;
  message: string;
  link?: string;
  type: string;
  read: boolean;
  recipient: string;
  createdAt: string;
}
