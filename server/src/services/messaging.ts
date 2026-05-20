/** Messaging provider abstraction — console dev provider + env-configurable stub */

export interface SendMessageInput {
  to: string;
  subject?: string;
  body: string;
  channel?: "sms" | "email" | "whatsapp";
}

export interface SendMessageResult {
  success: boolean;
  providerRef?: string;
  error?: string;
}

export interface MessagingProvider {
  name: string;
  send(input: SendMessageInput): Promise<SendMessageResult>;
}

/** Logs to console — default for development */
export class ConsoleMessagingProvider implements MessagingProvider {
  name = "console";

  async send(input: SendMessageInput): Promise<SendMessageResult> {
    console.log(`[Messaging:${input.channel ?? "sms"}] → ${input.to}`);
    if (input.subject) console.log(`  Subject: ${input.subject}`);
    console.log(`  Body: ${input.body.slice(0, 200)}${input.body.length > 200 ? "…" : ""}`);
    return { success: true, providerRef: `console-${Date.now()}` };
  }
}

/** Stub for real SMS/WhatsApp — configure via MESSAGING_PROVIDER env */
export class StubExternalProvider implements MessagingProvider {
  name: string;

  constructor(name: string) {
    this.name = name;
  }

  async send(input: SendMessageInput): Promise<SendMessageResult> {
    const apiKey = process.env.MESSAGING_API_KEY;
    if (!apiKey) {
      return { success: false, error: `${this.name} not configured (set MESSAGING_API_KEY)` };
    }
    // Production: call Twilio / Africa's Talking / etc.
    return { success: true, providerRef: `${this.name}-stub-${Date.now()}` };
  }
}

import { IntegrationMessagingProvider } from "./integration-runtime";

export function getMessagingProvider(): MessagingProvider {
  return new IntegrationMessagingProvider();
}
