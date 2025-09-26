// Global type declarations
declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        email: string;
        name?: string;
        phone?: string;
        countryCode?: string;
        state?: string;
        city?: string;
        environment?: string;
        education1?: string[];
        education2?: string[];
        family?: string[];
        employment1?: string[];
        employment2?: string[];
        socialLife?: string[];
        hobbies?: string[];
        transportation?: string[];
        pets?: string[];
        greenSpace?: string[];
        shopping?: string[];
        restaurants?: string[];
        occupancy?: string;
        property?: string;
        timeframe?: string;
        priceRange?: string;
        downPayment?: string;
        employmentStatus?: string;
        grossAnnual?: string;
        credit?: string;
        createdAt?: Date;
        updatedAt?: Date;
        isNewUser?: boolean;
      };
    }
  }
}

export {};