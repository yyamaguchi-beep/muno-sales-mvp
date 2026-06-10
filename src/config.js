export const config = {
  appBaseUrl: process.env.APP_BASE_URL,
  sessionSecret: process.env.APP_SESSION_SECRET,
  adminPassword: process.env.ADMIN_PASSWORD,

  lineChannelSecret: process.env.LINE_CHANNEL_SECRET,
  lineChannelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN,

  openaiApiKey: process.env.OPENAI_API_KEY,

  googleSheetsSpreadsheetId: process.env.GOOGLE_SHEETS_SPREADSHEET_ID,
  googleServiceAccountEmail: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
  googlePrivateKeyBase64: process.env.GOOGLE_PRIVATE_KEY_BASE64,
};
