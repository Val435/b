declare global {
  namespace Express {
    interface Request {
      user?: {
        id?: number;
        email?: string;
        phone?: string;
        countryCode?: string;
        isNewUser?: boolean;
      };
    }
  }
}

export {};