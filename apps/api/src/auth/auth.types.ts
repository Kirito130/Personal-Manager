export type AuthUser = {
  id: string;
  email: string;
};

export type RequestWithUser = {
  user: AuthUser;
};
