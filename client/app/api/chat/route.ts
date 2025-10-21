import { google } from "@ai-sdk/google";
import {
  createUIMessageStream,
  createUIMessageStreamResponse,
  streamText,
  generateId,
  convertToModelMessages,
} from "ai";
import { NextRequest } from "next/server";
import { experimental_createMCPClient as createMcpClient } from "ai";

export async function POST(req: NextRequest) {
  const { messages } = await req.json();

  const mcpClient = await createMcpClient({
    transport: {
      type: "sse",
      url: "http://localhost:3001/sse",
    },
  });

  const tools = await mcpClient.tools();

  const stream = createUIMessageStream({
    execute: ({ writer }) => {
      const statusId = generateId();

      writer.write({
        type: "data-status",
        id: statusId,
        data: { status: "call started" },
      });

      const result = streamText({
        model: google("gemini-2.0-flash-lite"),
        messages: convertToModelMessages(messages),
        tools,
        onChunk() {
          writer.write({
            type: "data-status",
            id: statusId,
            data: { status: "streaming", timestamp: Date.now() },
          });
        },
        onFinish() {
          writer.write({
            type: "data-status",
            id: statusId,
            data: { status: "completed" },
          });
          mcpClient.close();
        },
      });

      writer.merge(result.toUIMessageStream());
    },
  });

  return createUIMessageStreamResponse({ stream });
}
