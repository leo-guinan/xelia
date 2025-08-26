import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from 'plaid';

if (!process.env.PLAID_CLIENT_ID || !process.env.PLAID_SECRET || !process.env.PLAID_ENV) {
  throw new Error("Plaid environment variables are required");
}

const configuration = new Configuration({
  basePath: PlaidEnvironments[process.env.PLAID_ENV as keyof typeof PlaidEnvironments],
  baseOptions: {
    headers: {
      'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID,
      'PLAID-SECRET': process.env.PLAID_SECRET,
    },
  },
});

export const plaidClient = new PlaidApi(configuration);

export const PLAID_PRODUCTS = [Products.Liabilities] as Products[];
export const PLAID_COUNTRY_CODES = [CountryCode.Us] as CountryCode[];