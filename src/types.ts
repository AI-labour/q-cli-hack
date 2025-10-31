export interface BuilderIdToken {
  access_token: string;
  expires_at: string;
  refresh_token?: string;
  region?: string;
  start_url?: string;
  oauth_flow: 'DeviceCode' | 'Pkce';
  scopes?: string[];
}

export interface DeviceRegistration {
  client_id: string;
  client_secret: string;
  client_secret_expires_at?: string;
  region: string;
  oauth_flow: 'DeviceCode' | 'Pkce';
  scopes?: string[];
}

export interface StartDeviceAuthorizationResponse {
  device_code: string;
  user_code: string;
  verification_uri: string;
  verification_uri_complete: string;
  expires_in: number;
  interval: number;
}

export interface EnvironmentVariable {
  key: string;
  value: string;
}

export interface EnvState {
  operating_system?: string;
  current_working_directory?: string;
  environment_variables?: EnvironmentVariable[];
}

export interface GitState {
  status: string;
}

export interface ImageBlock {
  format: 'gif' | 'jpeg' | 'png' | 'webp';
  source: {
    bytes: Uint8Array;
  };
}

export interface ToolSpecification {
  name: string;
  description: string;
  input_schema: {
    json?: any;
  };
}

export interface Tool {
  toolSpecification: ToolSpecification;
}

export interface ToolUse {
  tool_use_id: string;
  name: string;
  input: any;
}

export interface ToolResultContentBlock {
  text?: string;
  json?: any;
}

export interface ToolResult {
  tool_use_id: string;
  content: ToolResultContentBlock[];
  status: 'Success' | 'Error';
}

export interface UserInputMessageContext {
  env_state?: EnvState;
  git_state?: GitState;
  tool_results?: ToolResult[];
  tools?: Tool[];
}

export interface UserInputMessage {
  content: string;
  origin: 'CLI' | 'CHAT';
  user_input_message_context?: UserInputMessageContext;
  user_intent?: 'ApplyCommonBestPractices';
  images?: ImageBlock[];
  model_id?: string;
}

export interface AssistantResponseMessage {
  message_id?: string;
  content: string;
  tool_uses?: ToolUse[];
}

export type ChatMessage =
  | { userInputMessage: UserInputMessage }
  | { assistantResponseMessage: AssistantResponseMessage };

export interface ConversationState {
  conversationId?: string;
  currentMessage: ChatMessage;
  chatTriggerType: 'MANUAL' | 'DIAGNOSTIC' | 'INLINE_CHAT';
  history?: ChatMessage[];
}

export interface GenerateAssistantResponseRequest {
  conversationState: ConversationState;
  profileArn?: string;
  agentMode?: string;
}

export interface AssistantResponseEvent {
  assistantResponseEvent: {
    content: string;
  };
}

export interface CodeEvent {
  codeEvent: {
    content: string;
  };
}

export interface ToolUseEvent {
  toolUseEvent: {
    tool_use_id: string;
    name: string;
    input?: string;
    stop?: boolean;
  };
}

export interface MessageMetadataEvent {
  messageMetadataEvent: {
    conversation_id?: string;
    utterance_id?: string;
  };
}

export interface InvalidStateEvent {
  invalidStateEvent: {
    reason: string;
    message: string;
  };
}

export type CodeWhispererEvent =
  | AssistantResponseEvent
  | CodeEvent
  | ToolUseEvent
  | MessageMetadataEvent
  | InvalidStateEvent
  | { [key: string]: any };

export interface CodeWhispererClientConfig {
  region?: string;
  endpoint?: string;
  tokenProvider: () => Promise<string>;
}
