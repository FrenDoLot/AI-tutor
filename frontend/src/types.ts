export type Attachment = {
  id?: string;
  userId?: string;
  chatId?: string;
  messageId?: string;
  name: string;
  type: string;
  size: number;
  createdAt?: string;
  filePath?: string | null;
};

export type Message = {
  id: string;
  userId?: string;
  chatId?: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
  attachments?: Attachment[];
};

export type Chat = {
  id: string;
  userId?: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: Message[];
};

export type UserSettings = {
  theme: "dark" | string;
  language: string;
  answerLength: "short" | "balanced" | "deep" | string;
  simpleLanguage: boolean;
  moreExamples: boolean;
  morePractice: boolean;
  autoTitle: boolean;
};

export type MessageUsage = {
  used: number;
  limit: number;
  remaining: number;
  warningAfter: number;
  showWarning: boolean;
  resetDate: string;
};

export type User = {
  id: string;
  email: string;
  name: string;
  avatar?: string | null;
  role: "admin" | "user";
  plan: string;
  subscriptionUntil: string;
  mustChangePassword: boolean;
  subscriptionActive: boolean;
  messageUsage: MessageUsage;
  settings: UserSettings;
};

export type AuthResponse = {
  token: string;
  user: User;
};

export type AdminUser = {
  id: string;
  email: string;
  name: string;
  role: "admin" | "user";
  plan: string;
  subscriptionUntil: string;
  mustChangePassword: boolean;
  createdAt: string;
};

export type AdminCreateUserResponse = {
  user: AdminUser;
  temporaryPassword: string;
};

export type AdminLimits = {
  dailyMessageLimit: number;
  warningAfterMessages: number;
};
