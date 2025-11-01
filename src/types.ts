export type TokenProvider = () => Promise<string>;

export interface BuilderIdToken {
  access_token: string;
  expires_at: string;
  refresh_token?: string;
  region: string;
  start_url: string;
  oauth_flow: string;
  scopes: string[];
}

export interface DeviceRegistration {
  client_id: string;
  client_secret: string;
  client_secret_expires_at?: string;
  region: string;
  oauth_flow: string;
  scopes: string[];
}

export interface StartDeviceAuthorizationResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete: string;
  expires_in: number;
  interval: number;
}
