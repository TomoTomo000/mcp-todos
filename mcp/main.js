import { Hono } from "hono";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { serve } from "@hono/node-server";
import { z } from "zod";
import { SSETransport } from "hono-mcp-server-sse-transport";
import { streamSSE } from "hono/streaming";
const app = new Hono();
const mcpSearver = new McpServer({
    name: "todo-mcp-server",
    version: "1.0.0",
});
async function addTodoItem(title) {
    try {
        const response = await fetch("http://localhost:8080/todos", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ title }),
        });
        if (!response.ok) {
            console.error(`[addTodoItem] APIサーバーからエラー:,${response.status} ${response.statusText}`);
            return null;
        }
    }
    catch (error) {
        console.error(`[addTodoItem] APIサーバーへのリクエスト中にエラーが発生しました: ${error}`);
        return null;
    }
}
;
mcpSearver.tool("addTodoItem", "Add a new todo item", {
    title: z.string().min(1)
}, async ({ title }) => {
    const todoItem = await addTodoItem(title);
    return {
        content: [
            {
                type: "text",
                text: `${title}を追加しました`
            }
        ]
    };
});
async function deleteTodoItem(id) {
    try {
        console.log(`[deleteTodoItem] APIサーバーにリクエスト: ${id}`);
        const response = await fetch(`http://localhost:8080/todos/${id}`, {
            method: "DELETE",
        });
        if (!response.ok) {
            console.error(`[deleteTodoItem] APIサーバーからエラー: ${response.status} ${response.statusText}`);
            return false;
        }
        return true;
    }
    catch (error) {
        console.error(`[deleteTodoItem] APIサーバーへのリクエスト中にエラーが発生しました: ${error}`);
        return false;
    }
}
;
mcpSearver.tool("deleteTodoItem", "Delete a todo item", {
    id: z.number()
}, async ({ id }) => {
    const success = await deleteTodoItem(id);
    return {
        content: [
            {
                type: "text",
                text: success ? `ID ${id} のTodoアイテムを削除しました` : `ID ${id} のTodoアイテムの削除に失敗しました`
            }
        ]
    };
});
async function updateTodoItem(id, completed) {
    try {
        const response = await fetch(`http://localhost:8080/todos/${id}`, {
            method: "PUT",
            headers: {
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ completed }),
        });
        if (!response.ok) {
            console.error(`[updateTodoItem] APIサーバーからエラー: ${response.status} ${response.statusText}`);
            return false;
        }
        return true;
    }
    catch (error) {
        console.error(`[updateTodoItem] APIサーバーへのリクエスト中にエラーが発生しました: ${error}`);
        return false;
    }
}
;
mcpSearver.tool("updateTodoItem", "Update a todo item", {
    id: z.number(),
    completed: z.boolean()
}, async ({ id, completed }) => {
    const success = await updateTodoItem(id, completed);
    return {
        content: [
            {
                type: "text",
                text: success ? `ID ${id} のTodoアイテムを更新しました` : `ID ${id} のTodoアイテムの更新に失敗しました`
            }
        ]
    };
});
serve({
    fetch: app.fetch,
    port: 3001,
});
console.log("[MCP] サーバーがポート3001で起動しました");
let transports = {};
app.get("/sse", (c) => {
    console.log("SSE接続を開始します");
    return streamSSE(c, async (stream) => {
        try {
            const transport = new SSETransport("/messages", stream);
            console.log("SSETransportを初期化しました");
            transports[transport.sessionId] = transport;
            stream.onAbort(() => {
                console.log(`SSE接続が中止されました: ${transport.sessionId}`);
                delete transports[transport.sessionId];
            });
            await mcpSearver.connect(transport);
            console.log(`MCPサーバーに接続しました: ${transport.sessionId}`);
            while (true) {
                await stream.sleep(60000);
            }
        }
        catch (e) {
            console.error(`SSE接続中にエラーが発生しました: ${e}`);
        }
    });
});
app.post("/messages", async (c) => {
    const sessionId = c.req.query("sessionId");
    const transport = transports[sessionId ?? ""];
    if (!transport) {
        return c.text("Session not found", 404);
    }
    return transport.handlePostMessage(c);
});
