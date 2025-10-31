import {
  SSOOIDCClient,
  RegisterClientCommand,
  StartDeviceAuthorizationCommand,
  CreateTokenCommand,
} from '@aws-sdk/client-sso-oidc';
import { readFile, writeFile, mkdir } from 'fs/promises';
import { existsSync } from 'fs';
import { join } from 'path';
import { homedir } from 'os';
import type {
  BuilderIdToken,
  DeviceRegistration,
  StartDeviceAuthorizationResponse,
} from './types.js';

const OIDC_REGION = 'us-east-1';
const START_URL = 'https://view.awsapps.com/start';
const SCOPES = ['codewhisperer:completions', 'codewhisperer:analysis', 'codewhisperer:conversations'];
const CLIENT_NAME = 'codewhisperer-openai-proxy';

const CONFIG_DIR = join(homedir(), '.codewhisperer-proxy');
const TOKEN_FILE = join(CONFIG_DIR, 'tokens.json');
const REGISTRATION_FILE = join(CONFIG_DIR, 'registration.json');

export class AuthManager {
  private client: SSOOIDCClient;
  private region: string;

  constructor(region: string = OIDC_REGION) {
    this.region = region;
    this.client = new SSOOIDCClient({
      region: this.region,
    });
  }

  private async ensureConfigDir(): Promise<void> {
    if (!existsSync(CONFIG_DIR)) {
      await mkdir(CONFIG_DIR, { recursive: true });
    }
  }

  private isExpired(expiresAt: string): boolean {
    const expirationTime = new Date(expiresAt);
    const now = new Date();
    const oneMinuteFromNow = new Date(now.getTime() + 60 * 1000);
    return oneMinuteFromNow >= expirationTime;
  }

  private async loadRegistration(): Promise<DeviceRegistration | null> {
    try {
      const data = await readFile(REGISTRATION_FILE, 'utf-8');
      const registration: DeviceRegistration = JSON.parse(data);

      if (registration.client_secret_expires_at) {
        const isExpired = this.isExpired(registration.client_secret_expires_at);
        const regionMatches = registration.region === this.region;

        if (!isExpired && regionMatches) {
          return registration;
        }
      }

      return null;
    } catch (error) {
      return null;
    }
  }

  private async saveRegistration(
    registration: DeviceRegistration
  ): Promise<void> {
    await this.ensureConfigDir();
    await writeFile(REGISTRATION_FILE, JSON.stringify(registration, null, 2));
  }

  private async loadToken(): Promise<BuilderIdToken | null> {
    try {
      const data = await readFile(TOKEN_FILE, 'utf-8');
      const token: BuilderIdToken = JSON.parse(data);
      return token;
    } catch (error) {
      return null;
    }
  }

  private async saveToken(token: BuilderIdToken): Promise<void> {
    await this.ensureConfigDir();
    await writeFile(TOKEN_FILE, JSON.stringify(token, null, 2));
  }

  private async deleteToken(): Promise<void> {
    try {
      const { unlink } = await import('fs/promises');
      await unlink(TOKEN_FILE);
    } catch (error) {
      // Ignore if file doesn't exist
    }
  }

  async registerClient(): Promise<DeviceRegistration> {
    let registration = await this.loadRegistration();
    if (registration) {
      return registration;
    }

    const command = new RegisterClientCommand({
      clientName: CLIENT_NAME,
      clientType: 'public',
      scopes: SCOPES,
    });

    const response = await this.client.send(command);

    registration = {
      client_id: response.clientId!,
      client_secret: response.clientSecret!,
      client_secret_expires_at: response.clientSecretExpiresAt
        ? new Date(response.clientSecretExpiresAt * 1000).toISOString()
        : undefined,
      region: this.region,
      oauth_flow: 'DeviceCode',
      scopes: SCOPES,
    };

    await this.saveRegistration(registration);
    return registration;
  }

  async startDeviceAuthorization(): Promise<StartDeviceAuthorizationResponse> {
    const registration = await this.registerClient();

    const command = new StartDeviceAuthorizationCommand({
      clientId: registration.client_id,
      clientSecret: registration.client_secret,
      startUrl: START_URL,
    });

    const response = await this.client.send(command);

    return {
      device_code: response.deviceCode!,
      user_code: response.userCode!,
      verification_uri: response.verificationUri!,
      verification_uri_complete: response.verificationUriComplete!,
      expires_in: response.expiresIn!,
      interval: response.interval!,
    };
  }

  async pollForToken(deviceCode: string): Promise<BuilderIdToken> {
    const registration = await this.registerClient();

    const command = new CreateTokenCommand({
      clientId: registration.client_id,
      clientSecret: registration.client_secret,
      grantType: 'urn:ietf:params:oauth:grant-type:device_code',
      deviceCode: deviceCode,
    });

    const response = await this.client.send(command);

    const token: BuilderIdToken = {
      access_token: response.accessToken!,
      expires_at: new Date(
        Date.now() + response.expiresIn! * 1000
      ).toISOString(),
      refresh_token: response.refreshToken,
      region: this.region,
      start_url: START_URL,
      oauth_flow: 'DeviceCode',
      scopes: SCOPES,
    };

    await this.saveToken(token);
    return token;
  }

  async refreshToken(token: BuilderIdToken): Promise<BuilderIdToken | null> {
    if (!token.refresh_token) {
      await this.deleteToken();
      return null;
    }

    const registration = await this.loadRegistration();
    if (!registration || registration.oauth_flow !== token.oauth_flow) {
      return null;
    }

    try {
      const command = new CreateTokenCommand({
        clientId: registration.client_id,
        clientSecret: registration.client_secret,
        grantType: 'refresh_token',
        refreshToken: token.refresh_token,
      });

      const response = await this.client.send(command);

      const newToken: BuilderIdToken = {
        access_token: response.accessToken!,
        expires_at: new Date(
          Date.now() + response.expiresIn! * 1000
        ).toISOString(),
        refresh_token: response.refreshToken || token.refresh_token,
        region: token.region,
        start_url: token.start_url,
        oauth_flow: token.oauth_flow,
        scopes: token.scopes,
      };

      await this.saveToken(newToken);
      return newToken;
    } catch (error) {
      await this.deleteToken();
      throw error;
    }
  }

  async getValidToken(): Promise<BuilderIdToken | null> {
    let token = await this.loadToken();
    if (!token) {
      return null;
    }

    if (this.isExpired(token.expires_at)) {
      token = await this.refreshToken(token);
    }

    return token;
  }

  async authenticate(): Promise<BuilderIdToken> {
    const existingToken = await this.getValidToken();
    if (existingToken) {
      return existingToken;
    }

    const authResponse = await this.startDeviceAuthorization();

    console.log('\n=== AWS Builder ID Authentication ===');
    console.log(`\nPlease visit: ${authResponse.verification_uri_complete}`);
    console.log(`\nOr go to: ${authResponse.verification_uri}`);
    console.log(`And enter code: ${authResponse.user_code}\n`);

    const interval = authResponse.interval * 1000;
    const expiresAt = Date.now() + authResponse.expires_in * 1000;

    while (Date.now() < expiresAt) {
      await new Promise((resolve) => setTimeout(resolve, interval));

      try {
        const token = await this.pollForToken(authResponse.device_code);
        console.log('✓ Authentication successful!\n');
        return token;
      } catch (error: any) {
        if (error.name === 'AuthorizationPendingException') {
          continue;
        }
        if (error.name === 'SlowDownException') {
          await new Promise((resolve) => setTimeout(resolve, 5000));
          continue;
        }
        throw error;
      }
    }

    throw new Error('Device authorization expired. Please try again.');
  }
}
