export type DiscordDefaults = {
  discord_callback: string;
  discord_client_id: string;
  discord_scopes: string;
};

export type TwitchDefaults = {
  twitch_callback: string;
  twitch_client_id: string;
  twitch_scopes: string;
};

export type PugDefaults = DiscordDefaults &
  TwitchDefaults & {
    base_path: string;
  };

export type OAuth2CallbackQuery = {
  code: string;
  state?: string;
  scope?: string;
};

export type OAuth2CodeExchange = {
  client_id: string;
  client_secret: string;
  grant_type: string;
  code: string;
  redirect_uri: string;
  scope: string;
};

export type OAuth2CodeExchangeResult = {
  access_token: string;
  token_type: string;
  expires_in: number;
  refresh_token: string;
  scope: string;
};

export type TwitchOAuth2ValidateResult = {
  client_id: string;
  login: string;
  scopes: string[];
  user_id: string;
};

export type ModLookupUserTotals = {
  status: number;
  user: string;
  views: number;
  follows: number;
  total: number;
  partners: number;
};

export type HelixGetUsersResult = {
  data: HelixUser[];
};

export type HelixUser = {
  id: string;
  login: string;
  display_name: string;
  type: string;
  broadcaster_type: string;
};
